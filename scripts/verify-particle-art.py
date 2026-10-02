#!/usr/bin/env python3
"""Offline Three.js artwork regression: physics, rendering, controls and fallback."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def idle(page):
    page.wait_for_timeout(120)
    frames = page.evaluate('window.__frames')
    page.wait_for_timeout(180)
    assert page.evaluate('window.__frames') == frames, 'animation did not sleep'


def main():
    for path in (ROOT / 'assets/js').glob('particle-art*.mjs'):
        subprocess.run(['node', '--check', str(path)], check=True)
    subprocess.run(['node', '--input-type=module', '-e', '''
      import {stepParticles} from './assets/js/particle-art-physics.mjs';
      import assert from 'node:assert/strict';
      const p=new Float32Array([10,0,0]), h=p.slice(), v=new Float32Array(3);
      const brush={x:0,y:0,active:true};
      for(let i=0;i<60;i++)stepParticles(p,h,v,brush,90,1.8);
      assert(p[0]>h[0]+10); assert(p[2]>0);
      brush.active=false;
      for(let i=0;i<600;i++)stepParticles(p,h,v,brush,90,1.8);
      assert(Math.abs(p[0]-h[0])<.001);assert(Math.abs(p[2])<.001);
      console.log('Physics PASS: push, depth, spring return');
    '''], cwd=ROOT, check=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            context = browser.new_context(viewport={'width': 1200, 'height': 1100})
            context.route('https://**/*', lambda route: route.abort())
            context.add_init_script('''(() => {
              const raf=requestAnimationFrame;window.__frames=0;
              window.requestAnimationFrame=cb=>raf(t=>{window.__frames++;cb(t)});
            })()''')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'net::ERR_FAILED' not in m.text else None)
            page.goto(base + '/pages/particle-art.html')
            page.wait_for_function("document.querySelector('#artStatus').textContent.includes('14,400')")
            canvas = page.locator('#artCanvas')
            assert canvas.is_visible()
            idle(page)
            before = canvas.screenshot()
            canvas.focus()
            page.keyboard.press('ArrowRight')
            idle(page)
            assert canvas.screenshot() == before, 'arrow movement pushed without Space'
            page.keyboard.down('Space')
            page.wait_for_timeout(350)
            assert canvas.screenshot() != before, 'Space did not push particles'
            page.keyboard.up('Space')
            page.keyboard.press('Escape')
            page.wait_for_timeout(5000)
            idle(page)
            page.locator('#scatterArt').click()
            page.wait_for_timeout(100)
            page.locator('#pauseArt').click()
            idle(page)
            assert page.locator('#pauseArt').get_attribute('aria-pressed') == 'true'
            page.locator('#resetArt').click()
            page.locator('#pauseArt').click()
            idle(page)
            rect = canvas.bounding_box()
            assert rect is not None
            page.mouse.move(rect['x'] + rect['width'] * .5, rect['y'] + rect['height'] * .5)
            page.wait_for_timeout(250)
            assert canvas.screenshot() != before, 'mouse push did not render'
            page.mouse.move(0, 0)
            page.locator('#resetArt').click()
            page.locator('#brushRadius').fill('150')
            assert page.locator('#radiusValue').inner_text() == '150'
            page.emulate_media(reduced_motion='reduce')
            idle(page)
            assert page.locator('#scatterArt').is_disabled()
            for width in (320, 375, 1440):
                page.set_viewport_size({'width': width, 'height': 900})
                page.wait_for_timeout(100)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            page.emulate_media(reduced_motion='no-preference')
            page.locator('#scatterArt').click()
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            idle(page)
            page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
            page.locator('#resetArt').click()
            page.locator('#scatterArt').click()
            page.wait_for_timeout(100)
            page.evaluate("window.dispatchEvent(new Event('pagehide'))")
            idle(page)
            page.evaluate("window.dispatchEvent(new Event('pageshow'))")
            page.wait_for_timeout(100)
            page.locator('#resetArt').click()
            page.locator('#scatterArt').click()
            canvas.evaluate("c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
            page.wait_for_function("document.querySelector('#scatterArt').disabled")
            idle(page)
            assert page.locator('#artFallback').is_visible()
            assert page.locator('#scatterArt').is_disabled()
            assert not errors, errors
            fallback = context.new_page()
            fallback.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:original.call(this,t,...a)}")
            fallback.goto(base + '/pages/particle-art.html')
            fallback.wait_for_function("document.querySelector('#artStatus').textContent.includes('unavailable')")
            assert fallback.locator('#artFallback').is_visible()
            assert fallback.locator('#artFallback').evaluate('i=>i.complete && i.naturalWidth > 0')
            browser.close()
            print('Browser PASS: local WebGL render, keyboard/mouse push, settle, scatter/pause/reset, sliders, reduced motion, resize, hidden tab, context loss, forced fallback')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

if __name__ == '__main__':
    main()
