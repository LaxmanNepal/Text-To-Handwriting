#!/usr/bin/env python3
"""Stage the web app into Android assets and vendor external CSS/JS/font URLs.
The APK build may use the network while assembling, but the resulting APK has no
runtime dependency on those CDNs for the staged resources."""
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import hashlib, re, shutil, sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'android-offline' / 'app' / 'src' / 'main' / 'assets' / 'www'
OUT.mkdir(parents=True, exist_ok=True)

EXCLUDE_DIRS = {'.git', '.github', 'android-offline', 'node_modules'}
COPY_EXTS = {'.html','.css','.js','.json','.webmanifest','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.txt'}


def fetch(url):
    req = Request(url, headers={'User-Agent':'TextToHandwriting-Android-Build/1.0'})
    with urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def safe_name(url, fallback='asset'):
    p = Path(urlparse(url).path)
    name = p.name or fallback
    if '?' in name: name = name.split('?',1)[0]
    digest = hashlib.sha256(url.encode()).hexdigest()[:10]
    return f'{digest}-{name}'


def vendor_css(css, base_url, css_name):
    def repl(m):
        raw = m.group(1).strip().strip('"\'')
        if raw.startswith(('data:','#')) or raw.startswith(('http://','https://')) is False:
            if raw.startswith('//'): raw_url = 'https:' + raw
            else: raw_url = urljoin(base_url, raw)
        else:
            raw_url = raw
        if not raw_url.startswith(('http://','https://')): return m.group(0)
        try:
            data, _ = fetch(raw_url)
            name = safe_name(raw_url)
            target = OUT / 'vendor' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return f'url("vendor/{name}")'
        except Exception as e:
            print(f'WARN css asset {raw_url}: {e}', file=sys.stderr)
            return m.group(0)
    return re.sub(r'url\(([^)]+)\)', repl, css)


def vendor_remote(url, kind):
    data, ctype = fetch(url)
    name = safe_name(url, kind)
    target = OUT / 'vendor' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if kind == 'css' or 'css' in ctype:
        text = data.decode('utf-8', errors='replace')
        text = vendor_css(text, url, name)
        target.write_text(text, encoding='utf-8')
    else:
        target.write_bytes(data)
    return 'vendor/' + name


def copy_local():
    for p in ROOT.rglob('*'):
        if not p.is_file(): continue
        rel = p.relative_to(ROOT)
        if any(part in EXCLUDE_DIRS for part in rel.parts): continue
        if p.suffix.lower() not in COPY_EXTS: continue
        # Avoid copying generated/staging output.
        if str(rel).startswith('android-offline/app/src/main/assets'): continue
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)


def patch_html():
    html = (OUT / 'index.html').read_text(encoding='utf-8', errors='replace')

    def script_repl(m):
        pre, quote, url, post = m.group(1), m.group(2), m.group(3), m.group(4)
        if not url.startswith(('http://','https://')): return m.group(0)
        try:
            local = vendor_remote(url, 'script.js')
            return f'{pre}{quote}{local}{quote}{post}'
        except Exception as e:
            raise RuntimeError(f'Cannot vendor script {url}: {e}')

    html = re.sub(r'(<script[^>]+\bsrc\s*=\s*)([\"\'])(https?://[^\"\']+)(\2[^>]*>)', script_repl, html, flags=re.I)

    def link_repl(m):
        pre, quote, url, post = m.group(1), m.group(2), m.group(3), m.group(4)
        if not url.startswith(('http://','https://')): return m.group(0)
        try:
            local = vendor_remote(url, 'style.css')
            return f'{pre}{quote}{local}{quote}{post}'
        except Exception as e:
            raise RuntimeError(f'Cannot vendor stylesheet {url}: {e}')

    html = re.sub(r'(<link[^>]+\bhref\s*=\s*)([\"\'])(https?://[^\"\']+)(\2[^>]*>)', link_repl, html, flags=re.I)
    (OUT / 'index.html').write_text(html, encoding='utf-8')


if __name__ == '__main__':
    copy_local()
    patch_html()
    print(f'Packaged offline web assets in {OUT}')
