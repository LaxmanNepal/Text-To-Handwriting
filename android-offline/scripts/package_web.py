#!/usr/bin/env python3
"""Build a self-contained web bundle for the offline Android WebView."""
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import hashlib, re, shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'android-offline' / 'app' / 'src' / 'main' / 'assets' / 'www'
EXCLUDE = {'.git','.github','android-offline','node_modules'}
EXTS = {'.html','.css','.js','.json','.webmanifest','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.txt'}
CACHE = {}


def fetch(url):
    req = Request(url, headers={'User-Agent':'Mozilla/5.0 TextToHandwriting-Offline-Bundler/3.0'})
    with urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def filename(url, fallback='asset'):
    name = Path(urlparse(url).path).name or fallback
    name = re.sub(r'[^A-Za-z0-9._-]','_',name)
    digest = hashlib.sha256(url.encode()).hexdigest()[:10]
    return f'{digest}-{name}'


def vendor(url, kind='asset'):
    if url in CACHE:
        return CACHE[url]

    # Google Fonts can return 404 when a large combined CSS request contains
    # one family/weight combination that the CSS endpoint rejects. Retry each
    # family independently and build one local stylesheet from the successful
    # responses instead of failing the entire Android build.
    parsed = urlparse(url)
    if parsed.netloc in {'fonts.googleapis.com', 'fonts.googleapis.com.'} and parsed.path == '/css2':
        try:
            data, ctype = fetch(url)
        except HTTPError as e:
            if e.code != 404:
                raise
            families = parse_qs(parsed.query).get('family', [])
            if not families:
                raise RuntimeError(f'Google Fonts request returned 404: {url}') from e
            css_parts = []
            for family in families:
                single = 'https://fonts.googleapis.com/css2?' + urlencode({'family': family, 'display': 'swap'})
                try:
                    part, _ = fetch(single)
                    css_parts.append(part.decode('utf-8', errors='replace'))
                except (HTTPError, URLError) as family_error:
                    print(f'WARNING: skipping unavailable Google Font family {family!r}: {family_error}')
            if not css_parts:
                raise RuntimeError(f'All Google Font family requests failed for: {url}') from e
            data = '\n'.join(css_parts).encode('utf-8')
            ctype = 'text/css'
        return _write_vendor_css(url, data, ctype)

    data, ctype = fetch(url)
    name = filename(url, kind)
    target = OUT/'vendor'/name
    target.parent.mkdir(parents=True, exist_ok=True)
    CACHE[url] = 'vendor/'+name
    if kind == 'css' or 'css' in ctype or target.suffix.lower() == '.css':
        _write_css_file(target, data, url)
    else:
        target.write_bytes(data)
    return CACHE[url]


def _write_vendor_css(source_url, data, ctype):
    name = filename(source_url, 'style.css')
    target = OUT/'vendor'/name
    target.parent.mkdir(parents=True, exist_ok=True)
    CACHE[source_url] = 'vendor/'+name
    _write_css_file(target, data, source_url)
    return CACHE[source_url]


def _write_css_file(target, data, source_url):
    text = data.decode('utf-8', errors='replace')
    def css_asset(m):
        raw = m.group(1).strip().strip('"\'')
        if raw.startswith('data:'):
            return m.group(0)
        absolute = urljoin(source_url, raw)
        try:
            return 'url("'+vendor(absolute)+'")'
        except Exception as e:
            raise RuntimeError(f'Cannot vendor CSS asset {absolute}: {e}') from e
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
        dst = OUT/rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)


def patch_html():
    path = OUT/'index.html'
    if not path.exists():
        raise RuntimeError('index.html not found')
    html = path.read_text(encoding='utf-8', errors='replace')

    def src_repl(m):
        url = m.group(3)
        return m.group(1)+m.group(2)+vendor(url,'script.js')+m.group(2)+m.group(4)

    def href_repl(m):
        url = m.group(3)
        return m.group(1)+m.group(2)+vendor(url,'style.css')+m.group(2)+m.group(4)

    html = re.sub(r'(<script[^>]+\bsrc\s*=\s*)(["\'])(https?://[^"\']+)(["\'][^>]*>)', src_repl, html, flags=re.I)
    html = re.sub(r'(<link[^>]+\bhref\s*=\s*)(["\'])(https?://[^"\']+)(["\'][^>]*>)', href_repl, html, flags=re.I)
    path.write_text(html, encoding='utf-8')


def verify():
    bad = []
    for p in OUT.rglob('*'):
        if p.is_file() and p.suffix.lower() in {'.html','.css','.js','.webmanifest'}:
            text = p.read_text(encoding='utf-8', errors='replace')
            if re.search(r'https?://', text):
                bad.append(str(p.relative_to(OUT)))
    if bad:
        raise RuntimeError('External URLs remain in runtime assets: '+', '.join(bad))


if __name__ == '__main__':
    copy_local()
    patch_html()
    verify()
    print(f'Offline bundle ready: {OUT}')
    print(f'Vendored resources: {len(CACHE)}')
