import * as THREE from '../vendor/three/three.module.min.mjs';
import { stepParticles } from './particle-art-physics.mjs';

const canvas = document.querySelector('#artCanvas');
const image = document.querySelector('#artFallback');
const status = document.querySelector('#artStatus');
const pause = document.querySelector('#pauseArt');
const scatter = document.querySelector('#scatterArt');
const reset = document.querySelector('#resetArt');
const radiusInput = document.querySelector('#brushRadius');
const strengthInput = document.querySelector('#pushStrength');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = { x: 0, y: 0, active: false };
let keyboardPush = false;
let renderer, geometry, material, scene, camera, positions, homes, velocity;
let frame = 0, last = 0, accumulator = 0, paused = false, visible = true, pageActive = true, failed = false;
let radius = 90, strength = 1.8;

function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; accumulator = 0; }
function available() { return renderer && !failed && !motion.matches; }
function message() {
  status.textContent = failed ? 'WebGL unavailable · original artwork' : motion.matches
    ? 'Reduced motion · static artwork' : paused ? 'Motion paused · field frozen'
    : 'THREE.JS · 14,400 points · push / spring return';
  scatter.disabled = pause.disabled = !available();
  reset.disabled = !renderer || failed;
  pause.textContent = paused ? 'RESUME MOTION' : 'PAUSE MOTION';
  pause.setAttribute('aria-pressed', String(paused));
}
function fallback() {
  failed = true; stop(); canvas.hidden = true; image.hidden = false;
  geometry?.dispose(); material?.dispose(); renderer?.dispose(); message();
}
function draw() {
  if (failed || !renderer) return;
  try { geometry.attributes.position.needsUpdate = true; renderer.render(scene, camera); }
  catch { fallback(); }
}
function wake() {
  if (!frame && available() && !paused && visible && pageActive && !document.hidden) frame = requestAnimationFrame(tick);
}
function tick(time) {
  frame = 0;
  if (!available() || paused || !visible || !pageActive || document.hidden) return;
  accumulator += last ? Math.min((time - last) / 1000, .05) : 1 / 60;
  last = time;
  let energy = 1;
  while (accumulator >= 1 / 60) {
    energy = stepParticles(positions, homes, velocity, pointer, radius, strength);
    accumulator -= 1 / 60;
  }
  draw();
  if (!failed && (pointer.active || energy > .005)) wake();
  else { positions.set(homes); velocity.fill(0); draw(); stop(); }
}
function restore() {
  keyboardPush = false; pointer.active = false; stop();
  if (positions) { positions.set(homes); velocity.fill(0); draw(); }
}
function resize() {
  if (!renderer || failed) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(rect.width, rect.height, false);
  material.uniforms.size.value = Math.max(1, rect.width / 120 * .83) * renderer.getPixelRatio();
  draw();
}
function locate(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * 720 - 360;
  pointer.y = 360 - (event.clientY - rect.top) / rect.height * 720;
  pointer.active = available() && !paused; wake();
}
canvas.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch' || event.buttons) locate(event);
});
canvas.addEventListener('pointerdown', locate);
for (const event of ['pointerleave', 'pointerup', 'pointercancel', 'blur']) {
  canvas.addEventListener(event, () => { keyboardPush = false; pointer.active = false; wake(); });
}
window.addEventListener('blur', () => { keyboardPush = false; pointer.active = false; wake(); });
canvas.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(event.key)) return;
  event.preventDefault();
  if (!available() || paused) return;
  if (event.key === 'Escape') { keyboardPush = false; pointer.active = false; wake(); return; }
  if (event.key === ' ') keyboardPush = true;
  if (event.key === 'ArrowLeft') pointer.x -= 25;
  if (event.key === 'ArrowRight') pointer.x += 25;
  if (event.key === 'ArrowUp') pointer.y += 25;
  if (event.key === 'ArrowDown') pointer.y -= 25;
  pointer.x = Math.max(-350, Math.min(350, pointer.x));
  pointer.y = Math.max(-350, Math.min(350, pointer.y));
  pointer.active = keyboardPush;
  if (pointer.active) wake();
});
canvas.addEventListener('keyup', event => { if (event.key === ' ') { keyboardPush = false; pointer.active = false; wake(); } });
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
pause.addEventListener('click', () => { paused = !paused; keyboardPush = false; pointer.active = false; stop(); message(); if (!paused) wake(); });
reset.addEventListener('click', restore);
scatter.addEventListener('click', () => {
  if (!available()) return;
  pointer.active = false;
  for (let i = 0; i < velocity.length; i++) velocity[i] = (Math.random() - .5) * 30;
  if (paused) { paused = false; message(); }
  wake();
});
for (const [input, output, update] of [
  [radiusInput, '#radiusValue', value => { radius = value; }],
  [strengthInput, '#strengthValue', value => { strength = value; }]
]) input.addEventListener('input', () => { update(Number(input.value)); document.querySelector(output).value = input.value; });
motion.addEventListener('change', () => { restore(); message(); });
document.addEventListener('visibilitychange', () => { keyboardPush = false; pointer.active = false; stop(); if (!document.hidden) wake(); });
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible) { keyboardPush = false; pointer.active = false; stop(); } else wake();
}).observe(canvas.parentElement);
window.addEventListener('pagehide', () => { pageActive = false; keyboardPush = false; pointer.active = false; stop(); });
window.addEventListener('pageshow', () => { pageActive = true; resize(); wake(); });

async function init() {
  try {
    await image.decode();
    const sample = document.createElement('canvas'); sample.width = sample.height = 120;
    const context = sample.getContext('2d');
    if (!context) throw new Error('Image sampling unavailable');
    context.drawImage(image, 0, 0, 120, 120);
    const pixels = context.getImageData(0, 0, 120, 120).data;
    positions = new Float32Array(14400 * 3);
    const colors = new Float32Array(positions.length);
    const color = new THREE.Color();
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
      const i = (y * 120 + x) * 3, p = (y * 120 + x) * 4;
      positions[i] = (x + .5) * 6 - 360; positions[i + 1] = 360 - (y + .5) * 6;
      color.setRGB(pixels[p] / 255, pixels[p + 1] / 255, pixels[p + 2] / 255, THREE.SRGBColorSpace);
      color.toArray(colors, i);
    }
    homes = positions.slice(); velocity = new Float32Array(positions.length);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setClearColor(0x171322, 1);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-360, 360, 360, -360, .1, 2000);
    camera.position.z = 1000;
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    material = new THREE.ShaderMaterial({
      uniforms: { size: { value: 4 } }, vertexColors: true,
      vertexShader: 'uniform float size; varying vec3 vColor; void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=size;}',
      fragmentShader: 'varying vec3 vColor; void main(){if(length(gl_PointCoord-.5)>.5)discard;gl_FragColor=vec4(vColor,1.0);\n#include <colorspace_fragment>\n}'
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; scene.add(points);
    canvas.hidden = false; image.hidden = true;
    new ResizeObserver(resize).observe(canvas.parentElement);
    resize(); message();
  } catch { fallback(); }
}
init();
