import * as THREE from '../vendor/three/three.module.min.mjs';

const canvas = document.querySelector('#dirtyCanvas');
const image = document.querySelector('#dirtyFallback');
const status = document.querySelector('#dirtyStatus');
const pause = document.querySelector('#dirtyPause');
const restartButton = document.querySelector('#dirtyRestart');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, material, geometry, texture, scene, camera;
let raf = 0, visible = true, pageActive = true, failed = false, paused = false;
let gifCanvas, gifContext, frames = [], frameIndex = 0, frameElapsed = 0, lastTime = 0, cycle = 0;

function stop() { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
function available() { return Boolean(renderer) && !failed; }
function message() {
  status.textContent = failed ? 'WebGL unavailable · original artwork fallback' : motion.matches
    ? 'Reduced motion · static source frame' : paused ? 'Original GIF texture · paused' : 'THREE.JS / original animated GIF texture';
  pause.disabled = restartButton.disabled = !available() || motion.matches;
  pause.textContent = paused ? 'RESUME LOOP' : 'PAUSE LOOP';
  pause.setAttribute('aria-pressed', String(paused));
}
function fallback() {
  failed = true; stop(); canvas.hidden = true; image.hidden = false;
  geometry?.dispose(); material?.dispose(); texture?.dispose(); renderer?.dispose();
  message();
}
function resetLoop() { frameIndex = 0; frameElapsed = 0; lastTime = 0; draw(); }
function togglePause() {
  if (!available() || motion.matches) return;
  paused = !paused; stop(); message();
  if (!paused) { draw(); wake(); }
}
function restart() {
  if (!available() || motion.matches) return;
  paused = false; stop(); resetLoop(); message(); wake();
}
function draw() {
  if (!available() || !frames.length) return;
  canvas.dataset.frameIndex = String(frameIndex);
  gifContext.clearRect(0, 0, gifCanvas.width, gifCanvas.height);
  gifContext.drawImage(frames[frameIndex].image, 0, 0);
  texture.needsUpdate = true;
  try { renderer.render(scene, camera); } catch { fallback(); }
}
function wake() {
  if (!raf && available() && !paused && !motion.matches && visible && pageActive && !document.hidden) raf = requestAnimationFrame(tick);
}
function tick(time) {
  raf = 0;
  if (!available() || paused || motion.matches || !visible || !pageActive || document.hidden) return;
  if (lastTime) frameElapsed += (time - lastTime) % cycle;
  lastTime = time;
  let changed = false;
  while (frameElapsed >= frames[frameIndex].duration) {
    frameElapsed -= frames[frameIndex].duration;
    frameIndex = (frameIndex + 1) % frames.length;
    changed = true;
  }
  if (changed) draw();
  wake();
}
function resize() {
  if (!available()) return;
  const width = Math.max(1, canvas.parentElement.clientWidth);
  const height = Math.max(1, canvas.parentElement.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  const stageRatio = width / height;
  // Derive dimensions from the decoded frame, not an independently loading GIF.
  const imageRatio = gifCanvas.width / gifCanvas.height;
  camera.left = -stageRatio / 2; camera.right = stageRatio / 2;
  camera.top = .5; camera.bottom = -.5; camera.updateProjectionMatrix();
  geometry.dispose();
  const w = Math.min(imageRatio, stageRatio);
  geometry = new THREE.PlaneGeometry(w, w / imageRatio);
  scene.children[0].geometry = geometry;
  draw();
}
function display() {
  stop();
  canvas.hidden = !available(); image.hidden = available();
  if (available()) {
    if (motion.matches) resetLoop(); else draw();
    wake();
  }
  message();
}
pause.addEventListener('click', togglePause);
restartButton.addEventListener('click', restart);
motion.addEventListener('change', display);
document.addEventListener('visibilitychange', () => { stop(); if (!document.hidden) display(); });
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; stop(); if (visible) display(); }).observe(canvas.parentElement);
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
window.addEventListener('pagehide', () => { pageActive = false; stop(); });
window.addEventListener('pageshow', () => { pageActive = true; resize(); display(); });

async function init() {
  try {
    const manifest = await fetch('../assets/yudho-dirty-pixels-frames.json').then(response => {
      if (!response.ok) throw new Error('GIF frame manifest unavailable');
      return response.json();
    });
    if (!Array.isArray(manifest) || !manifest.length) throw new Error('Empty GIF frame manifest');
    frames = await Promise.all(manifest.map(async frame => {
      if (typeof frame.src !== 'string' || !Number.isFinite(frame.duration) || frame.duration <= 0) throw new Error('Invalid GIF frame');
      const bitmap = new Image(); bitmap.src = frame.src; await bitmap.decode();
      return { image: bitmap, duration: Math.max(20, frame.duration) };
    }));
    cycle = frames.reduce((total, frame) => total + frame.duration, 0);
    gifCanvas = document.createElement('canvas');
    gifCanvas.width = frames[0].image.naturalWidth; gifCanvas.height = frames[0].image.naturalHeight;
    gifContext = gifCanvas.getContext('2d');
    if (!gifContext) throw new Error('GIF canvas unavailable');
    gifContext.drawImage(frames[0].image, 0, 0);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setClearColor(0x000000, 1);
    texture = new THREE.CanvasTexture(gifCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 1;
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    scene.add(new THREE.Mesh(geometry, material));
    new ResizeObserver(resize).observe(canvas.parentElement); resize(); display();
  } catch (error) { console.error('Dirty Pixels init failed:', error); fallback(); }
}
init();
