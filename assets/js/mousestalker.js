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
  let targetX = -100;
  let targetY = -100;
  let x = targetX;
  let y = targetY;
  let raf = 0;

  function setStatus(text) {
    status.innerHTML = `<strong>${text}</strong> · ${running ? 'bubble field active' : 'bubble field paused'}`;
  }

  function move(event) {
    if (reduceMotion.matches || coarsePointer.matches) return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!pointerSeen) {
      pointerSeen = true;
      stalker.classList.add('is-visible');
      setStatus('STALKER TRACKING');
    }
  }

  function tick() {
    if (!reduceMotion.matches && !coarsePointer.matches) {
      x += (targetX - x) * 0.075;
      y += (targetY - y) * 0.075;
      stalker.style.transform = `translate3d(${x - stalker.offsetWidth / 2}px, ${y - stalker.offsetHeight / 2}px, 0)`;
    }
    raf = requestAnimationFrame(tick);
  }

  function toggleHover(event) {
    if (event.type === 'focusin' || event.type === 'pointerenter') stalker.classList.add('is-expanded');
    else stalker.classList.remove('is-expanded');
  }

  function toggleBubbles() {
    running = !running;
    field.classList.toggle('is-paused', !running);
    bubbles.forEach((bubble) => { bubble.style.animationPlayState = running ? 'running' : 'paused'; });
    pauseButton.setAttribute('aria-pressed', String(!running));
    pauseButton.textContent = running ? 'Pause bubbles' : 'Resume bubbles';
    setStatus(running ? 'STALKER TRACKING' : 'STALKER PAUSED');
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('keydown', () => {
    stalker.classList.remove('is-visible', 'is-expanded');
    pointerSeen = false;
    setStatus('NATIVE CURSOR');
  }, { passive: true });
  window.addEventListener('blur', () => stalker.classList.remove('is-visible', 'is-expanded'));
  window.addEventListener('pointerover', (event) => {
    if (event.target.closest('a, button, #stalkerStage')) toggleHover({ type: 'pointerenter' });
  }, { passive: true });
  window.addEventListener('pointerout', (event) => {
    if (event.target.closest('a, button, #stalkerStage') && !event.relatedTarget?.closest?.('a, button, #stalkerStage')) toggleHover({ type: 'pointerleave' });
  }, { passive: true });
  pauseButton.addEventListener('click', toggleBubbles);
  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) stalker.classList.remove('is-visible', 'is-expanded');
  });
  coarsePointer.addEventListener?.('change', () => {
    if (coarsePointer.matches) stalker.classList.remove('is-visible', 'is-expanded');
  });

  if (reduceMotion.matches || coarsePointer.matches) {
    stalker.style.display = 'none';
    setStatus('NATIVE CURSOR');
  } else {
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
})();
