(() => {
  'use strict';

  const stalker = document.querySelector('#mouse-stalker');
  const stage = document.querySelector('#stalkerStage');
  const field = document.querySelector('#bubbleField');
  const status = document.querySelector('#stalkerStatus');
  const pauseButton = document.querySelector('#pauseBubbles');
  if (!stalker || !stage || !field || !status || !pauseButton) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');
  const bubbles = Array.from({ length: 24 }, (_, index) => {
    const bubble = document.createElement('span');
    bubble.className = 'bubble';
    bubble.style.setProperty('--size', `${2 + ((index * 17) % 26)}px`);
    bubble.style.setProperty('--duration', `${5 + ((index * 11) % 35) / 10}s`);
    bubble.style.setProperty('--delay', `${-((index * 7) % 60) / 10}s`);
    bubble.style.setProperty('--drift', `${-80 + ((index * 43) % 170)}px`);
    bubble.style.left = `${3 + ((index * 37) % 94)}%`;
    field.appendChild(bubble);
    return bubble;
  });

  let running = true;
  let pointerSeen = false;
  let stageVisible = true;
  let suspended = false;
  let targetX = -100;
  let targetY = -100;
  let x = targetX;
  let y = targetY;
  let raf = 0;
  let lastFrame = 0;

  function enabled() {
    return !reduceMotion.matches && !coarsePointer.matches && !document.hidden && !suspended;
  }

  function setStatus() {
    const message = pointerSeen && enabled() ? 'STALKER TRACKING' : 'NATIVE CURSOR';
    const bubbleState = reduceMotion.matches ? 'reduced motion' : !running ? 'paused' : !stageVisible || document.hidden || suspended ? 'idle' : 'active';
    const text = `${message} · bubble field ${bubbleState}`;
    if (status.textContent !== text) status.textContent = text;
  }

  function hide() {
    pointerSeen = false;
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    stalker.classList.remove('is-visible', 'is-expanded');
    setStatus();
  }

  function sync() {
    if (!enabled()) hide();
    const animate = running && !reduceMotion.matches && !document.hidden && !suspended && stageVisible;
    bubbles.forEach(bubble => { bubble.style.animationPlayState = animate ? 'running' : 'paused'; });
    pauseButton.disabled = reduceMotion.matches;
    pauseButton.setAttribute('aria-pressed', String(!running || reduceMotion.matches));
    pauseButton.textContent = reduceMotion.matches ? 'Reduced motion' : running ? 'Pause bubbles' : 'Resume bubbles';
    setStatus();
  }

  function place() {
    stalker.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }

  function tick(time) {
    raf = 0;
    if (!enabled() || !pointerSeen) return;
    const elapsed = lastFrame ? Math.min(50, time - lastFrame) : 1000 / 60;
    lastFrame = time;
    const blend = 1 - Math.pow(1 - 0.075, elapsed / (1000 / 60));
    x += (targetX - x) * blend;
    y += (targetY - y) * blend;
    const moving = Math.hypot(targetX - x, targetY - y) > .1;
    if (!moving) { x = targetX; y = targetY; lastFrame = 0; }
    place();
    if (moving) raf = requestAnimationFrame(tick);
  }

  function move(event) {
    if (!enabled() || event.pointerType === 'touch') return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!pointerSeen) {
      pointerSeen = true;
      x = targetX; y = targetY;
      place();
      stalker.classList.add('is-visible');
      setStatus();
    }
    stalker.classList.toggle('is-expanded', !!event.target.closest?.('a, button, #stalkerStage'));
    if (!raf) raf = requestAnimationFrame(tick);
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('keydown', hide);
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); });
  window.addEventListener('blur', hide);
  pauseButton.addEventListener('click', () => { running = !running; sync(); });
  reduceMotion.addEventListener('change', sync);
  coarsePointer.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { suspended = true; hide(); sync(); });
  window.addEventListener('pageshow', () => { suspended = false; sync(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      stageVisible = entries[0].isIntersecting;
      sync();
    });
    observer.observe(stage);
  }
  sync();
})();
