#!/usr/bin/env python3
"""Real offline WebGL regression for the GIF-derived line-particle demo."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import subprocess
import math
from collections import Counter
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path(os.environ.get('TMPDIR', Path.home() / '.hermes/cache/scratch'))


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def idle(page):
    page.wait_for_timeout(120)
    frames = page.evaluate('window.__frames')
    page.wait_for_timeout(180)
    assert page.evaluate('window.__frames') == frames, 'RAF kept running while idle'


def main():
    subprocess.run(['node', '--check', str(ROOT / 'assets/js/dirty-pixel-particles.mjs')], check=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/pages/dirty-pixel-particles.html'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = browser.new_context(viewport={'width': 1200, 'height': 1100})
            context.route('https://**/*', lambda route: route.abort())
            context.add_init_script('''const nativeRAF=requestAnimationFrame;
              window.__frames=0;window.__draws=0;window.__samples=0;window.__uploads=0;
              window.requestAnimationFrame=cb=>nativeRAF(t=>{window.__frames++;cb(t)});
              window.__position=[];window.__color=[];window.__vertexCount=0;
              function capture(data){if(!ArrayBuffer.isView(data) || data.length<18)return;
                const a=Array.from(data.subarray(0,18));
                if(a[0]===a[3] && a[1]===a[4] && a[2]===a[5])window.__color=a;else window.__position=a;}
              const buffer=WebGL2RenderingContext.prototype.bufferData;
              WebGL2RenderingContext.prototype.bufferData=function(t,data,...a){capture(data);return buffer.call(this,t,data,...a)};
              const draw=WebGL2RenderingContext.prototype.drawArrays;
              WebGL2RenderingContext.prototype.drawArrays=function(...a){window.__draws++;window.__vertexCount=a[2];return draw.apply(this,a)};
              const upload=WebGL2RenderingContext.prototype.bufferSubData;
              WebGL2RenderingContext.prototype.bufferSubData=function(...a){window.__uploads++;capture(a[2]);return upload.apply(this,a)};
              const read=CanvasRenderingContext2D.prototype.getImageData;
              CanvasRenderingContext2D.prototype.getImageData=function(...a){window.__samples++;return read.apply(this,a)};
            ''')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' and 'net::ERR_FAILED' not in msg.text else None)
            page.goto(url)
            page.wait_for_function("particleCanvas.dataset.particleCount === '12000' && !particlePause.disabled")
            canvas = page.locator('#particleCanvas')
            assert canvas.is_visible()
            assert page.locator('#lineWidth').input_value() == '1.5'
            assert page.locator('#lineLength').count() == 0, 'removed length control returned'
            assert page.locator('.controls input[type=range]').count() == 3
            assert canvas.get_attribute('data-line-length') == '1.25'
            assert page.locator('#lineColor').input_value() == '0'
            # Capture presented pixels; a drawImage in an unrelated RAF can read a
            # cleared WebGL backbuffer even though the composited artwork is visible.
            samples = []
            frame_indices = set()
            for _ in range(12):
                samples.append(canvas.screenshot())
                frame_indices.add(canvas.get_attribute('data-frame-index'))
                page.wait_for_timeout(60)
            assert len(frame_indices) > 2, 'real GIF frame indices did not advance'
            assert len(set(samples)) > 2, 'real GIF particle frames did not change'
            page.locator('#particlePause').click()
            idle(page)
            held = canvas.screenshot()
            palette = Counter(Image.open(BytesIO(held)).convert('RGB').get_flattened_data())
            assert palette[(225, 0, 0)] > 100, f'source RGB(225,0,0) missing: {palette.most_common(5)}'
            assert palette[(253, 208, 195)] == 0, 'old HSL pastel palette still active'
            canvas.screenshot(path=str(SCRATCH / 'dirty-pixel-particles-source-default.png'))
            # Inspect the real uploaded rectangle, not just a changed screenshot.
            def segment():
                vertices = page.evaluate('__position')
                box = canvas.bounding_box()
                assert box is not None and len(vertices) == 18
                h = box['height']
                center = [(vertices[j] + vertices[6+j]) / 2 for j in (0, 1)]
                length = math.hypot(vertices[6]-vertices[3], vertices[7]-vertices[4]) * h
                width = math.hypot(vertices[3]-vertices[0], vertices[4]-vertices[1]) * h
                return center, length, width
            baseline = segment()
            assert page.evaluate('__vertexCount') == 12000 * 6
            assert abs(baseline[1]-1.25)<.01 and abs(baseline[2]-1.5)<.01, baseline
            page.wait_for_timeout(100)
            assert canvas.screenshot() == held
            for selector, value, attribute in [('#particleCount', '30000', 'data-particle-count'),
                                               ('#lineWidth', '3', 'data-particle-size'),
                                               ('#lineColor', '120', 'data-particle-hue')]:
                before = canvas.screenshot()
                page.locator(selector).fill(value)
                assert canvas.get_attribute(attribute) == value
                assert canvas.screenshot() != before, f'{selector} did not affect pixels'
                assert abs(segment()[1] - 1.25) < .01, f'{selector} changed fixed length'
                idle(page)
            # Width edits restore exactly the same frame, rather than randomizing positions.
            before = canvas.screenshot()
            page.locator('#lineWidth').fill('2')
            page.locator('#lineWidth').fill('3')
            assert canvas.screenshot() == before
            before = canvas.screenshot()
            first_segment = page.evaluate('__position')
            page.locator('#particleCount').fill('2000')
            assert page.evaluate('__position') == first_segment, 'density moved existing segments'
            page.locator('#particleCount').fill('30000')
            assert canvas.screenshot() == before, 'density round trip reshuffled the held frame'
            uploads = page.evaluate('__uploads')
            page.locator('#lineColor').fill('121')
            assert page.evaluate('__uploads') - uploads == 1, 'hue edit reuploaded positions'
            colored = canvas.screenshot()
            page.locator('#lineColor').fill('0')
            palette = Counter(Image.open(BytesIO(canvas.screenshot())).convert('RGB').get_flattened_data())
            assert palette[(225, 0, 0)] > 100, 'SOURCE did not restore actual sampled RGB'
            page.locator('#lineColor').fill('121')
            assert canvas.screenshot() == colored
            page.locator('#lineColor').focus()
            page.keyboard.press('ArrowRight')
            assert page.locator('#lineColor').input_value() == '122'
            for width in (320, 375, 700, 768, 900, 1024, 1440):
                page.set_viewport_size({'width': width, 'height': 1100})
                page.wait_for_timeout(100)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
                assert page.locator('#lineColor').evaluate('e=>e.getBoundingClientRect().width > 40')
            # Deliver screenshots of the source-aligned defaults, not exaggerated edits.
            page.locator('#particleCount').fill('12000')
            page.locator('#lineWidth').fill('1.5')
            page.locator('#lineColor').fill('0')
            page.screenshot(path=str(SCRATCH / 'dirty-pixel-particles-desktop.png'), full_page=True)
            page.set_viewport_size({'width': 375, 'height': 900})
            page.screenshot(path=str(SCRATCH / 'dirty-pixel-particles-mobile.png'), full_page=True)
            page.set_viewport_size({'width': 1200, 'height': 1100})
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function("particleStatus.textContent.includes('Reduced motion') && particleCanvas.dataset.frameIndex === '0'")
            assert canvas.is_visible() and not page.locator('#particleFallback').is_visible()
            assert canvas.get_attribute('data-frame-index') == '0'
            assert page.locator('#particlePause').is_disabled()
            held = canvas.screenshot()
            idle(page)
            assert canvas.screenshot() == held
            page.locator('#lineWidth').fill('2.5')
            assert canvas.screenshot() != held
            page.emulate_media(reduced_motion='no-preference')
            idle(page)  # Paused state survives preference changes.
            page.locator('#particlePause').click()
            page.wait_for_timeout(700)  # Fill each frame's sampling cache.
            counts = page.evaluate('({frames:__frames,draws:__draws,samples:__samples})')
            page.wait_for_timeout(600)
            delta = page.evaluate(f'''(()=>{{const old={counts};return {{frames:__frames-old.frames,draws:__draws-old.draws,samples:__samples-old.samples}}}})()''')
            assert delta['draws'] > 0 and delta['draws'] <= delta['frames'], delta
            assert delta['samples'] == 0, 'sampling cache reread the same GIF frames'
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            idle(page)
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
            page.evaluate("const spacer=document.createElement('div');spacer.style.height='2000px';spacer.id='testSpacer';document.body.append(spacer);scrollTo(0,document.body.scrollHeight)")
            page.wait_for_timeout(100)
            idle(page)
            page.evaluate("document.querySelector('#testSpacer').remove();scrollTo(0,0)")
            page.wait_for_timeout(120)
            assert page.evaluate('__frames') > counts['frames']
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            idle(page)
            page.evaluate("dispatchEvent(new Event('pageshow'))")
            page.wait_for_timeout(100)
            canvas.evaluate("c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
            page.wait_for_function("particlePause.disabled && particleCanvas.hidden")
            assert page.locator('#particleFallback').is_visible()
            assert page.locator('#particleCount').is_disabled()
            idle(page)
            assert not errors, errors
            for motion in ('reduce', 'no-preference'):
                fallback = context.new_page()
                fallback.emulate_media(reduced_motion=motion)
                fallback.add_init_script('''const get=HTMLCanvasElement.prototype.getContext;
                  HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:get.call(this,t,...a)}''')
                fallback.goto(url)
                fallback.wait_for_function("particleStatus.textContent.includes('unavailable') && particleCount.disabled")
                assert fallback.locator('#particleFallback').is_visible()
                assert fallback.locator('#particleFallback').evaluate('i=>i.complete && i.naturalWidth > 0')
                if motion == 'reduce':
                    assert fallback.locator('#particleFallback').evaluate("i=>i.currentSrc.endsWith('frame-00.png')")
                idle(fallback)
                fallback.close()
            # Reduced motion remains static even if JavaScript cannot initialize.
            static_context = browser.new_context(java_script_enabled=False, reduced_motion='reduce')
            static_page = static_context.new_page()
            static_page.goto(url)
            assert static_page.locator('#particleFallback').is_visible()
            assert static_page.locator('#particleFallback').evaluate("i=>i.currentSrc.endsWith('frame-00.png') && i.naturalWidth > 0")
            static_context.close()
            # Reject empty/zero-duration frame lists before entering the animation loop.
            for manifest in ([], [{'src': '../assets/yudho-dirty-pixels-frames/frame-00.png', 'duration': 0}]):
                invalid = context.new_page()
                invalid.route('**/yudho-dirty-pixels-frames.json', lambda route, request, data=manifest: route.fulfill(json=data))
                invalid.goto(url)
                invalid.wait_for_function("particleStatus.textContent.includes('unavailable') && particleCount.disabled")
                assert invalid.locator('#particleFallback').is_visible()
                idle(invalid)
                invalid.close()
            browser.close()
            print(f'PASS Dirty Pixel Particles: {len(set(samples))} real frames, 3 rendered controls, fixed source-baseline length, deterministic edits, cached samples, hue-only upload, pause/resize/keyboard, reduced motion, lifecycle/context loss/fallback; {delta}')
            print(f'Screenshots: {SCRATCH}/dirty-pixel-particles-desktop.png and {SCRATCH}/dirty-pixel-particles-mobile.png')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
