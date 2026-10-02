(() => {
  'use strict';

  const canvas = document.getElementById('revealCanvas');
  const fallback = document.getElementById('canvasFallback');
  const nextButton = document.getElementById('nextButton');
  const replayButton = document.getElementById('replayButton');
  const pauseButton = document.getElementById('pauseButton');
  const resetButton = document.getElementById('resetButton');
  const status = document.getElementById('status');
  const sceneName = document.getElementById('sceneName');
  const progressLabel = document.getElementById('progressLabel');
  const progressDetail = document.getElementById('progressDetail');
  const fallbackCopy = document.getElementById('fallbackCopy');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [
    { name: 'Signal', detail: 'grid / waveform / rings', hue: 0 },
    { name: 'Orbit', detail: 'radar / nodes / arc', hue: 1 },
    { name: 'Archive', detail: 'bars / type / scanline', hue: 2 }
  ];
  let context;
  let sceneIndex = 0;
  let startedAt = 0;
  let pausedAt = 0;
  let paused = true;
  let suspended = false;
  let suspendedAt = 0;
  let inView = true;
  let pageHidden = false;
  let raf = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  function setStatus(text) {
    status.textContent = text;
  }

  function randomNoise(x, y, seed) {
    // Integer hash: stable, cheap block noise without an image or external asset.
    let n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(reduceMotion.matches ? 1 : paused ? pausedAt : progress());
  }

  function progress(now = performance.now()) {
    if (reduceMotion.matches) return 1;
    if (paused) return pausedAt;
    return Math.min(1, Math.max(0, ((suspended ? suspendedAt : now) - startedAt) / 1900));
  }

  function resetClock(complete = false) {
    startedAt = suspended ? suspendedAt : performance.now();
    pausedAt = complete ? 1 : 0;
    paused = complete || reduceMotion.matches;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.disabled = reduceMotion.matches;
  }

  function selectScene(index, autoplay = true) {
    sceneIndex = (index + scenes.length) % scenes.length;
    const scene = scenes[sceneIndex];
    sceneName.textContent = scene.name;
    canvas.setAttribute('aria-label', `${scene.name}: procedural ${scene.detail} composition revealed through threshold noise`);
    progressLabel.textContent = `Scene ${String(sceneIndex + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    fallbackCopy.textContent = `${scene.name} is a procedural ${scene.detail} composition revealed by a noise threshold. Canvas is unavailable, so the description remains the readable fallback.`;
    if (autoplay) resetClock(false);
    setStatus(reduceMotion.matches ? 'Complete · reduced motion' : autoplay ? 'Transitioning · color offset active' : 'Ready · press NEXT');
    draw(reduceMotion.matches ? 1 : progress());
  }

  function drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#101922');
    gradient.addColorStop(.5, '#090c12');
    gradient.addColorStop(1, '#17101b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(132, 176, 190, .10)';
    ctx.lineWidth = 1;
    const gap = Math.max(28, Math.round(width / 24));
    for (let x = gap / 2; x < width; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = gap / 2; y < height; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  function drawSignal(ctx, offsetX, offsetY, alpha) {
    const cx = width * .5 + offsetX;
    const cy = height * .51 + offsetY;
    const radius = Math.min(width, height) * .22;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#55e7ed';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, radius * .58, -.35, Math.PI * 1.2); ctx.stroke();
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(-radius * 1.2, 0); ctx.lineTo(radius * 1.2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -radius * 1.2); ctx.lineTo(0, radius * 1.2); ctx.stroke();
    ctx.strokeStyle = '#ff4f9a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -radius * 1.25; x <= radius * 1.25; x += 3) {
      const y = Math.sin(x * .035) * radius * .13 + Math.sin(x * .11) * radius * .06;
      if (x === -radius * 1.25) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbit(ctx, offsetX, offsetY, alpha) {
    const cx = width * .5 + offsetX;
    const cy = height * .5 + offsetY;
    const radius = Math.min(width, height) * .27;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(-.22);
    ctx.strokeStyle = '#55e7ed'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.25, radius * .55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#5e8dff';
    ctx.beginPath(); ctx.ellipse(0, 0, radius * .7, radius * 1.25, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 9; i += 1) {
      const angle = i * .71;
      const x = Math.cos(angle) * radius * 1.1;
      const y = Math.sin(angle) * radius * .68;
      ctx.fillStyle = i % 3 === 0 ? '#ff4f9a' : '#ffd166';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    ctx.restore();
  }

  function drawArchive(ctx, offsetX, offsetY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(offsetX, offsetY);
    const left = width * .17;
    const top = height * .22;
    ctx.strokeStyle = '#55e7ed'; ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width * .66, height * .52);
    ctx.fillStyle = '#ff4f9a';
    ctx.font = `700 ${Math.max(24, width * .075)}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillText('ARCHIVE', left + 18, top + height * .2);
    ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 8; i += 1) ctx.fillRect(left + 18, top + height * (.29 + i * .06), width * (.2 + (i % 4) * .08), 3);
    ctx.restore();
  }

  function drawArtwork(ctx, offsetX, offsetY, alpha) {
    const scene = scenes[sceneIndex];
    if (scene.hue === 0) drawSignal(ctx, offsetX, offsetY, alpha);
    else if (scene.hue === 1) drawOrbit(ctx, offsetX, offsetY, alpha);
    else drawArchive(ctx, offsetX, offsetY, alpha);
  }

  function draw(nowProgress) {
    if (!context || !width || !height) return;
    const ctx = context;
    ctx.clearRect(0, 0, width, height);
    drawBackground(ctx);
    const p = Math.min(1, Math.max(0, nowProgress));
    const aberration = (1 - p) * 18 + (p < 1 ? Math.sin(p * Math.PI) * 12 : 0);
    // Offset full-color copies converge on the unshifted artwork.
    ctx.globalCompositeOperation = 'screen';
    drawArtwork(ctx, -aberration, 0, .72);
    ctx.globalCompositeOperation = 'screen';
    drawArtwork(ctx, aberration, 0, .72);
    ctx.globalCompositeOperation = 'source-over';
    drawArtwork(ctx, 0, 0, 1);

    const block = Math.max(7, Math.round(Math.min(width, height) / 28));
    const columns = Math.ceil(width / block);
    const rows = Math.ceil(height / block);
    const seed = sceneIndex * 97 + 11;
    ctx.globalCompositeOperation = 'source-over';
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const threshold = randomNoise(column, row, seed);
        const wave = (column / columns) * .22 + (row / rows) * .12;
        if (p < 1 && threshold > p * 1.08 - wave) {
          ctx.fillStyle = threshold > .84 ? 'rgba(255, 79, 154, .82)' : threshold < .16 ? 'rgba(85, 231, 237, .72)' : 'rgba(5, 8, 12, .92)';
          ctx.fillRect(column * block, row * block, block + 1, block + 1);
        }
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    ctx.fillRect(0, Math.floor(height * (.12 + p * .72)), width, 1);
    ctx.globalCompositeOperation = 'source-over';
    progressDetail.textContent = p >= 1 ? 'threshold resolved / copies aligned' : `threshold ${Math.round(p * 100)}% / offset ${Math.round(aberration)}px`;
    if (p >= 1 && !reduceMotion.matches) {
      setStatus('Complete · color copies aligned');
    }
  }

  function animate(now) {
    raf = 0;
    if (paused || suspended) return;
    const p = progress(now);
    draw(p);
    if (!paused && p < 1) raf = requestAnimationFrame(animate);
  }

  function replay() {
    if (!context) return;
    cancelAnimationFrame(raf);
    resetClock(false);
    setStatus(reduceMotion.matches ? 'Complete · reduced motion' : 'Transitioning · color offset active');
    if (reduceMotion.matches) { draw(1); return; }
    if (!suspended) raf = requestAnimationFrame(animate);
  }

  function next() {
    selectScene(sceneIndex + 1, true);
    replay();
  }

  function togglePause() {
    if (reduceMotion.matches || !context) return;
    cancelAnimationFrame(raf);
    raf = 0;
    if (paused) {
      startedAt = (suspended ? suspendedAt : performance.now()) - pausedAt * 1900;
      paused = false;
      pauseButton.textContent = 'Pause';
      pauseButton.setAttribute('aria-pressed', 'false');
      setStatus('Transitioning · color offset active');
      if (!suspended) raf = requestAnimationFrame(animate);
    } else {
      pausedAt = progress();
      paused = true;
      pauseButton.textContent = 'Resume';
      pauseButton.setAttribute('aria-pressed', 'true');
      setStatus('Paused · press Resume');
      draw(pausedAt);
    }
  }

  function reset() {
    cancelAnimationFrame(raf);
    sceneIndex = 0;
    selectScene(0, false);
    paused = true;
    pausedAt = reduceMotion.matches ? 1 : 0;
    pauseButton.textContent = 'Resume';
    pauseButton.setAttribute('aria-pressed', 'true');
    setStatus(reduceMotion.matches ? 'Complete · reduced motion' : 'Reset · press NEXT or Replay');
    draw(pausedAt);
  }

  function canvasUnavailable() {
    cancelAnimationFrame(raf);
    context = null;
    canvas.hidden = true;
    fallback.hidden = false;
    [nextButton, replayButton, pauseButton, resetButton].forEach(button => { button.disabled = true; });
    setStatus('Canvas unavailable · readable fallback');
    progressDetail.textContent = 'procedural description available';
  }

  try {
    context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    nextButton.addEventListener('click', next);
    replayButton.addEventListener('click', replay);
    pauseButton.addEventListener('click', togglePause);
    resetButton.addEventListener('click', reset);
    window.addEventListener('resize', resize, { passive: true });
    reduceMotion.addEventListener?.('change', () => {
      cancelAnimationFrame(raf);
      paused = true;
      pausedAt = 1;
      pauseButton.textContent = 'Resume';
      pauseButton.disabled = reduceMotion.matches;
      pauseButton.setAttribute('aria-pressed', 'true');
      setStatus(reduceMotion.matches ? 'Complete · reduced motion' : 'Complete · color copies aligned');
      draw(1);
    });
    document.addEventListener('keydown', event => {
      if (!context || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.code === 'Space' && event.target.closest('button, a')) return;
      const key = event.key.toLowerCase();
      if (key === 'n') { event.preventDefault(); next(); }
      else if (key === 'r') { event.preventDefault(); replay(); }
      else if (key === 'p' || event.code === 'Space') { event.preventDefault(); togglePause(); }
      else if (key === '0') { event.preventDefault(); reset(); }
    });
    function syncSuspension() {
      const next = document.hidden || pageHidden || !inView;
      if (next === suspended) return;
      if (next) { suspendedAt = performance.now(); suspended = true; cancelAnimationFrame(raf); raf = 0; }
      else { startedAt += performance.now() - suspendedAt; suspended = false; if (!paused && progress() < 1) raf = requestAnimationFrame(animate); }
    }
    document.addEventListener('visibilitychange', syncSuspension);
    window.addEventListener('pagehide', () => { pageHidden = true; syncSuspension(); });
    window.addEventListener('pageshow', () => { pageHidden = false; syncSuspension(); resize(); });
    if (typeof IntersectionObserver === 'function') new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncSuspension(); }).observe(canvas);
    pausedAt = reduceMotion.matches ? 1 : 0;
    pauseButton.textContent = 'Resume';
    pauseButton.setAttribute('aria-pressed', 'true');
    pauseButton.disabled = reduceMotion.matches;
    selectScene(0, false);
    resize();
    if (reduceMotion.matches) draw(1);
  } catch (error) {
    canvasUnavailable();
  }
})();
