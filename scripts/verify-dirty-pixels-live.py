#!/usr/bin/env python3
"""Real GIF texture regressions: timing, static motion fallback and lifecycle."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path(os.environ.get('TMPDIR', Path.home() / '.hermes/cache/scratch'))


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def idle(page):
    page.wait_for_timeout(120)
    frames = page.evaluate('__frames')
    page.wait_for_timeout(180)
    assert page.evaluate('__frames') == frames, 'GIF RAF did not stop'


def main():
    subprocess.run(['node', '--check', str(ROOT / 'assets/js/dirty-pixels.mjs')], check=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/pages/dirty-pixels.html'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = browser.new_context(viewport={'width': 1200, 'height': 1000})
            context.route('https://**/*', lambda route: route.abort())
            context.add_init_script('const raf=requestAnimationFrame;window.__frames=0;window.requestAnimationFrame=cb=>raf(t=>{__frames++;cb(t)})')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' and 'net::ERR_FAILED' not in msg.text else None)
            page.goto(url)
            page.wait_for_function("dirtyStatus.textContent.includes('THREE.JS / original animated GIF texture')")
            canvas = page.locator('#dirtyCanvas')
            samples = []
            for _ in range(12):
                samples.append(canvas.screenshot())
                page.wait_for_timeout(60)
            assert len(set(samples)) > 2, 'GIF rendered frames are not advancing'
            page.locator('#dirtyPause').click()
            idle(page)
            held_index = canvas.get_attribute('data-frame-index')
            held = canvas.screenshot()
            assert held == canvas.screenshot()
            # Resume does not rewind the source; only Restart rewinds.
            page.evaluate("dirtyPause.click(); dirtyPause.click()")
            assert canvas.get_attribute('data-frame-index') == held_index
            page.evaluate("dirtyRestart.click(); dirtyPause.click()")
            assert canvas.get_attribute('data-frame-index') == '0'
            page.locator('#dirtyPause').click()
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function("dirtyStatus.textContent.includes('Reduced motion') && dirtyCanvas.dataset.frameIndex==='0'")
            assert canvas.is_visible() and not page.locator('#dirtyFallback').is_visible()
            idle(page)
            static = canvas.screenshot()
            assert static == canvas.screenshot()
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_function('!dirtyPause.disabled')
            frames = page.evaluate('__frames')
            page.wait_for_timeout(150)
            assert page.evaluate('__frames') > frames
            page.evaluate("dispatchEvent(new Event('pagehide'))")
            idle(page)
            page.evaluate("dispatchEvent(new Event('pageshow'))")
            page.wait_for_timeout(150)
            assert page.evaluate('__frames') > frames
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            idle(page)
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
            page.locator('#dirtyPause').click()
            idle(page)
            for width in (320, 375, 1440):
                page.set_viewport_size({'width': width, 'height': 1000})
                page.wait_for_timeout(100)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            page.screenshot(path=str(SCRATCH / 'dirty-pixels-final.png'), full_page=True)
            canvas.evaluate("c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
            page.wait_for_function('dirtyCanvas.hidden && dirtyPause.disabled')
            assert page.locator('#dirtyFallback').is_visible()
            assert not errors, errors
            for motion in ('reduce', 'no-preference'):
                fallback = context.new_page()
                fallback.emulate_media(reduced_motion=motion)
                fallback.add_init_script("const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:get.call(this,t,...a)}")
                fallback.goto(url)
                fallback.wait_for_function('dirtyPause.disabled && dirtyCanvas.hidden')
                fallback.wait_for_function("dirtyStatus.textContent.includes('unavailable')")
                assert fallback.locator('#dirtyFallback').is_visible()
                assert fallback.locator('#dirtyFallback').evaluate('i=>i.complete && i.naturalWidth>0')
                if motion == 'reduce':
                    assert fallback.locator('#dirtyFallback').evaluate("i=>i.currentSrc.endsWith('frame-00.png')")
                idle(fallback)
                fallback.close()
            nojs = browser.new_context(java_script_enabled=False, reduced_motion='reduce')
            static_page = nojs.new_page()
            static_page.goto(url)
            assert static_page.locator('#dirtyFallback').evaluate("i=>i.currentSrc.endsWith('frame-00.png') && i.naturalWidth>0")
            nojs.close()
            # GIF load may lag decoded source frames: no zero-sized texture or camera.
            delayed = context.new_page()
            delayed.route('**/yudho-dirty-pixels.gif', lambda route: route.abort())
            delayed.goto(url)
            delayed.wait_for_function('!dirtyPause.disabled')
            delayed.locator('#dirtyPause').click()
            assert delayed.locator('#dirtyCanvas').is_visible()
            assert delayed.locator('#dirtyCanvas').evaluate('c=>c.width>0 && c.height>0')
            delayed.close()
            for manifest in ([], [{'src': '../assets/yudho-dirty-pixels-frames/frame-00.png', 'duration': 0}]):
                invalid = context.new_page()
                invalid.route('**/yudho-dirty-pixels-frames.json', lambda route, request, data=manifest: route.fulfill(json=data))
                invalid.goto(url)
                invalid.wait_for_function("dirtyStatus.textContent.includes('unavailable')")
                idle(invalid)
                invalid.close()
            browser.close()
            cycle = sum(frame['duration'] for frame in json.loads((ROOT / 'assets/yudho-dirty-pixels-frames.json').read_text()))
            print(f'PASS: {len(set(samples))} real GIF frames, {cycle} ms source cycle; resume/restart, reduced-motion recovery, resize, lifecycle/context loss, static fallback and validation')
            print(f'Screenshot: {SCRATCH}/dirty-pixels-final.png')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
