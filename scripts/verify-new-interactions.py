#!/usr/bin/env python3
"""Offline behavioral regressions for the advanced interaction studies."""
import importlib.util
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
from threading import Thread
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('gallery', Path(__file__).with_name('verify-gallery.py'))
assert spec is not None and spec.loader is not None
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)

# Count actual callback executions, not only scheduled handles.
INSTRUMENT = '''(() => {
  const request = window.requestAnimationFrame.bind(window);
  window.__frames = 0;
  window.requestAnimationFrame = callback => request(time => { window.__frames++; callback(time); });
  window.__hide = value => {
    Object.defineProperty(document, 'hidden', {configurable:true, get:()=>value});
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();'''


def idle(page):
    page.wait_for_timeout(100)
    before = page.evaluate('window.__frames')
    page.wait_for_timeout(180)
    assert page.evaluate('window.__frames') == before, 'rAF still running while idle/paused'


def painted(page, selector):
    assert page.locator(selector).evaluate('''c=>{
      const ctx=c.getContext('2d'); const a=ctx.getImageData(0,0,c.width,c.height).data;
      for(let i=0;i<a.length;i+=4) if(a[i]+a[i+1]+a[i+2]>0) return true;
      return false;
    }'''), f'blank canvas: {selector}'


def run(base):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce', device_scale_factor=2)
        context.route('https://**/*', lambda route: route.abort())
        context.add_init_script(INSTRUMENT)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        page.goto(base + '/pages/mousestalker.html')
        idle(page)
        assert page.locator('#pauseBubbles').is_disabled()
        page.emulate_media(reduced_motion='no-preference')
        page.wait_for_function("!document.querySelector('#pauseBubbles').disabled")
        page.mouse.move(500, 400)
        page.wait_for_function("document.querySelector('#mouse-stalker').classList.contains('is-visible')")
        assert page.locator('#mouse-stalker').evaluate("e=>getComputedStyle(e).display!=='none'")
        page.wait_for_timeout(1500)
        idle(page)
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.mouse.move(530, 430)
        page.wait_for_function("document.querySelector('#mouse-stalker').classList.contains('is-visible')")
        page.keyboard.press('Tab')
        assert not page.locator('#mouse-stalker').evaluate("e=>e.classList.contains('is-visible')")
        page.locator('#pauseBubbles').click()
        assert page.locator('#pauseBubbles').get_attribute('aria-pressed') == 'true'
        assert page.locator('.bubble').evaluate_all("es=>es.every(e=>getComputedStyle(e).animationPlayState==='paused')")
        page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        page.mouse.move(510, 400)
        page.wait_for_function("document.querySelector('#mouse-stalker').classList.contains('is-visible')")
        page.emulate_media(reduced_motion='reduce')
        idle(page)
        print('PASS mousestalker preference recovery, blur/keyboard, pause, idle rAF, lifecycle')

        for name, canvas, pause, reset in [
            ('flowmap', '#flowmap-canvas', '#pause-button', '#reset-button'),
            ('fluid-xray', '#fluidCanvas', '#pauseButton', '#resetButton'),
        ]:
            page.goto(base + f'/pages/{name}.html')
            painted(page, canvas)
            idle(page)
            page.locator(canvas).focus()
            page.keyboard.press('ArrowRight' if name == 'flowmap' else 'Enter')
            painted(page, canvas)
            page.set_viewport_size({'width': 375, 'height': 850})
            page.wait_for_function("selector=>{const c=document.querySelector(selector);return Math.abs(c.width-c.getBoundingClientRect().width*2)<2}", arg=canvas)
            painted(page, canvas)
            page.locator(reset).click()
            painted(page, canvas)
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_timeout(100)
            assert page.locator(pause).get_attribute('aria-pressed') == 'false', f'{name}: preference recovery stayed paused'
            assert not page.locator(pause).is_disabled()
            page.locator(canvas).scroll_into_view_if_needed()
            before = page.evaluate('window.__frames')
            page.wait_for_timeout(150)
            assert page.evaluate('window.__frames') > before, f'{name}: resume did not start'
            page.evaluate('__hide(true)')
            idle(page)
            page.evaluate('__hide(false)')
            page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
            idle(page)
            page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
            before = page.evaluate('window.__frames')
            page.wait_for_timeout(150)
            assert page.evaluate('window.__frames') > before, f'{name}: pageshow did not resume'
            page.emulate_media(reduced_motion='reduce')
            idle(page)
            if name in ('flowmap', 'fluid-xray'):
                assert page.locator(pause).is_disabled()
                page.locator(canvas).focus()
                page.keyboard.press('Space' if name == 'flowmap' else 'p')
                idle(page)
                page.emulate_media(reduced_motion='no-preference')
                page.wait_for_function("s=>document.querySelector(s).getAttribute('aria-pressed')==='false'", arg=pause)
                before = page.evaluate('window.__frames')
                page.wait_for_timeout(150)
                assert page.evaluate('window.__frames') > before, 'fluid-xray: live preference recovery did not start'
                page.locator(pause).click()
                idle(page)
                page.emulate_media(reduced_motion='reduce')
                idle(page)
                page.emulate_media(reduced_motion='no-preference')
                page.wait_for_function("s=>!document.querySelector(s).disabled", arg=pause)
                assert page.locator(pause).get_attribute('aria-pressed') == 'true', 'fluid-xray: lost explicit user pause'
                idle(page)
                page.emulate_media(reduced_motion='reduce')
            page.set_viewport_size({'width': 1280, 'height': 900})
            print(f'PASS {name} keyboard, paused resize/DPR2, reset, resume, hidden/page lifecycle, preference recovery')

        page.goto(base + '/pages/ink-bleed.html')
        page.locator('#openButton').click()
        page.wait_for_function("document.activeElement.id==='closeButton'")
        page.keyboard.press('Shift+Tab')
        assert page.evaluate("document.activeElement.closest('.ink-overlay')!==null")
        page.keyboard.press('Escape')
        page.wait_for_function("document.activeElement.id==='openButton'")
        page.emulate_media(reduced_motion='no-preference')
        page.locator('#openButton').click()
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("document.activeElement.id==='closeButton'")
        idle(page)
        page.keyboard.press('Escape')
        print('PASS ink modal focus trap/return and interrupted reduced motion')

        page.goto(base + '/pages/noise-reveal.html')
        page.locator('#nextButton').focus()
        page.keyboard.press('Space')
        painted(page, '#revealCanvas')
        page.locator('#resetButton').click()
        painted(page, '#revealCanvas')
        idle(page)
        page.emulate_media(reduced_motion='no-preference')
        page.wait_for_timeout(50)
        page.locator('#replayButton').click()
        page.wait_for_timeout(100)
        page.locator('#pauseButton').click()
        frozen = page.locator('#progressDetail').inner_text()
        page.wait_for_timeout(100)
        assert page.locator('#progressDetail').inner_text() == frozen
        page.locator('#pauseButton').click()
        page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
        page.wait_for_timeout(50)
        frozen = page.locator('#progressDetail').inner_text()
        page.wait_for_timeout(100)
        assert page.locator('#progressDetail').inner_text() == frozen
        page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        page.wait_for_function("document.querySelector('#progressDetail').textContent==='threshold resolved / copies aligned'")
        print('PASS noise keyboard activation, pause/resume/completion, page lifecycle, static reset')

        for fallback in (False, True):
            test = context.new_page()
            test.on('pageerror', lambda error: errors.append(str(error)))
            if fallback: test.add_init_script('document.startViewTransition = undefined')
            test.goto(base + '/pages/view-transition.html')
            test.locator('.project-card').nth(2).click()
            test.wait_for_function("document.activeElement.id==='detailTitle'")
            assert 'Warmth' in test.locator('#detailTitle').inner_text()
            test.keyboard.press('Escape')
            test.wait_for_function("document.querySelector('#detailPanel').hidden")
            assert test.locator('.project-card').nth(2).evaluate('e=>e===document.activeElement')
            test.emulate_media(reduced_motion='no-preference')
            test.locator('.project-card').first.click()
            test.wait_for_function("!document.querySelector('#detailPanel').hidden")
            test.evaluate("document.querySelector('#closeButton').click();document.querySelectorAll('.project-card')[4].click()")
            test.wait_for_timeout(1000)
            assert not test.locator('#detailPanel').evaluate('e=>e.hidden')
            assert 'Quiet repetition' in test.locator('#detailTitle').inner_text()
            test.locator('#replayButton').click()
            test.wait_for_timeout(700)
            test.locator('#closeButton').click()
            test.wait_for_function("document.querySelector('#detailPanel').hidden")
            test.close()
            print(f'PASS view-transition fallback={fallback} focus/close/reopen race/replay')

        for fallback in (False, True):
            test = context.new_page()
            test.on('pageerror', lambda error: errors.append(str(error)))
            if fallback:
                test.add_init_script("const supports=CSS.supports.bind(CSS);CSS.supports=(...args)=>args.some(x=>String(x).includes('animation-timeline'))?false:supports(...args)")
            test.goto(base + '/pages/scroll-timeline.html')
            test.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
            test.wait_for_timeout(150)
            assert int(test.locator('#scroll-progress').get_attribute('aria-valuenow') or '-1') >= 99
            test.emulate_media(reduced_motion='no-preference')
            test.emulate_media(reduced_motion='reduce')
            test.wait_for_timeout(100)
            assert int(test.locator('#scroll-progress').get_attribute('aria-valuenow') or '-1') >= 99
            assert test.locator('[data-scroll-reveal]').evaluate_all("es=>es.every(e=>getComputedStyle(e).opacity==='1')")
            test.close()
            print(f'PASS scroll-timeline fallback={fallback} semantic progress/reduced-motion content')

        for name, selector in [('flowmap','#canvas-fallback'), ('fluid-xray','#canvasFallback'), ('noise-reveal','#canvasFallback'), ('ink-bleed','#inkFallback')]:
            for throws in (False, True):
                test = context.new_page()
                test.on('pageerror', lambda error: errors.append(str(error)))
                test.add_init_script("HTMLCanvasElement.prototype.getContext=function(){" + ("throw new Error('forced renderer failure')" if throws else 'return null') + "}")
                test.goto(base + f'/pages/{name}.html')
                if name == 'ink-bleed': test.locator('#openButton').click()
                assert test.locator(selector).is_visible(), (name, throws)
                if name == 'ink-bleed':
                    test.keyboard.press('Escape')
                    test.wait_for_function("document.activeElement.id==='openButton'")
                test.close()
            print(f'PASS {name} null/throw Canvas fallback')
        assert not errors, errors
        context.close()
        browser.close()
        print('Advanced interaction regressions PASS; no uncaught JS errors')


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(gallery.QuietHandler, directory=str(gallery.ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        run(f'http://127.0.0.1:{server.server_port}')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
