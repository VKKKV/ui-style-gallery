#!/usr/bin/env python3
"""Exercise interaction regressions offline using Python Playwright."""
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path
from threading import Thread
import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('gallery_checks', Path(__file__).with_name('verify-gallery.py'))
assert spec is not None and spec.loader is not None
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(gallery.QuietHandler, directory=str(gallery.ROOT)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--disable-gpu'])
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce', device_scale_factor=2)
        context.route('https://**/*', lambda route: route.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        page.goto(base + '/pages/carousel.html')
        page.locator('.swiper-button-next').click()
        assert page.locator('#slideCurrent').inner_text() == '02'
        page.locator('#thumbSwiper .swiper-slide').nth(4).press('Enter')
        assert page.locator('#slideCurrent').inner_text() == '05'
        page.locator('#openModal').click()
        assert page.locator('#closeModal').evaluate('e=>e===document.activeElement')
        assert page.locator('.carousel-page').evaluate('e=>e.inert')
        page.keyboard.press('Tab')
        assert page.locator('#closeModal').evaluate('e=>e===document.activeElement')
        page.keyboard.press('Escape')
        assert page.locator('#openModal').evaluate('e=>e===document.activeElement')
        assert page.locator('#modal').evaluate('e=>e.inert')
        assert not page.locator('.carousel-page').evaluate('e=>e.inert')
        print('PASS carousel offline navigation, keyboard, modal focus/inert/restore')

        page.goto(base + '/pages/shuffle.html')
        page.locator('#playInput').fill('hello🙂')
        assert page.locator('#playOutput span[aria-hidden]').inner_text() == 'HELLO🙂'
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#playInput').fill('old value')
        page.locator('#playInput').fill('new')
        page.wait_for_function("document.querySelector('#playOutput span[aria-hidden]').textContent === 'NEW'")
        page.evaluate("document.querySelector('#mainTitle')._shuffleText.destroy(); initShuffleText(); initShuffleText()")
        assert page.locator('#mainTitle > span').count() == 2
        print('PASS shuffle Unicode, reduced motion, fast input replacement, idempotent init')

        page.goto(base + '/pages/cursor.html')
        page.mouse.move(500, 350)
        page.wait_for_function("document.documentElement.classList.contains('custom-cursor-active')")
        page.keyboard.press('Tab')
        page.wait_for_function("!document.documentElement.classList.contains('custom-cursor-active')")
        page.mouse.move(550, 350)
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("!document.documentElement.classList.contains('custom-cursor-active')")
        print('PASS cursor native fallback on keyboard/reduced motion')

        page.goto(base + '/pages/op.html')
        page.locator('#replayBtn').click()
        assert page.locator('#opOverlay').evaluate("e=>e.classList.contains('is-done')")
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#replayBtn').click()
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("!document.querySelector('#pageContent').inert")
        print('PASS opening replay and live reduced-motion interruption')

        page.goto(base + '/pages/marquee.html')
        assert page.locator('#pauseMarquee').is_disabled()
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#pauseMarquee').click()
        assert page.locator('#marqueePage').evaluate("e=>e.classList.contains('is-paused')")
        print('PASS marquee pause and motion preference changes')

        page.emulate_media(reduced_motion='reduce')
        page.goto(base + '/pages/particle-morph.html')
        page.wait_for_function("document.querySelector('#heroStatus').textContent.includes('PAUSED')")
        assert page.locator('#burstParticles').is_disabled()
        assert page.locator('#heroCanvas').evaluate('e=>e.width===Math.round(e.getBoundingClientRect().width*2)')
        before = page.locator('#heroCanvas').evaluate('e=>e.toDataURL()')
        page.locator('[data-target="ORBIT"]').click()
        assert page.locator('[data-target="ORBIT"]').get_attribute('aria-pressed') == 'true'
        after = page.locator('#heroCanvas').evaluate('e=>e.toDataURL()')
        assert before != after
        page.wait_for_timeout(150)
        assert after == page.locator('#heroCanvas').evaluate('e=>e.toDataURL()')
        page.evaluate('window.resizeSentinel = 42')
        page.set_viewport_size({'width': 375, 'height': 900})
        page.wait_for_timeout(150)
        assert page.evaluate('window.resizeSentinel') == 42
        assert page.locator('[data-target="ORBIT"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-target="RESET"]').click()
        assert page.locator('[data-target="MORPH"]').get_attribute('aria-pressed') == 'true'
        page.locator('#pauseMotion').click()
        page.wait_for_timeout(100)
        assert not page.locator('#burstParticles').is_disabled()
        page.locator('#burstParticles').click()
        page.locator('#pauseMotion').click()
        print('PASS particle targets, pause, reset, keyboard burst, DPR2 and resize state')

        page.add_init_script("""const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type,...args) {
            return type.startsWith('webgl') ? null : getContext.call(this,type,...args);
          };""")
        page.reload()
        assert page.locator('#shaderCanvas').evaluate("e=>!!e.getContext('2d')")
        assert page.locator('#shaderCanvas').locator('..').locator('.route-tag').inner_text() == 'canvas fallback'
        page.add_init_script('HTMLCanvasElement.prototype.getContext = () => null')
        page.reload()
        assert page.locator('#heroStatus').inner_text() == 'CANVAS UNAVAILABLE'
        assert page.locator('[data-target="MORPH"]').is_disabled()
        assert not errors, errors
        print('PASS WebGL/Canvas unavailable fallbacks; no uncaught JS errors')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
    thread.join()
