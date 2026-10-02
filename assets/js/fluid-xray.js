(() => {
  'use strict';

  const canvas = document.getElementById('fluidCanvas');
  const fallback = document.getElementById('canvasFallback');
  const status = document.getElementById('status');
  const modeLabel = document.getElementById('modeLabel');
  const revealButton = document.getElementById('revealButton');
  const pauseButton = document.getElementById('pauseButton');
  const resetButton = document.getElementById('resetButton');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!canvas || !fallback || !status || !modeLabel || !revealButton || !pauseButton || !resetButton) return;

  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (error) { ctx = null; }
  if (!ctx) {
    canvas.hidden = true;
    fallback.hidden = false;
    revealButton.disabled = true;
    pauseButton.disabled = true;
    resetButton.disabled = true;
    status.textContent = 'CANVAS UNAVAILABLE · READABLE FALLBACK';
    return;
  }

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const field = { width: 96, height: 64, density: null, next: null };
  const pointer = { active: false, x: 0, y: 0, previousX: 0, previousY: 0 };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let userPaused = false;
  let paused = reducedMotion.matches;
  let revealed = false;
  let revealEnergy = 0;
  let lastFrame = 0;
  let frameId = 0;
  let pageActive = true;
  let inView = true;
  let elapsedTime = 0;
  let simulationTime = 0;

  function index(x, y) { return y * field.width + x; }

  function clearField() {
    field.density.fill(0);
    field.next.fill(0);
  }

  function inject(x, y, amount, radius) {
    const gx = clamp(Math.round(x / width * (field.width - 1)), 0, field.width - 1);
    const gy = clamp(Math.round(y / height * (field.height - 1)), 0, field.height - 1);
    const rx = Math.max(1, Math.ceil(radius / width * field.width));
    const ry = Math.max(1, Math.ceil(radius / height * field.height));
    for (let iy = Math.max(0, gy - ry); iy <= Math.min(field.height - 1, gy + ry); iy += 1) {
      for (let ix = Math.max(0, gx - rx); ix <= Math.min(field.width - 1, gx + rx); ix += 1) {
        const distance = Math.hypot((ix - gx) / rx, (iy - gy) / ry);
        if (distance <= 1) {
          const falloff = (1 - distance) ** 2;
          field.density[index(ix, iy)] = clamp(field.density[index(ix, iy)] + amount * falloff, 0, 1);
        }
      }
    }
  }

  function seedReveal() {
    revealed = true;
    revealEnergy = Math.max(revealEnergy, .82);
    const centerX = width * .5;
    const centerY = height * .5;
    inject(centerX, centerY, .9, Math.min(width, height) * .2);
    inject(width * .28, height * .38, .75, Math.min(width, height) * .13);
    inject(width * .72, height * .62, .75, Math.min(width, height) * .13);
    status.textContent = paused ? 'X-RAY LAYER · PAUSED' : 'X-RAY LAYER · FIELD ACTIVE';
    modeLabel.textContent = 'SOLID / X-RAY';
    if (paused) draw(performance.now());
  }

  function reset() {
    clearField();
    revealed = false;
    revealEnergy = 0;
    status.textContent = paused ? 'SOLID SURFACE · PAUSED' : 'SOLID SURFACE · TRACKING READY';
    modeLabel.textContent = 'SOLID / X-RAY';
    if (paused) draw(performance.now());
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  function diffuse() {
    for (let y = 0; y < field.height; y += 1) {
      for (let x = 0; x < field.width; x += 1) {
        const left = field.density[index(Math.max(0, x - 1), y)];
        const right = field.density[index(Math.min(field.width - 1, x + 1), y)];
        const up = field.density[index(x, Math.max(0, y - 1))];
        const down = field.density[index(x, Math.min(field.height - 1, y + 1))];
        const current = field.density[index(x, y)];
        field.next[index(x, y)] = clamp(lerp(current, (left + right + up + down) * .25, .32) * .982, 0, 1);
      }
    }
    const swap = field.density;
    field.density = field.next;
    field.next = swap;
  }

  function drawGrid(targetCtx, alpha) {
    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.strokeStyle = '#7fffe0';
    targetCtx.lineWidth = 1;
    const step = Math.max(30, Math.min(58, width / 15));
    for (let x = step * .5; x < width; x += step) {
      targetCtx.beginPath(); targetCtx.moveTo(x, 0); targetCtx.lineTo(x, height); targetCtx.stroke();
    }
    for (let y = step * .5; y < height; y += step) {
      targetCtx.beginPath(); targetCtx.moveTo(0, y); targetCtx.lineTo(width, y); targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function drawCircuit(targetCtx, alpha) {
    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.strokeStyle = '#c8f36a';
    targetCtx.fillStyle = '#c8f36a';
    targetCtx.lineWidth = 1.3;
    const columns = 7;
    const rows = 4;
    for (let row = 0; row < rows; row += 1) {
      const y = height * (.28 + row * .15);
      targetCtx.beginPath();
      targetCtx.moveTo(width * .12, y);
      targetCtx.lineTo(width * .27, y);
      targetCtx.lineTo(width * .32, y + (row % 2 ? 15 : -15));
      targetCtx.lineTo(width * .55, y + (row % 2 ? 15 : -15));
      targetCtx.lineTo(width * .62, y);
      targetCtx.lineTo(width * .88, y);
      targetCtx.stroke();
    }
    for (let col = 0; col < columns; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        const x = width * (.2 + col * .1);
        const y = height * (.28 + row * .15) + (row % 2 ? 0 : -15);
        targetCtx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    targetCtx.restore();
  }

  function draw(now) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#132b21');
    gradient.addColorStop(.5, '#0b1e18');
    gradient.addColorStop(1, '#07120f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const pad = Math.min(width, height) * .09;
    ctx.fillStyle = '#10271f';
    ctx.strokeStyle = '#38634c';
    ctx.lineWidth = 1;
    ctx.fillRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    drawGrid(ctx, .08 + revealEnergy * .15);
    drawCircuit(ctx, .16 + revealEnergy * .7);

    // The shell is painted as field-sized tiles: each tile's opacity comes from
    // the diffused density, so the reveal is a real spatial mask rather than a
    // single cross-fade over the whole panel.
    ctx.save();
    const tileW = width / field.width;
    const tileH = height / field.height;
    for (let y = 0; y < field.height; y += 1) {
      for (let x = 0; x < field.width; x += 1) {
        const density = field.density[index(x, y)];
        const mask = clamp(density * 2.15 + revealEnergy * .03, 0, 1);
        const alpha = Math.max(.08, 1 - mask) * .92;
        ctx.fillStyle = `rgba(23, 53, 41, ${alpha})`;
        ctx.fillRect(x * tileW, y * tileH, tileW + .5, tileH + .5);
      }
    }
    ctx.strokeStyle = `rgba(110, 142, 102, ${Math.max(.12, 1 - revealEnergy * .68)})`;
    ctx.strokeRect(pad + 10, pad + 10, width - pad * 2 - 20, height - pad * 2 - 20);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = .95;
    ctx.fillStyle = '#ffb56b';
    ctx.font = `600 ${Math.max(11, Math.min(17, width / 45))}px "SFMono-Regular", Consolas, monospace`;
    ctx.letterSpacing = '2px';
    ctx.fillText('MATERIAL / 04', pad + 26, pad + 45);
    ctx.fillStyle = '#8ca69a';
    ctx.font = `${Math.max(10, Math.min(13, width / 58))}px "SFMono-Regular", Consolas, monospace`;
    ctx.fillText('PRESSURE MAP', pad + 26, height - pad - 30);
    if (width > 520) ctx.fillText('SIMULATED MATERIAL', width - pad - 190, height - pad - 30);
    ctx.restore();

    // A low-resolution field is expanded as translucent radial sprites. This keeps the
    // mask fluid-looking while avoiding expensive full-resolution pixel simulation.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < field.height; y += 2) {
      for (let x = 0; x < field.width; x += 2) {
        const amount = field.density[index(x, y)];
        if (amount < .015) continue;
        const px = x / (field.width - 1) * width;
        const py = y / (field.height - 1) * height;
        const radius = 8 + amount * Math.min(width, height) * .18;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, radius);
        glow.addColorStop(0, `rgba(127,255,224,${amount * .3})`);
        glow.addColorStop(.65, `rgba(127,255,224,${amount * .1})`);
        glow.addColorStop(1, 'rgba(127,255,224,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      }
    }
    ctx.restore();

    if (revealed) {
      ctx.save();
      ctx.globalAlpha = .45 + revealEnergy * .25;
      ctx.strokeStyle = '#7fffe0';
      ctx.lineWidth = 1;
      const pulse = 1 + Math.sin(now * .002) * .03;
      ctx.beginPath();
      ctx.arc(width * .5, height * .5, Math.min(width, height) * .28 * pulse, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function tick(now) {
    frameId = 0;
    if (paused || document.hidden || !inView || !pageActive) return;
    const elapsed = Math.min(50, Math.max(0, now - lastFrame));
    lastFrame = now;
    elapsedTime += elapsed;
    while (elapsedTime >= 1000 / 60) {
      diffuse();
      elapsedTime -= 1000 / 60;
    }
    simulationTime += elapsed;
    revealEnergy = Math.max(0, revealEnergy * Math.pow(.994, elapsed / (1000 / 60)));
    if (revealed && revealEnergy < .015) {
      revealed = false;
      status.textContent = 'SOLID SURFACE · TRACKING READY';
    }
    draw(simulationTime);
    frameId = window.requestAnimationFrame(tick);
  }

  function positionFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, 0, width), y: clamp(event.clientY - rect.top, 0, height) };
  }

  function startPointer(event) {
    if (!event.isPrimary || event.button !== 0) return;
    const point = positionFromEvent(event);
    pointer.active = true;
    pointer.x = pointer.previousX = point.x;
    pointer.y = pointer.previousY = point.y;
    canvas.setPointerCapture?.(event.pointerId);
    inject(point.x, point.y, .42, Math.min(width, height) * .1);
    revealed = true;
    revealEnergy = Math.max(revealEnergy, .42);
    status.textContent = paused ? 'X-RAY LAYER · PAUSED' : 'X-RAY LAYER · TRACKING';
    if (paused) draw(simulationTime);
  }

  function movePointer(event) {
    if (!pointer.active || !event.isPrimary) return;
    const point = positionFromEvent(event);
    const distance = Math.hypot(point.x - pointer.previousX, point.y - pointer.previousY);
    inject(point.x, point.y, .18 + Math.min(.35, distance / Math.max(width, height)), Math.min(width, height) * .075);
    pointer.x = point.x; pointer.y = point.y;
    pointer.previousX = point.x; pointer.previousY = point.y;
    revealed = true;
    revealEnergy = Math.max(revealEnergy, .42);
    status.textContent = paused ? 'X-RAY LAYER · PAUSED' : 'X-RAY LAYER · TRACKING';
    if (paused) draw(performance.now());
  }

  function endPointer(event) {
    pointer.active = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function updatePauseState() {
    paused = userPaused || reducedMotion.matches;
    pauseButton.disabled = reducedMotion.matches;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    status.textContent = paused ? (revealed ? 'X-RAY LAYER · PAUSED' : 'SOLID SURFACE · PAUSED') : (revealed ? 'X-RAY LAYER · FIELD ACTIVE' : 'SOLID SURFACE · TRACKING READY');
    syncLoop();
  }

  function togglePause() {
    if (reducedMotion.matches) return;
    userPaused = !userPaused;
    updatePauseState();
  }

  canvas.addEventListener('pointerdown', startPointer);
  canvas.addEventListener('pointermove', movePointer);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', () => { pointer.active = false; });
  revealButton.addEventListener('click', seedReveal);
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', reset);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); seedReveal(); }
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); }
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); }
  });
  reducedMotion.addEventListener?.('change', updatePauseState);
  window.addEventListener('resize', resize, { passive: true });
  function syncLoop() {
    cancelAnimationFrame(frameId); frameId = 0;
    pointer.active = false;
    if (!paused && !document.hidden && inView && pageActive) {
      lastFrame = performance.now();
      frameId = requestAnimationFrame(tick);
    }
  }
  document.addEventListener('visibilitychange', syncLoop);
  window.addEventListener('pagehide', () => { pageActive = false; syncLoop(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncLoop(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting; syncLoop();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);

  field.density = new Float32Array(field.width * field.height);
  field.next = new Float32Array(field.width * field.height);
  resize();
  reset();
  updatePauseState();
})();
