#!/usr/bin/env python3
"""Static checks; --browser adds an offline Chromium smoke test (Python Playwright)."""
import argparse
from collections import Counter
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import tempfile
from threading import Thread
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.scripts = []
        self.open_tags = Counter()
        self.close_tags = Counter()
        self.script = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        self.open_tags[tag] += 1
        if tag == 'script' and not attrs.get('src'):
            self.script = ''

    def handle_endtag(self, tag):
        self.close_tags[tag] += 1
        if tag == 'script' and self.script is not None:
            self.scripts.append(self.script)
            self.script = None

    def handle_data(self, data):
        if self.script is not None:
            self.script += data


def static_checks():
    files = [ROOT / 'index.html', *sorted((ROOT / 'pages').glob('*.html'))]
    docs = {path: Document(path.read_text()) for path in files}
    failures = []
    scripts = []
    index_links = [a['href'] for tag, a in docs[files[0]].elements
                   if tag == 'a' and a.get('href', '').startswith('pages/')]
    expected = {str(path.relative_to(ROOT)) for path in files[1:]}
    if set(index_links) != expected or len(index_links) != len(expected):
        failures.append('Index cards must link to every demo exactly once')
    numbers = re.findall(r'class="card__number">(\d+)<', files[0].read_text())
    if [int(n) for n in numbers] != list(range(1, len(expected) + 1)):
        failures.append('Index card numbering is not sequential')
    for path, doc in docs.items():
        name = str(path.relative_to(ROOT))
        for tag in ('html', 'head', 'body'):
            if doc.open_tags[tag] != 1 or doc.close_tags[tag] != 1:
                failures.append(f'{name}: expected one explicit <{tag}> and </{tag}>')
        ids = [a['id'] for _, a in doc.elements if a.get('id')]
        if len(ids) != len(set(ids)):
            failures.append(f'{name}: duplicate IDs')
        if path != files[0] and not any(tag == 'a' and a.get('href') == '../index.html'
                                        for tag, a in doc.elements):
            failures.append(f'{name}: missing return link')
        if 'prefers-reduced-motion' not in path.read_text():
            failures.append(f'{name}: missing reduced-motion CSS')
        for tag, attrs in doc.elements:
            for attr in ('src', 'href'):
                url = attrs.get(attr, '')
                parsed = urlsplit(url)
                if not url or parsed.scheme or parsed.netloc:
                    continue
                target = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
                if not target.is_file():
                    failures.append(f'{name}: missing {attr}={url}')
                elif parsed.fragment and target in docs:
                    target_ids = {a.get('id') for _, a in docs[target].elements}
                    if unquote(parsed.fragment) not in target_ids:
                        failures.append(f'{name}: missing fragment {url}')
        scripts.extend((name, code) for code in doc.scripts)
    scripts.extend((str(p.relative_to(ROOT)), p.read_text())
                   for p in sorted((ROOT / 'assets/js').iterdir()) if p.suffix in ('.js', '.mjs'))
    with tempfile.TemporaryDirectory() as directory:
        for i, (name, code) in enumerate(scripts):
            script = Path(directory) / f'{i}.js'
            script.write_text(code)
            result = subprocess.run(['node', '--check', str(script)], capture_output=True, text=True)
            if result.returncode:
                failures.append(f'{name}: JavaScript syntax error: {result.stderr}')
    if failures:
        raise AssertionError('\n'.join(failures))
    print(f'Static PASS: {len(files)} HTML documents, {len(expected)} cards, {len(scripts)} scripts', flush=True)
    return files


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def browser_checks(files):
    from playwright.sync_api import sync_playwright

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    failures = []
    visits = 0
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(args=['--disable-gpu'])
            for motion, widths in [('reduce', [320, 375, 1440]), ('no-preference', [375])]:
                context = browser.new_context(reduced_motion='reduce' if motion == 'reduce' else 'no-preference')
                # Exercise readable fallbacks rather than depending on font/CDN availability.
                context.route('**/*', lambda route: route.continue_()
                              if urlsplit(route.request.url).netloc == urlsplit(base).netloc
                              else route.abort())
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('response', lambda response: errors.append(f'HTTP {response.status}: {response.url}')
                        if response.status >= 400 else None)
                for path in files:
                    for width in widths:
                        errors.clear()
                        name = str(path.relative_to(ROOT))
                        page.set_viewport_size({'width': width, 'height': 900})
                        page.goto(f'{base}/{name}')
                        page.wait_for_timeout(80)
                        visits += 1
                        dimensions = page.evaluate('''() => ({width:innerWidth,
                            scroll:document.documentElement.scrollWidth,
                            brokenImages:[...document.images].filter(i => !i.complete || !i.naturalWidth).map(i=>i.src)})''')
                        if dimensions['scroll'] > width + 1 or dimensions['brokenImages'] or errors:
                            failures.append({'page': name, 'width': width, 'motion': motion,
                                             **dimensions, 'errors': list(errors)})
                if motion == 'reduce':
                    page.goto(base)
                    assert page.locator('.card').count() == len(files) - 1
                    assert page.locator('.card').evaluate_all("es => es.every(e=>getComputedStyle(e).opacity==='1' && getComputedStyle(e).animationName==='none')")
                    page.keyboard.press('Tab')
                    assert page.locator('.card').first.evaluate("e=>e===document.activeElement && getComputedStyle(e).outlineStyle!=='none'")
                    page.goto(base + '/pages/garden.html')
                    card = page.locator('.card').first
                    card.hover()
                    assert card.evaluate("e=>getComputedStyle(e).transform==='none'")
                    # Convert actual computed colors through Canvas to check sRGB contrast.
                    contrast = '''e => {
                        const s=getComputedStyle(e), c=document.createElement('canvas'); c.width=c.height=1;
                        const ctx=c.getContext('2d');
                        const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
                        const fg=rgb(s.color), bg=rgb(s.backgroundColor);
                        const paper=rgb(getComputedStyle(document.body).backgroundColor);
                        const mixed=bg.slice(0,3).map((v,i)=>v*bg[3]/255+paper[i]*(1-bg[3]/255));
                        const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
                        const a=lum(fg.slice(0,3)),b=lum(mixed);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                    }'''
                    ratios = {}
                    for theme in ('midnight', 'aurora', 'lumen'):
                        page.goto(base + f'/pages/{theme}.html')
                        button = page.locator('.btn--primary')
                        button.hover()
                        page.wait_for_timeout(30)
                        ratios[theme + ' hover'] = button.evaluate(contrast)
                        assert ratios[theme + ' hover'] >= 4.5, ratios
                    page.goto(base + '/pages/hum.html')
                    ratios['hum label'] = page.locator('.hero__label').evaluate(contrast)
                    assert ratios['hum label'] >= 4.5, ratios
                    print('Contrast PASS: ' + ', '.join(f'{key} {value:.2f}:1' for key, value in ratios.items()), flush=True)
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    if failures:
        raise AssertionError(json.dumps(failures, indent=2))
    print(f'Browser PASS: {visits} offline page/viewport/motion cases; index keyboard/reduced motion and theme hover isolation', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true')
    args = parser.parse_args()
    files = static_checks()
    if args.browser:
        browser_checks(files)


if __name__ == '__main__':
    main()
