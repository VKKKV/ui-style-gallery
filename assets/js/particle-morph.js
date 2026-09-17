(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const glyphs = [...'·:*+x=<>/\\#@$%&'];
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const status = document.getElementById('heroStatus');
  const pause = document.getElementById('pauseMotion');
  const burstButton = document.getElementById('burstParticles');
  let paused = motion.matches;
  let targetName = 'MORPH';
  let raf = 0;
  let lastTime = null;
  let pageActive = true;
  const scenes = [];

  function textPoints(text, w, h, gap, size) {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.ceil(w));
    off.height = Math.max(1, Math.ceil(h));
    const ctx = off.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.font = `700 ${size}px "DM Mono", monospace`;
    // Fallback fonts can be wider than DM Mono, especially on narrow screens.
    const measured = ctx.measureText(text).width;
    if (measured > w * .85) ctx.font = `700 ${size * w * .85 / measured}px "DM Mono", monospace`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    const data = ctx.getImageData(0, 0, off.width, off.height).data;
    const points = [];
    for (let y = 0; y < off.height; y += gap) {
      for (let x = 0; x < off.width; x += gap) {
        if (data[(y * off.width + x) * 4 + 3] > 100) points.push({ x, y });
      }
    }
    return points.length ? points : [{ x: w / 2, y: h / 2 }];
  }

  function context2d(scene) {
    const ctx = scene.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
    return ctx;
  }

  function glyphAtlas(dpr, colors, sizes) {
    const cell = 20;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(glyphs.length * cell * dpr);
    canvas.height = Math.ceil(colors.length * sizes.length * cell * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Glyph atlas unavailable');
    ctx.scale(dpr, dpr);
    colors.forEach((color, c) => sizes.forEach((size, s) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px "DM Mono", monospace`;
      glyphs.forEach((ch, i) => ctx.fillText(ch, i * cell + 4, (c * sizes.length + s) * cell + 14));
    }));
    return (ctx, i, x, y, color = 0, size = 0) => {
      ctx.drawImage(canvas, i % glyphs.length * cell * dpr, (color * sizes.length + size) * cell * dpr,
        cell * dpr, cell * dpr, x - 4, y - 14, cell, cell);
    };
  }

  function runHero(scene) {
    const { canvas, w, h, signal } = scene;
    const ctx = context2d(scene);
    const stamp = glyphAtlas(scene.dpr, ['#71e4ff', '#a899ff'], [8, 9, 10]);
    const count = Math.min(1150, Math.max(420, Math.floor(w * h / 620)));
    const particles = Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, phase: rand(0, 7) }));
    const pointer = { active: false, x: 0, y: 0 };
    function setTarget() {
      const scale = Math.min(1, (w - 32) / 680, (h - 180) / 330);
      let targets;
      if (targetName === 'FIELD') {
        targets = particles.map((_, i) => ({ x: w * .5 + Math.cos(i * .29) * (70 + i % 12 * 8) * scale, y: h * .48 + Math.sin(i * .29) * (70 + i % 12 * 8) * scale }));
      } else if (targetName === 'ORBIT') {
        targets = particles.map((_, i) => {
          const a = i / count * Math.PI * 18, r = 25 + i % 7 * 16;
          return { x: w * .5 + Math.cos(a) * r * 2.8 * scale, y: h * .48 + Math.sin(a) * r * .8 * scale };
        });
      } else targets = textPoints('MORPH', w, h, Math.max(5, Math.floor(w / 150)), Math.min(150, w / 5));
      particles.forEach((p, i) => {
        const t = targets[Math.floor(i * targets.length / count)];
        p.tx = t.x; p.ty = t.y;
        if (paused) { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }
      });
    }
    function burst(x = w / 2, y = h / 2) {
      if (paused) return;
      particles.forEach(p => {
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
        const force = Math.max(0, 1 - d / 180) * 16;
        p.vx += dx / d * force; p.vy += dy / d * force;
      });
    }
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
    }, { signal });
    for (const event of ['pointerleave', 'pointercancel', 'pointerup']) {
      canvas.addEventListener(event, () => { pointer.active = false; }, { signal });
    }
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      burst(e.clientX - r.left, e.clientY - r.top);
    }, { signal });
    setTarget();
    return {
      setTarget, burst,
      settle() { particles.forEach(p => { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }); },
      reset() {
        particles.forEach(p => { p.x = rand(0, w); p.y = rand(0, h); p.vx = p.vy = 0; });
        setTarget();
      },
      render(now, dt) {
        ctx.clearRect(0, 0, w, h);
        // Fixed-size substeps keep spring integration stable on slow and high-refresh displays.
        let remaining = dt / (1000 / 60);
        while (remaining > 0) {
          const step = Math.min(1, remaining), damping = Math.pow(.89, step);
          particles.forEach(p => {
            p.vx += (p.tx - p.x) * .006 * step; p.vy += (p.ty - p.y) * .006 * step;
            if (pointer.active) {
              const rx = p.x - pointer.x, ry = p.y - pointer.y, d = Math.hypot(rx, ry) || 1;
              if (d < 130) {
                const f = (1 - d / 130) * .85 * step;
                p.vx += rx / d * f; p.vy += ry / d * f;
              }
            }
            p.vx *= damping; p.vy *= damping; p.x += p.vx * step; p.y += p.vy * step;
          });
          remaining -= step;
        }
        particles.forEach((p, i) => {
          ctx.globalAlpha = .35 + .45 * (Math.sin(now * .0014 + p.phase) * .5 + .5);
          stamp(ctx, i, p.x, p.y, i % 11 === 0 ? 1 : 0, i % 3);
        });
        ctx.globalAlpha = 1;
      }
    };
  }

  function miniText(scene, label, color, mode) {
    const { w, h } = scene, ctx = context2d(scene);
    const pts = textPoints(label, w, h, Math.max(5, Math.floor(w / 90)), Math.min(72, w / 4));
    const count = Math.min(pts.length, 600);
    const particles = Array.from({ length: count }, (_, i) => ({ x: rand(0, w), y: rand(0, h), t: pts[Math.floor(i * pts.length / count)], p: rand(0, 7) }));
    const stamp = mode === 'atlas' ? glyphAtlas(scene.dpr, [color], [10]) : null;
    return { render(now) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      particles.forEach((p, i) => {
        // A cosine cycle returns smoothly instead of jumping at the modulo boundary.
        const k = paused ? 1 : ease((1 - Math.cos(now * .0007 + p.p / 8)) / 2);
        const x = lerp(p.x, p.t.x, k), y = lerp(p.y, p.t.y, k);
        ctx.globalAlpha = .35 + .55 * Math.sin(now * .001 + i) ** 2;
        if (stamp) stamp(ctx, i, x, y);
        else { ctx.beginPath(); ctx.arc(x, y, 1.4 + i % 3 * .45, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
    } };
  }

  function shaderPoints(scene) {
    const { canvas, w, h } = scene;
    const tag = canvas.closest('.route').querySelector('.route-tag');
    let gl;
    const shaders = [];
    let program, buffer;
    function dispose() {
      if (!gl) return;
      shaders.forEach(shader => gl.deleteShader(shader));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    }
    function fallback() {
      dispose();
      // A canvas that acquired WebGL cannot subsequently acquire a 2D context.
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      scene.canvas = replacement;
      scene.fallback = true;
      tag.textContent = 'canvas fallback';
      return miniText(scene, 'GPU', '#a899ff', 'dot');
    }
    if (scene.fallback) { tag.textContent = 'canvas fallback'; return miniText(scene, 'GPU', '#a899ff', 'dot'); }
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: true });
      if (!gl) return fallback();
      const vertex = `attribute vec3 a_point; uniform vec2 u_size; uniform float u_time; uniform float u_dpr; varying float v_alpha; void main() { vec2 p = a_point.xy + vec2(sin(u_time * .001 + a_point.z * 19.0) * 3.0, cos(u_time * .0012 + a_point.z * 13.0) * 3.0); gl_Position = vec4(p.x / u_size.x * 2.0 - 1.0, 1.0 - p.y / u_size.y * 2.0, 0.0, 1.0); gl_PointSize = (3.0 + 2.5 * (0.5 + 0.5 * sin(u_time * .002 + a_point.z * 21.0))) * u_dpr; v_alpha = .35 + .65 * (0.5 + 0.5 * sin(u_time * .0015 + a_point.z * 17.0)); }`;
      const fragment = `precision mediump float; varying float v_alpha; void main() { float glow = 1.0 - smoothstep(.05, .5, length(gl_PointCoord - .5)); gl_FragColor = vec4(.66, .60, 1.0, glow * v_alpha); }`;
      function compile(type, source) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Shader allocation failed');
        shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
        return shader;
      }
      program = gl.createProgram();
      if (!program) throw new Error('Program allocation failed');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
      gl.useProgram(program);
      const pts = textPoints('GPU', w, h, Math.max(5, Math.floor(w / 90)), Math.min(72, w / 4));
      const data = new Float32Array(pts.flatMap((p, i) => [p.x, p.y, i % 17 / 17]));
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Buffer allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const attr = gl.getAttribLocation(program, 'a_point');
      gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 3, gl.FLOAT, false, 12, 0);
      gl.uniform2f(gl.getUniformLocation(program, 'u_size'), w, h);
      gl.uniform1f(gl.getUniformLocation(program, 'u_dpr'), scene.dpr);
      const time = gl.getUniformLocation(program, 'u_time');
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        try { scene.renderer = fallback(); draw(scene); }
        catch { fail(scene); }
      }, { signal: scene.signal, once: true });
      tag.textContent = 'webgl';
      return { dispose, render(now) {
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(time, now); gl.drawArrays(gl.POINTS, 0, data.length / 3);
      } };
    } catch { return fallback(); }
  }

  function forceField(scene) {
    const { w, h } = scene, ctx = context2d(scene);
    const ps = Array.from({ length: 240 }, () => ({ a: rand(0, Math.PI * 2), r: rand(20, Math.min(100, w * .35, h / 2 - 40)) }));
    return { render(now) {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 + Math.cos(now * .001) * 35, cy = h / 2 + Math.sin(now * .0013) * 24;
      ps.forEach((p, i) => {
        const a = p.a + now / (1000 / 60) * (.003 + i * .00001);
        const r = p.r + Math.sin(now * .001 + i) * 10;
        ctx.globalAlpha = .25 + .4 * Math.sin(now * .002 + i) ** 2;
        ctx.fillStyle = i % 5 ? '#9fffc4' : '#71e4ff';
        ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 1.5);
      });
      ctx.globalAlpha = 1;
    } };
  }

  function fail(scene) {
    scene.renderer?.dispose?.();
    scene.renderer = null;
    scene.canvas.hidden = true;
    scene.host.querySelector('.canvas-fallback').hidden = false;
    if (scene.id === 'heroCanvas') {
      status.textContent = 'CANVAS UNAVAILABLE';
      document.querySelectorAll('[data-target], #burstParticles').forEach(button => { button.disabled = true; });
    }
  }
  function draw(scene, dt = 0) {
    if (!scene.renderer) return;
    try { scene.renderer.render(scene.time, dt); } catch { fail(scene); }
  }
  function rebuild(scene, force = false) {
    const rect = scene.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    if (!force && scene.w === rect.width && scene.h === rect.height && scene.dpr === dpr) return;
    scene.events?.abort();
    scene.renderer?.dispose?.();
    scene.events = new AbortController(); scene.signal = scene.events.signal;
    scene.w = rect.width; scene.h = rect.height; scene.dpr = dpr;
    scene.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    scene.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    try { scene.renderer = scene.create(scene); draw(scene); } catch { fail(scene); }
  }
  function tick(now) {
    raf = 0;
    const dt = lastTime === null ? 0 : Math.min(50, now - lastTime);
    lastTime = now;
    for (const scene of scenes) {
      if (!scene.visible || !scene.renderer) continue;
      if (scene.dpr !== Math.min(devicePixelRatio || 1, 2)) rebuild(scene);
      scene.time += dt;
      draw(scene, dt);
    }
    schedule();
  }
  function schedule() {
    const active = pageActive && !paused && !document.hidden && scenes.some(scene => scene.visible && scene.renderer);
    if (active && !raf) raf = requestAnimationFrame(tick);
    if (!active) { cancelAnimationFrame(raf); raf = 0; lastTime = null; }
  }
  function updateControls() {
    pause.textContent = paused ? 'PLAY MOTION' : 'PAUSE MOTION';
    burstButton.disabled = paused || !scenes[0]?.renderer;
    if (scenes[0]?.renderer) status.textContent = `CANVAS 2D · ${targetName} · ${paused ? 'PAUSED' : 'LIVE'}`;
    document.querySelectorAll('[data-target]').forEach(button => {
      if (button.dataset.target === 'RESET') return;
      const active = button.dataset.target === targetName;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function setPaused(value) {
    paused = value;
    if (paused && motion.matches) scenes[0]?.renderer?.settle();
    scenes.forEach(scene => draw(scene));
    updateControls(); schedule();
  }

  const definitions = [
    ['heroCanvas', runHero],
    ['glyphCanvas', scene => miniText(scene, 'MORPH', '#71e4ff', 'dot')],
    ['shaderCanvas', shaderPoints],
    ['atlasCanvas', scene => miniText(scene, 'ATLAS', '#ffb36b', 'atlas')],
    ['forceCanvas', forceField]
  ];
  for (const [id, create] of definitions) {
    const canvas = document.getElementById(id);
    const scene = { id, canvas, host: canvas.parentElement, create, visible: false, time: 0 };
    const rect = canvas.getBoundingClientRect();
    scene.visible = rect.bottom > 0 && rect.top < innerHeight;
    scenes.push(scene); rebuild(scene);
  }
  document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => {
    targetName = button.dataset.target === 'RESET' ? 'MORPH' : button.dataset.target;
    const hero = scenes[0];
    if (button.dataset.target === 'RESET') hero.renderer?.reset();
    else hero.renderer?.setTarget();
    draw(hero); updateControls();
  }));
  pause.addEventListener('click', () => setPaused(!paused));
  burstButton.addEventListener('click', () => scenes[0].renderer?.burst());
  motion.addEventListener('change', event => {
    // Enabling the OS preference pauses immediately; disabling it never overrides a manual pause.
    if (event.matches) setPaused(true);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const scene = scenes.find(item => item.host === entry.target);
        scene.visible = entry.isIntersecting;
      });
      schedule();
    });
    scenes.forEach(scene => observer.observe(scene.host));
  } else scenes.forEach(scene => { scene.visible = true; });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => { scenes.forEach(scene => rebuild(scene)); });
    scenes.forEach(scene => observer.observe(scene.host));
  }
  addEventListener('resize', () => { scenes.forEach(scene => rebuild(scene)); });
  document.addEventListener('visibilitychange', schedule);
  addEventListener('pagehide', () => { pageActive = false; schedule(); });
  addEventListener('pageshow', () => { pageActive = true; schedule(); });
  // Re-sample after fonts finish, but never make first paint depend on the network.
  document.fonts?.ready.then(() => { scenes.forEach(scene => rebuild(scene, true)); schedule(); });
  updateControls(); schedule();
})();
