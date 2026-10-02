(() => {
  'use strict';

  const canvas = document.getElementById('flowmap-canvas');
  const fallback = document.getElementById('canvas-fallback');
  const pauseButton = document.getElementById('pause-button');
  const resetButton = document.getElementById('reset-button');
  const stateReadout = document.getElementById('state-readout');
  const velocityReadout = document.getElementById('velocity-readout');
  const fieldReadout = document.getElementById('field-readout');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!canvas || typeof canvas.getContext !== 'function') {
    if (fallback) fallback.hidden = false;
    if (canvas) canvas.hidden = true;
    return;
  }
  fallback.hidden = true;

  let context;
  try { context = canvas.getContext('2d', { alpha: false }); } catch { context = null; }
  if (!context) {
    canvas.hidden = true;
    fallback.hidden = false;
    pauseButton.disabled = resetButton.disabled = true;
    stateReadout.textContent = 'UNAVAILABLE';
    return;
  }

  const FIELD_WIDTH = 48;
  const FIELD_HEIGHT = 28;
  const DECAY = 0.94;
  const MAX_SPEED = 32;
  const field = new Float32Array(FIELD_WIDTH * FIELD_HEIGHT * 2);
  const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, active: false };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let userPaused = false;
  let paused = reduceMotion.matches;
  let raf = 0;
  let elapsed = 0;
  let simulationTime = 0;
  let inView = true;
  let pageActive = true;
  let velocity = 0;
  let lastTime = performance.now();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fieldIndex = (x, y) => (y * FIELD_WIDTH + x) * 2;

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    pointer.active = false;
    drawBackground(simulationTime); drawSpecimen(); drawField();
  }

  function clearField() {
    field.fill(0);
    velocity = 0;
    pointer.active = false;
    updateReadout();
  }

  function addImpulse(x, y, dx, dy) {
    const gx = clamp(Math.floor((x / width) * FIELD_WIDTH), 0, FIELD_WIDTH - 1);
    const gy = clamp(Math.floor((y / height) * FIELD_HEIGHT), 0, FIELD_HEIGHT - 1);
    const radius = 3;
    const magnitude = Math.min(1.2, Math.hypot(dx, dy) / 60);
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const distance = Math.hypot(ox, oy);
        if (distance > radius) continue;
        const falloff = (1 - distance / radius) * magnitude;
        const index = fieldIndex(clamp(gx + ox, 0, FIELD_WIDTH - 1), clamp(gy + oy, 0, FIELD_HEIGHT - 1));
        field[index] += dx * falloff;
        field[index + 1] += dy * falloff;
      }
    }
  }

  function advectField() {
    const next = new Float32Array(field.length);
    let total = 0;
    for (let y = 0; y < FIELD_HEIGHT; y += 1) {
      for (let x = 0; x < FIELD_WIDTH; x += 1) {
        const index = fieldIndex(x, y);
        const sampleX = clamp(Math.round(x - field[index] * 0.035), 0, FIELD_WIDTH - 1);
        const sampleY = clamp(Math.round(y - field[index + 1] * 0.035), 0, FIELD_HEIGHT - 1);
        const source = fieldIndex(sampleX, sampleY);
        next[index] = field[source] * DECAY;
        next[index + 1] = field[source + 1] * DECAY;
        total += Math.hypot(next[index], next[index + 1]);
      }
    }
    field.set(next);
    return total / (FIELD_WIDTH * FIELD_HEIGHT);
  }

  function vectorAt(x, y) {
    const gx = clamp(Math.floor((x / width) * FIELD_WIDTH), 0, FIELD_WIDTH - 1);
    const gy = clamp(Math.floor((y / height) * FIELD_HEIGHT), 0, FIELD_HEIGHT - 1);
    const index = fieldIndex(gx, gy);
    return [field[index], field[index + 1]];
  }

  function drawBackground(time) {
    context.fillStyle = '#101113';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(243, 240, 232, .06)';
    context.lineWidth = 1;
    const grid = Math.max(42, width / 13);
    for (let x = 0; x < width; x += grid) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    context.fillStyle = 'rgba(216, 255, 62, .78)';
    context.font = '11px ui-monospace, monospace';
    context.fillText('FLOW / ' + String(Math.round(time / 1000)).padStart(4, '0'), 20, height - 24);
  }

  function drawSpecimen() {
    const centerX = width * 0.5;
    const centerY = height * 0.52;
    const fontSize = clamp(width * 0.17, 60, 180);
    const label = 'DRIFT';

    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    const textWidth = context.measureText(label).width;
    const startX = centerX - textWidth / 2;
    const startY = centerY + fontSize * 0.34;
    const slices = 26;
    const sliceHeight = fontSize / slices;

    context.save();
    context.globalCompositeOperation = 'screen';
    for (let slice = 0; slice < slices; slice += 1) {
      const y = startY - fontSize * 0.82 + slice * sliceHeight;
      const [vx, vy] = vectorAt(centerX, y + sliceHeight / 2);
      const shift = clamp(vx * 0.48 + vy * 0.08, -MAX_SPEED, MAX_SPEED);
      const amount = clamp(Math.abs(vx) + Math.abs(vy), 0, 80);
      const gradient = context.createLinearGradient(startX + shift, 0, startX + textWidth + shift, 0);
      gradient.addColorStop(0, `rgba(56, 230, 255, ${0.55 + amount / 260})`);
      gradient.addColorStop(.5, 'rgba(243, 240, 232, .92)');
      gradient.addColorStop(1, `rgba(255, 63, 103, ${0.55 + amount / 260})`);
      context.fillStyle = gradient;
      context.save();
      context.beginPath();
      context.rect(0, y, width, sliceHeight + 1);
      context.clip();
      context.fillText(label, startX + shift, startY);
      context.restore();
    }

    const [vx, vy] = vectorAt(centerX, centerY);
    context.globalAlpha = .18;
    context.fillStyle = '#38e6ff';
    context.fillText(label, startX - clamp(vx * .18, -24, 24), startY + clamp(vy * .05, -12, 12));
    context.fillStyle = '#ff3f67';
    context.fillText(label, startX + clamp(vx * .18, -24, 24), startY - clamp(vy * .05, -12, 12));
    context.restore();

    context.fillStyle = 'rgba(243, 240, 232, .65)';
    context.font = '12px ui-monospace, monospace';
    context.fillText('POINTER → VECTOR FIELD', 20, 30);
  }

  function drawField() {
    context.save();
    context.globalAlpha = .2;
    context.strokeStyle = '#d8ff3e';
    context.lineWidth = 1;
    for (let y = 1; y < FIELD_HEIGHT; y += 3) {
      for (let x = 1; x < FIELD_WIDTH; x += 3) {
        const px = (x / FIELD_WIDTH) * width;
        const py = (y / FIELD_HEIGHT) * height;
        const [vx, vy] = vectorAt(px, py);
        const length = Math.hypot(vx, vy);
        if (length < 1.2) continue;
        const scale = Math.min(1.5, 18 / length);
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(px + vx * scale, py + vy * scale);
        context.stroke();
      }
    }
    context.restore();
  }

  function updateReadout(fieldStrength) {
    if (stateReadout) stateReadout.textContent = paused ? 'PAUSED' : 'LIVE';
    if (velocityReadout) velocityReadout.textContent = velocity.toFixed(2);
    if (fieldReadout) fieldReadout.textContent = `${Math.min(100, Math.round((fieldStrength || 0) * 3))}%`;
    if (pauseButton) {
      pauseButton.disabled = reduceMotion.matches;
      pauseButton.textContent = paused ? 'Resume field' : 'Pause field';
      pauseButton.setAttribute('aria-pressed', String(paused));
    }
  }

  function render(time) {
    if (paused || document.hidden || !inView || !pageActive) {
      raf = 0;
      return;
    }
    const delta = Math.min(50, time - lastTime);
    lastTime = time;
    elapsed += delta;
    while (elapsed >= 1000 / 60) {
      advectField();
      elapsed -= 1000 / 60;
    }
    simulationTime += delta;
    let total = 0;
    for (let i = 0; i < field.length; i += 2) total += Math.hypot(field[i], field[i + 1]);
    const fieldStrength = total / (FIELD_WIDTH * FIELD_HEIGHT);
    velocity *= Math.pow(.82, delta / 16.67);
    drawBackground(simulationTime);
    drawSpecimen();
    drawField();
    updateReadout(fieldStrength);
    raf = requestAnimationFrame(render);
  }

  function start() {
    if (!raf && !paused && !document.hidden && inView && pageActive) {
      lastTime = performance.now();
      raf = requestAnimationFrame(render);
    }
  }

  function positionFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const position = positionFromEvent(event);
    pointer.x = pointer.lastX = position.x;
    pointer.y = pointer.lastY = position.y;
    pointer.active = true;
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!event.isPrimary) return;
    const position = positionFromEvent(event);
    if (!pointer.active) {
      pointer.x = pointer.lastX = position.x;
      pointer.y = pointer.lastY = position.y;
      // Mouse and pen hover can seed the field without a click; touch still needs a drag.
      if (event.pointerType === 'touch') return;
      pointer.active = true;
      return;
    }
    const scale = event.pointerType === 'touch' ? 1.4 : 1;
    const dx = clamp((position.x - pointer.lastX) * scale, -40, 40);
    const dy = clamp((position.y - pointer.lastY) * scale, -40, 40);
    addImpulse(position.x, position.y, dx, dy);
    velocity = Math.min(99, Math.hypot(dx, dy));
    pointer.x = position.x; pointer.y = position.y;
    pointer.lastX = position.x; pointer.lastY = position.y;
    if (paused) {
      drawBackground(performance.now()); drawSpecimen(); drawField(); updateReadout();
    }
  }

  function handlePointerUp(event) {
    pointer.active = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function injectKeyboard(dx, dy) {
    addImpulse(width / 2, height / 2, dx, dy);
    velocity = Math.min(99, Math.hypot(dx, dy));
    if (paused) {
      drawBackground(performance.now()); drawSpecimen(); drawField(); updateReadout();
    } else start();
  }

  function updatePauseState() {
    paused = userPaused || reduceMotion.matches;
    syncLoop();
    updateReadout();
  }
  function togglePause() {
    if (reduceMotion.matches) return;
    userPaused = !userPaused;
    updatePauseState();
  }
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', () => {
    clearField();
    drawBackground(performance.now()); drawSpecimen(); drawField();
    start();
  });
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', () => { if (pointer.active) pointer.active = false; });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); togglePause();
    } else if (event.key.toLowerCase() === 'r') {
      clearField(); drawBackground(performance.now()); drawSpecimen(); drawField(); start();
    } else {
      const keyVectors = { ArrowLeft: [-18, 0], ArrowRight: [18, 0], ArrowUp: [0, -18], ArrowDown: [0, 18] };
      if (keyVectors[event.key]) { event.preventDefault(); injectKeyboard(...keyVectors[event.key]); }
    }
  });
  function syncLoop() {
    cancelAnimationFrame(raf); raf = 0;
    pointer.active = false;
    start();
  }
  document.addEventListener('visibilitychange', syncLoop);
  window.addEventListener('pagehide', () => { pageActive = false; syncLoop(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncLoop(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting; syncLoop();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  reduceMotion.addEventListener?.('change', updatePauseState);

  resize();
  drawBackground(0); drawSpecimen(); drawField();
  updatePauseState();
})();
