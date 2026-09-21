import * as THREE from 'three';
import { Audio } from './audio.js?v=4';
import { Subway } from './subway.js?v=4';
import { VoidScene } from './void.js?v=4';
import { Backrooms } from './backrooms.js?v=4';
import { Suburbia } from './suburbia.js?v=4';

const canvas = document.getElementById('scene');
const fxCanvas = document.getElementById('fx');
const fxCtx = fxCanvas.getContext('2d');
const ui = {
  fade: document.getElementById('fade'),
  flash: document.getElementById('flash'),
  title: document.getElementById('title'),
  line: document.getElementById('line'),
  hint: document.getElementById('hint'),
  promptEl: document.getElementById('prompt'),
  setFade(color, dur, on) {
    this.fade.style.transition = `opacity ${dur}s ease`;
    this.fade.style.background = color;
    this.fade.style.opacity = on ? '1' : '0';
  },
  flash(color, dur) {
    const f = this.flash;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = '0.95';
    void f.offsetWidth;
    f.style.transition = `opacity ${dur}s ease`;
    f.style.opacity = '0';
  },
  setPrompt(text) {
    if (this._pt === text) return;
    this._pt = text;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('show');
    } else {
      this.promptEl.classList.remove('show');
    }
  },
  showLine(text, dur = 3000) {
    this.line.textContent = text;
    this.line.classList.add('show');
    clearTimeout(this._lt);
    this._lt = setTimeout(() => this.line.classList.remove('show'), dur);
  }
};

window.addEventListener('liminal-line', (e) => {
  ui.showLine(e.detail);
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const audio = new Audio();
let phase = null;
let phaseName = 'title';
let lockActive = false;

const subway = new Subway(renderer);
const voidScene = new VoidScene();
const backrooms = new Backrooms(renderer);
const suburbia = new Suburbia(renderer);

function startSubway() {
  ui.title.classList.add('off');
  audio.ensure();
  phaseName = 'subway';
  phase = subway;
  subway.start(audio, ui, () => startVoid());
}

function startVoid() {
  phaseName = 'void';
  phase = voidScene;
  voidScene.start(audio, ui, () => startBackrooms());
}

function startBackrooms() {
  phaseName = 'backrooms';
  phase = backrooms;
  backrooms.start(audio, ui, () => startSubwayReturn());
  ui.setPrompt(null);
  ui.hint.textContent = 'WASD MOVE · SHIFT RUN · SPACE JUMP · E OPEN DOOR · CLICK TO LOOK';
  ui.setFade('#000000', 1.2, false);
  setTimeout(() => ui.hint.classList.add('show'), 900);
  setTimeout(() => ui.hint.classList.remove('show'), 12000);
}

function startSubwayReturn() {
  phaseName = 'subway';
  phase = subway;
  subway.start(audio, ui, () => startSuburbia(), true);
}

function startSuburbia() {
  phaseName = 'suburbia';
  phase = suburbia;
  suburbia.start(audio, ui, () => startBackrooms());
  ui.setPrompt(null);
  ui.hint.textContent = 'WANDER · YOU CANNOT ENTER ANY HOUSE';
  ui.hint.classList.remove('show');
  ui.setFade('#000000', 1.3, false);
  ui.flash('#f2efe2', 1.1);
  setTimeout(() => ui.hint.classList.add('show'), 1100);
  setTimeout(() => ui.hint.classList.remove('show'), 12000);
}

document.getElementById('board').addEventListener('click', startSubway);
document.getElementById('title').addEventListener('click', (e) => {
  if (!phase) startSubway();
});

canvas.addEventListener('click', () => {
  if (phaseName === 'subway' || phaseName === 'void' || phaseName === 'backrooms' || phaseName === 'suburbia') {
    canvas.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  lockActive = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (e) => {
  if (lockActive && phase && phase.look) {
    phase.look.move(e.movementX, e.movementY);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'KeyR') location.reload();
  if (e.code === 'KeyE' && phase && phase.interact && !e.repeat &&
      (phaseName === 'backrooms' || phaseName === 'suburbia')) {
    phase.interact();
  }
});

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  fxCanvas.width = w * 0.5;
  fxCanvas.height = h * 0.5;
  const aspect = w / h;
  subway.onResize(aspect);
  voidScene.onResize(aspect);
  backrooms.onResize(aspect);
  suburbia.onResize(aspect);
}
window.addEventListener('resize', resize);
resize();

function drawFx(t) {
  const w = fxCanvas.width, h = fxCanvas.height;
  const a = phase && phase.fx ? phase.fx() : 0;
  fxCtx.clearRect(0, 0, w, h);
  if (a < 0.01) return;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.hypot(cx, cy);
  fxCtx.lineCap = 'round';
  const N = 46;
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const inner = maxR * (1 - a * (0.34 + Math.random() * 0.42));
    const len = a * (0.06 + Math.random() * 0.22) * maxR;
    const x0 = cx + Math.cos(ang) * inner;
    const y0 = cy + Math.sin(ang) * inner;
    const x1 = cx + Math.cos(ang) * (inner + len);
    const y1 = cy + Math.sin(ang) * (inner + len);
    const al = (0.12 + Math.random() * 0.5) * a;
    fxCtx.strokeStyle = `rgba(255,246,214,${al})`;
    fxCtx.lineWidth = Math.random() < 0.8 ? 1 : 2.2;
    fxCtx.beginPath();
    fxCtx.moveTo(x0, y0);
    fxCtx.lineTo(x1, y1);
    fxCtx.stroke();
  }
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (phase) {
    phase.update(dt, clock.elapsedTime);
    renderer.render(phase.scene, phase.camera);
    drawFx(clock.elapsedTime);
  }
}
loop();

window.addEventListener('error', (e) => {
  ui.showLine('an error occurred: ' + e.message);
});
