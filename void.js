import * as THREE from 'three';
import { Look } from './look.js?v=4';

const FLIGHT_T = 5.6;

// The void is pure black: no visuals, only the wait and the sound.
export class VoidScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 300);
    this.look = new Look(this.camera, 0.0016, 0.6);
    this.t = 0;
    this.switched = false;
  }

  start(audio, ui, done) {
    this.audio = audio;
    this.ui = ui;
    this.done = done;
    this.t = 0;
    this.switched = false;
    this._hit = false;
    this._b1 = false;
    this._b2 = false;
    this.look.yaw = 0;
    this.look.pitch = 0;
    this.camera.position.set(0, 0, 40);
    audio.whoosh();
  }

  fx() { return 0; }

  update(dt, tGlobal) {
    this.t += dt;
    const t = this.t;
    const u = Math.min(1, t / FLIGHT_T);

    if (!this._b1 && t > 1.3) {
      this._b1 = true;
      this.audio.subHit();
    }
    if (!this._b2 && t > 3.4) {
      this._b2 = true;
      this.audio.subHit();
    }
    this.audio.setWhoosh(Math.min(1, u * 1.4));

    if (!this._hit && u > 0.8) {
      this._hit = true;
      this.audio.subHit();
      this.ui.setFade('#000000', 0.25, true);
    }
    if (!this.switched && t > FLIGHT_T + 0.25) {
      this.switched = true;
      this.audio.stopWhoosh(0.4);
      const cb = this.done;
      setTimeout(() => cb(), 120);
    }
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
