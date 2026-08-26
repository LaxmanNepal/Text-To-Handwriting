#!/usr/bin/env python3
"""Build a self-contained web bundle for the offline Android WebView."""
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import hashlib, re, shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'android-offline' / 'app' / 'src' / 'main' / 'assets' / 'www'
EXCLUDE = {'.git', '.github', 'android-offline', 'node_modules'}
EXTS = {'.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.txt'}
CACHE = {}
WARNINGS = []


def fetch(url):
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 TextToHandwriting-Offline-Bundler/3.6'})
    with urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def filename(url, fallback='asset'):
    name = Path(urlparse(url).path).name or fallback
    name = re.sub(r'[^A-Za-z0-9._-]', '_', name)
    digest = hashlib.sha256(url.encode()).hexdigest()[:10]
    return f'{digest}-{name}'


def vendor(url, kind='asset', required=True):
    if url in CACHE:
        return CACHE[url]
    try:
        data, ctype = fetch(url)
    except (HTTPError, URLError, TimeoutError) as exc:
        if required:
            raise RuntimeError(f'Cannot vendor required resource {url}: {exc}') from exc
        WARNINGS.append(f'Optional resource skipped: {url} ({exc})')
        return None
    name = filename(url, kind)
    target = OUT / 'vendor' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    CACHE[url] = 'vendor/' + name
    if kind == 'css' or 'css' in ctype or target.suffix.lower() == '.css':
        _write_css_file(target, data, url)
    else:
        target.write_bytes(data)
    return CACHE[url]


def google_fonts(url):
    parsed = urlparse(url)
    families = parse_qs(parsed.query).get('family', [])
    if not families:
        raise RuntimeError(f'Google Fonts stylesheet URL contains no families: {url}')

    css_parts = []
    for family in families:
        single = 'https://fonts.googleapis.com/css2?' + urlencode({'family': family, 'display': 'swap'})
        try:
            part, _ = fetch(single)
            css_parts.append(part.decode('utf-8', errors='replace'))
        except (HTTPError, URLError, TimeoutError) as exc:
            raise RuntimeError(f'Cannot download Google Font family {family}: {exc}') from exc

    if not css_parts:
        raise RuntimeError(f'No Google Font family could be downloaded from: {url}')

    name = filename(url, 'google-fonts.css')
    target = OUT / 'vendor' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    CACHE[url] = 'vendor/' + name
    _write_css_file(target, '\n'.join(css_parts).encode('utf-8'), 'https://fonts.googleapis.com/')
    return CACHE[url]


def _write_css_file(target, data, source_url):
    text = data.decode('utf-8', errors='replace')

    def css_asset(m):
        raw = m.group(1).strip().strip('"\'')
        if raw.startswith(('data:', '#')):
            return m.group(0)
        absolute = urljoin(source_url, raw)
        local = vendor(absolute, 'asset', required=False)
        return 'url("' + (local or raw) + '")'

    text = re.sub(r'url\(\s*([^)]*?)\s*\)', css_asset, text, flags=re.I)
    target.write_text(text, encoding='utf-8')


def copy_local():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for p in ROOT.rglob('*'):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if any(part in EXCLUDE for part in rel.parts):
            continue
        if p.suffix.lower() not in EXTS:
            continue
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)


def patch_html():
    path = OUT / 'index.html'
    if not path.exists():
        raise RuntimeError('index.html not found')
    html = path.read_text(encoding='utf-8', errors='replace')

    def src_repl(m):
        local = vendor(m.group(3), 'script.js', required=True)
        return m.group(1) + m.group(2) + local + m.group(2) + m.group(4)

    html = re.sub(r'(<script\b[^>]+\bsrc\s*=\s*)(["\'])(https?://[^"\']+)(["\'][^>]*>)', src_repl, html, flags=re.I)

    def link_repl(m):
        tag = m.group(0)
        url = m.group(3)
        rel_match = re.search(r'\brel\s*=\s*(["\'])([^"\']+)\1', tag, flags=re.I)
        rel_values = set(rel_match.group(2).lower().split()) if rel_match else set()
        if 'stylesheet' not in rel_values:
            return ''
        if 'fonts.googleapis.com' in url:
            parsed = urlparse(url)
            families = parse_qs(parsed.query).get('family', [])
            if parsed.netloc.lower() != 'fonts.googleapis.com' or not families:
                raise RuntimeError(f'Invalid Google Fonts stylesheet URL: {url}')
            local = google_fonts(url)
        else:
            local = vendor(url, 'style.css', required=True)
        return m.group(1) + m.group(2) + local + m.group(2) + m.group(4)

    html = re.sub(r'(<link\b[^>]+\bhref\s*=\s*)(["\'])(https?://[^"\']+)(["\'][^>]*>)', link_repl, html, flags=re.I)
    path.write_text(html, encoding='utf-8')


def verify():
    """Fail only when actual network-backed runtime references remain.

    Vendored third-party files can legitimately contain absolute URLs in comments,
    source maps, PDF metadata, feature detection, or dead fallback code. The old
    verifier rejected any literal http(s) string and therefore produced false
    positives after successful vendoring. Check HTML/CSS resource declarations and
    JavaScript network APIs instead.
    """
    violations = []

    for p in OUT.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in {'.html', '.css', '.js', '.webmanifest'}:
            continue
        text = p.read_text(encoding='utf-8', errors='replace')
        rel = str(p.relative_to(OUT))

        # External resource declarations that would actually require the network.
        patterns = [
            r'<script\b[^>]+\bsrc\s*=\s*["\']https?://',
            r'<link\b[^>]+\bhref\s*=\s*["\']https?://',
            r'@import\s+(?:url\()?\s*["\']?https?://',
            r'url\(\s*["\']?https?://',
        ]
        if any(re.search(pattern, text, flags=re.I) for pattern in patterns):
            violations.append(rel)
            continue

        # Explicit runtime network calls are not allowed in the offline bundle.
        js_network = [
            r'\bfetch\s*\(\s*["\']https?://',
            r'\bXMLHttpRequest\s*\(',
            r'\bnew\s+WebSocket\s*\(',
        ]
        if p.suffix.lower() == '.js' and any(re.search(pattern, text, flags=re.I) for pattern in js_network):
            violations.append(rel)

    if violations:
        raise RuntimeError('External runtime resources remain in offline assets: ' + ', '.join(sorted(set(violations))))


if __name__ == '__main__':
    copy_local()
    patch_html()
    verify()
    print(f'Offline bundle ready: {OUT}')
    print(f'Vendored resources: {len(CACHE)}')
    for warning in WARNINGS:
        print('WARNING:', warning)
