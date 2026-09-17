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
  let frame = 0;
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
    draw(transitionState === 'open' ? 1 : 0);
  }

  function draw(progress) {
    if (!context || !field) return;
    context.clearRect(0, 0, width, height);
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
    const start = targetOpen ? 0 : 1;
    const end = targetOpen ? 1 : 0;
    setOverlay(targetOpen, true);
    announce(targetOpen ? 'OPENING · ink spreading' : 'CLOSING · ink receding', targetOpen ? 'open' : 'closed');

    const tick = (now) => {
      const amount = clamp((now - started) / duration, 0, 1);
      const eased = targetOpen ? 1 - Math.pow(1 - amount, 3) : Math.pow(1 - amount, 3);
      phase = amount * 2.5;
      draw(start + (end - start) * eased);
      if (amount < 1) {
        animationId = requestAnimationFrame(tick);
        return;
      }
      animationId = 0;
      transitionState = targetOpen ? 'open' : 'closed';
      if (!targetOpen) setOverlay(false, false);
      else closeButton.focus({ preventScroll: true });
      announce(targetOpen ? 'OPEN · menu ready' : 'READY · Canvas 2D', targetOpen ? 'open' : 'closed');
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
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
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
    announce('READY · Canvas 2D', 'closed');
    openButton.focus({ preventScroll: true });
  }

  function keyboard(event) {
    if (event.key === 'Escape' && (transitionState === 'open' || transitionState === 'opening')) {
      event.preventDefault();
      close();
    }
    if (event.key === 'Enter' && document.activeElement === openButton) open();
  }

  function noCanvas() {
    overlay.classList.add('is-no-canvas');
    fallback.hidden = false;
    openButton.addEventListener('click', () => {
      setOverlay(true, true);
      announce('OPEN · Canvas unavailable; menu ready', 'open');
      closeButton.focus({ preventScroll: true });
    });
    closeButton.addEventListener('click', reset);
    replayButton.disabled = true;
    resetButton.addEventListener('click', reset);
    return;
  }

  try {
    context = canvas.getContext('2d', { alpha: true });
  } catch (error) {
    context = null;
  }
  if (!context) {
    noCanvas();
    return;
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  replayButton.addEventListener('click', replay);
  resetButton.addEventListener('click', reset);
  document.addEventListener('keydown', keyboard);
  window.addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener?.('change', () => draw(transitionState === 'open' ? 1 : 0));
  resize();
})();
