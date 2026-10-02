import * as THREE from '../vendor/three/three.module.min.mjs';
import { writeLine } from './dirty-pixel-lines.mjs';

const canvas = document.querySelector('#particleCanvas');
const fallbackImage = document.querySelector('#particleFallback');
const status = document.querySelector('#particleStatus');
const countInput = document.querySelector('#particleCount');
const countValue = document.querySelector('#particleCountValue');
const widthInput = document.querySelector('#lineWidth');
const widthValue = document.querySelector('#lineWidthValue');
const lengthInput = document.querySelector('#lineLength');
const lengthValue = document.querySelector('#lineLengthValue');
const colorInput = document.querySelector('#lineColor');
const colorValue = document.querySelector('#lineColorValue');
const pauseButton = document.querySelector('#particlePause');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sampleCanvas = document.createElement('canvas');
const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
const maxCount = Number(countInput.max);
const sourceColors = new Float32Array(maxCount * 3);
const sourceColor = new THREE.Color();
const sourceHSL = {};
let frames = [], frameIndex = 0, elapsed = 0, lastTime = 0, raf = 0;
let renderer, scene, camera, geometry, material, visible = true, paused = false;
let stageWidth = 1, stageHeight = 1, count = Number(countInput.value);
let loopDuration = 0, failed = false;

// Stable samples keep paused edits and resize from shuffling the artwork.
const sampleSeeds = new Float32Array(maxCount);
let seed = 0x41;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let i = 0; i < maxCount; i++) {
  sampleSeeds[i] = random();
}

function stop() { cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
function wake() {
  if (renderer && frames.length && !paused && !reducedMotion.matches && visible && !document.hidden && !raf) {
    raf = requestAnimationFrame(tick);
  }
}
function render() {
  if (!renderer || !visible || document.hidden) return;
  try { renderer.render(scene, camera); }
  catch (error) { console.error('Particle rendering failed:', error); fallback(); }
}
function resize() {
  if (!renderer) return;
  stageWidth = Math.max(1, canvas.parentElement.clientWidth);
  stageHeight = Math.max(1, canvas.parentElement.clientHeight);
  const aspect = stageWidth / stageHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(stageWidth, stageHeight, false);
  camera.left = -aspect / 2; camera.right = aspect / 2;
  camera.top = .5; camera.bottom = -.5;
  camera.updateProjectionMatrix();
  sampleCurrentFrame();
}
function sampleData() {
  const frame = frames[frameIndex];
  const sourceAspect = frame.image.naturalWidth / frame.image.naturalHeight;
  // Density changes select more samples from the same grid, never change its topology.
  const cols = 720;
  if (frame.samples?.cols === cols) return frame.samples;
  const rows = Math.round(cols / sourceAspect);
  sampleCanvas.width = cols; sampleCanvas.height = rows;
  sampleContext.imageSmoothingEnabled = false;
  sampleContext.drawImage(frame.image, 0, 0, cols, rows);
  const pixels = sampleContext.getImageData(0, 0, cols, rows).data;
  const candidates = [];
  const directions = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const p = i * 4;
    if (pixels[p + 3] > 0 && (pixels[p] + pixels[p + 1] + pixels[p + 2]) / 3 > 5) {
      candidates.push(i);
      // Source-neighborhood principal axis: repeated samples share a direction,
      // avoiding random starbursts when the same source pixel is picked twice.
      const x = i % cols, y = Math.floor(i / cols);
      let xx = 0, yy = 0, xy = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
        const q = ((y + dy) * cols + x + dx) * 4;
        const weight = (pixels[q] + pixels[q + 1] + pixels[q + 2]) / 765;
        xx += weight * dx * dx; yy += weight * dy * dy; xy += weight * dx * dy;
      }
      directions[i] = -.5 * Math.atan2(2 * xy, xx - yy);
    }
  }
  frame.samples = { cols, rows, candidates, sourceAspect, pixels, directions };
  return frame.samples;
}
function sampleCurrentFrame() {
  if (!renderer || !frames.length || !sampleContext || !geometry) return;
  const { cols, rows, candidates, sourceAspect, pixels, directions } = sampleData();
  const stageAspect = stageWidth / stageHeight;
  const fitW = Math.min(stageAspect, sourceAspect);
  const fitH = fitW / sourceAspect;
  const positions = geometry.getAttribute('position');
  const length = Number(lengthInput.value) / stageHeight;
  const width = Number(widthInput.value) / stageHeight;
  for (let i = 0; i < count && candidates.length; i++) {
    const source = candidates[Math.min(candidates.length - 1, Math.floor(sampleSeeds[i] * candidates.length))];
    const x = source % cols, y = Math.floor(source / cols);
    const cx = ((x + .5) / cols) * fitW - fitW / 2;
    const cy = fitH / 2 - ((y + .5) / rows) * fitH;
    writeLine(positions.array, i * 18, cx, cy, directions[source], length, width);
    const p = source * 4;
    sourceColors.set([pixels[p] / 255, pixels[p + 1] / 255, pixels[p + 2] / 255], i * 3);
  }
  positions.needsUpdate = true;
  // Empty/transparent source frames must stay empty, not become random noise.
  geometry.setDrawRange(0, candidates.length ? count * 6 : 0);
  canvas.dataset.frameIndex = String(frameIndex);
  canvas.dataset.particleCount = String(count);
  canvas.dataset.particleSize = String(widthInput.value);
  canvas.dataset.lineLength = String(lengthInput.value);
  updateColor();
}
function updateColor() {
  colorValue.value = Number(colorInput.value) === 0 ? 'SOURCE' : `+${colorInput.value}°`;
  colorInput.setAttribute('aria-valuetext', Number(colorInput.value) === 0 ? 'Original source colors' : `${colorInput.value} degree hue offset`);
  colorInput.style.setProperty('--line-hue', colorInput.value);
  canvas.dataset.particleHue = String(colorInput.value);
  if (!renderer || !geometry) return;
  const hueOffset = Number(colorInput.value) / 360;
  const colors = geometry.getAttribute('color');
  for (let i = 0; i < count; i++) {
    sourceColor.setRGB(sourceColors[i * 3], sourceColors[i * 3 + 1], sourceColors[i * 3 + 2], THREE.SRGBColorSpace);
    if (hueOffset) {
      sourceColor.getHSL(sourceHSL, THREE.SRGBColorSpace);
      sourceColor.setHSL(sourceHSL.h + hueOffset, sourceHSL.s, sourceHSL.l, THREE.SRGBColorSpace);
    }
    for (let v = i * 6; v < i * 6 + 6; v++) colors.setXYZ(v, sourceColor.r, sourceColor.g, sourceColor.b);
  }
  colors.needsUpdate = true;
  render();
}
function tick(time) {
  raf = 0;
  if (!renderer || paused || reducedMotion.matches || !visible || document.hidden) return;
  if (lastTime) elapsed += (time - lastTime) % loopDuration;
  lastTime = time;
  let changed = false;
  while (elapsed >= frames[frameIndex].duration) {
    elapsed -= frames[frameIndex].duration;
    frameIndex = (frameIndex + 1) % frames.length;
    changed = true;
  }
  // Only upload/render the final due frame, not every skipped frame or every RAF.
  if (changed) sampleCurrentFrame();
  wake();
}
function updateStatus() {
  status.textContent = !renderer ? (reducedMotion.matches
    ? 'Particles unavailable · static source frame' : 'Particles unavailable · original GIF fallback') : reducedMotion.matches
    ? 'Reduced motion · static particle frame' : paused ? 'Particle loop paused' : `${count.toLocaleString()} particles · live GIF frame sampling`;
  pauseButton.disabled = !renderer || reducedMotion.matches;
  for (const input of [countInput, widthInput, lengthInput, colorInput]) input.disabled = !renderer;
}
function fallback() {
  failed = true;
  stop(); canvas.hidden = true; fallbackImage.hidden = false;
  geometry?.dispose(); material?.dispose(); renderer?.dispose(); renderer = null;
  fallbackImage.src = reducedMotion.matches && frames.length ? frames[0].image.src
    : new URL('../yudho-dirty-pixels.gif', import.meta.url).href;
  updateStatus();
}
function showRenderer() {
  if (!renderer) { if (failed) fallback(); return; }
  canvas.hidden = false; fallbackImage.hidden = true;
  if (reducedMotion.matches) {
    stop(); frameIndex = 0; elapsed = 0; sampleCurrentFrame();
  } else { render(); wake(); }
  updateStatus();
}
countInput.addEventListener('input', () => {
  count = Number(countInput.value); countValue.value = count.toLocaleString();
  countInput.setAttribute('aria-valuetext', `${count.toLocaleString()} particles`);
  sampleCurrentFrame(); updateStatus();
});
widthInput.addEventListener('input', () => {
  widthValue.value = `${widthInput.value} px`; sampleCurrentFrame();
});
lengthInput.addEventListener('input', () => {
  lengthValue.value = `${lengthInput.value} px`; sampleCurrentFrame();
});
colorInput.addEventListener('input', updateColor);
pauseButton.addEventListener('click', () => {
  paused = !paused; pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseButton.setAttribute('aria-pressed', String(paused)); updateStatus();
  if (paused) stop(); else showRenderer();
});
reducedMotion.addEventListener('change', showRenderer);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else showRenderer(); });
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) showRenderer(); else stop(); }).observe(canvas.parentElement);
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', () => { resize(); showRenderer(); });

async function init() {
  try {
    if (!sampleContext) throw new Error('Canvas sampling unavailable');
    const manifest = await fetch('../assets/yudho-dirty-pixels-frames.json').then(response => {
      if (!response.ok) throw new Error('GIF frames unavailable'); return response.json();
    });
    if (!Array.isArray(manifest) || !manifest.length) throw new Error('Empty GIF frame manifest');
    frames = await Promise.all(manifest.map(async frame => {
      if (typeof frame.src !== 'string' || !Number.isFinite(frame.duration) || frame.duration <= 0) {
        throw new Error('Invalid GIF frame');
      }
      const image = new Image(); image.src = frame.src; await image.decode();
      return { image, duration: Math.max(20, frame.duration) };
    }));
    loopDuration = frames.reduce((total, frame) => total + frame.duration, 0);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setClearColor(0x000000, 1);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, .5, -.5, .1, 10); camera.position.z = 2;
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxCount * 18), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxCount * 18), 3).setUsage(THREE.DynamicDrawUsage));
    material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; scene.add(mesh);
    canvas.hidden = false;
    resize();
    new ResizeObserver(resize).observe(canvas.parentElement);
    showRenderer();
  } catch (error) { console.error('Dirty Pixel Particles init failed:', error); fallback(); }
}
init();
