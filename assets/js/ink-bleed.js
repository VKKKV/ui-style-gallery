(() => {
  'use strict';

  const overlay = document.getElementById('inkOverlay');
  const canvas = document.getElementById('inkCanvas');
  const menu = document.getElementById('inkMenu');
  const fallback = document.getElementById('inkFallback');
  const openButton = document.getElementById('openButton');
  const closeButton = document.getElementById('closeButton');
  const replayButton = document.getElementById('replayButton');
  const resetButton = document.getElementById('resetButton');
  const live = document.getElementById('inkLive');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let context = null;
  let currentProgress = 0;
  let animationId = 0;
  let transitionState = 'closed';
  let previousFocus = openButton;
  let field = null;
  let width = 0;
  let height = 0;
  let gridWidth = 0;
  let gridHeight = 0;
  let phase = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function announce(message, state) {
    live.textContent = message;
    live.dataset.state = state || '';
  }

  function setOverlay(open, visible) {
    overlay.classList.toggle('is-visible', visible);
    overlay.classList.toggle('is-revealed', open);
    overlay.setAttribute('aria-hidden', String(!visible));
    overlay.inert = !visible;
    document.querySelector('.ink-page').inert = visible;
    document.body.style.overflow = visible ? 'hidden' : '';
    if (visible) menu.removeAttribute('inert');
    else menu.inert = true;
  }

  function makeField() {
    const total = gridWidth * gridHeight;
    field = new Float32Array(total);
    for (let index = 0; index < total; index += 1) {
      // Seeded-looking spatial variation keeps each edge irregular without a random loop.
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      field[index] = ((x * 17 + y * 31 + x * y * 7) % 101) / 101;
    }
  }

  function resize() {
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    gridWidth = clamp(Math.ceil(width / 10), 42, 120);
    gridHeight = clamp(Math.ceil(height / 10), 30, 90);
    makeField();
    draw(currentProgress);
  }

  function draw(progress) {
    currentProgress = progress;
    if (!context || !field) return;
    context.clearRect(0, 0, width, height);
    if (progress <= 0) return;
    context.fillStyle = 'oklch(21% .025 52)';
    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;
    const reach = progress * (gridWidth + gridHeight) * 1.05;

    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const index = y * gridWidth + x;
        const diagonal = (x * .92 + y * 1.08) / 2;
        const jitter = (field[index] - .5) * 5.4 + Math.sin((x + phase) * .31) * .7;
        if (diagonal < reach + jitter) {
          const bleed = clamp((reach + jitter - diagonal) / 7, 0, 1);
          const dot = cellWidth * (.52 + field[index] * .78) * (1 + bleed * .45);
          const left = x * cellWidth - dot * .5;
          const top = y * cellHeight - dot * .5;
          context.globalAlpha = .74 + field[index] * .22;
          context.fillRect(left, top, dot, dot);
          // Sparse satellite droplets sell the capillary spread at the boundary.
          if (bleed > .05 && field[index] > .72 && (x + y) % 3 === 0) {
            context.globalAlpha = .35;
            context.beginPath();
            context.arc(left + dot * 1.8, top + dot * .25, dot * .28, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
    }
    context.globalAlpha = 1;
  }

  function stop() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
  }

  function animate(targetOpen, instant) {
    stop();
    transitionState = targetOpen ? 'opening' : 'closing';
    phase = 0;
    const started = performance.now();
    const duration = instant || reducedMotion.matches ? 1 : (targetOpen ? 1250 : 950);
    const finish = () => {
      stop();
      transitionState = targetOpen ? 'open' : 'closed';
      draw(0);
      setOverlay(targetOpen, targetOpen);
      if (targetOpen) closeButton.focus({ preventScroll: true });
      else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      announce(targetOpen ? 'OPEN · menu ready' : context ? 'READY · Canvas 2D' : 'READY · Canvas unavailable', targetOpen ? 'open' : 'closed');
    };
    setOverlay(targetOpen, true);
    announce(targetOpen ? 'OPENING · ink spreading' : 'CLOSING · ink receding', targetOpen ? 'open' : 'closed');

    if (instant || reducedMotion.matches || !context || document.hidden) { finish(); return; }
    closeButton.focus({ preventScroll: true });
    const tick = (now) => {
      const amount = clamp((now - started) / duration, 0, 1);
      phase = amount * 2.5;
      draw(Math.sin(amount * Math.PI));
      if (amount < 1) {
        animationId = requestAnimationFrame(tick);
        return;
      }
      finish();
    };
    animationId = requestAnimationFrame(tick);
  }

  function open() {
    if (transitionState === 'open' || transitionState === 'opening') return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    animate(true, false);
  }

  function close() {
    if (transitionState === 'closed' || transitionState === 'closing') return;
    animate(false, false);
    // Restore focus only after the modal is no longer inerting the page.
  }

  function replay() {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    animate(true, false);
  }

  function reset() {
    stop();
    transitionState = 'closed';
    setOverlay(false, false);
    draw(0);
    announce(context ? 'READY · Canvas 2D' : 'READY · Canvas unavailable', 'closed');
    openButton.focus({ preventScroll: true });
  }

  function keyboard(event) {
    if (event.key === 'Escape' && (transitionState === 'open' || transitionState === 'opening')) {
      event.preventDefault();
      close();
    }
    if (event.key === 'Tab' && overlay.classList.contains('is-visible')) {
      const items = [...menu.querySelectorAll('button, a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function noCanvas() {
    overlay.classList.add('is-no-canvas');
    fallback.hidden = false;
    announce('READY · Canvas unavailable', 'closed');
  }

  try {
    context = canvas.getContext('2d', { alpha: true });
  } catch (error) {
    context = null;
  }
  if (!context) {
    noCanvas();
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  replayButton.addEventListener('click', replay);
  resetButton.addEventListener('click', reset);
  document.addEventListener('keydown', keyboard);
  window.addEventListener('resize', resize, { passive: true });
  function settle() {
    if (transitionState === 'opening' || transitionState === 'closing') animate(transitionState === 'opening', true);
  }
  reducedMotion.addEventListener?.('change', () => { if (reducedMotion.matches) settle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  window.addEventListener('pagehide', settle);
  window.addEventListener('pageshow', resize);
  resize();
})();
