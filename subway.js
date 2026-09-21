import * as THREE from 'three';
import { makeTextures, repeatTex } from './textures.js?v=4';
import { Look } from './look.js?v=4';

const DEPART = 2.2;
const HYPER_T = 12.4;
const END_T = 15.8;

export class Subway {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 200);
    this.look = new Look(this.camera, 0.0021, 1.2);
    this.look.yaw = 0.12;

    this.T = makeTextures();
    this.buildCar();
    this.buildPassengers();
    this.buildExterior();

    this.t = 0;
    this.dist = 0;
    this.speed = 0;
    this.stress = 0;
    this._flagged = {};
    this.phaseDone = false;
  }

  start(audio, ui, done, returnMode = false) {
    this.audio = audio;
    this.ui = ui;
    this.done = done;
    this.returnMode = returnMode;
    this.t = 0;
    this.dist = 0;
    this.speed = 0;
    this.stress = 0;
    this.phaseDone = false;
    this._flagged = {};
    this.camera.position.set(0.42, 1.5, 2.0);
    this.look.yaw = 0.12;
    this.look.pitch = 0;
    this.look.apply();

    audio.rumble();
    this.ui.setFade('#000000', 1.1, false);
    if (returnMode) {
      audio.say('One station. Final station. Yours.');
    } else {
      audio.say('Now departing. Next stop — nowhere. Please remain seated.');
    }
  }

  buildCar() {
    const T = this.T;
    const scene = this.scene;
    const car = new THREE.Group();
    this.car = car;
    scene.add(car);

    const panelMat = new THREE.MeshStandardMaterial({ map: T.panel, roughness: 0.85 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x8f979d, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ map: T.grip, color: 0xacb0b4, roughness: 0.95 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x10161f, metalness: 0, roughness: 0.08,
      transparent: true, opacity: 0.3, side: THREE.DoubleSide
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.6, metalness: 0.3 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7b838a, roughness: 0.4, metalness: 0.5 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xa8382c, roughness: 0.8 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.25, metalness: 0.9 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xb7a03c, roughness: 0.7 });

    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      car.add(m);
      return m;
    };

    box(3.2, 0.08, 18.4, floorMat, 0, -0.04, 0);
    box(3.2, 0.08, 18.4, ceilMat, 0, 2.59, 0);

    const CAR_L = 16.6;
    for (const side of [-1, 1]) {
      box(0.1, 0.95, CAR_L, panelMat, side * 1.56, 0.5, 0);
      box(0.1, 0.5, CAR_L, panelMat, side * 1.56, 2.3, 0);
      const glass = box(0.04, 1.1, CAR_L - 0.2, glassMat, side * 1.56, 1.5, 0);
      glass.renderOrder = 2;
      for (let i = 0; i < 7; i++) {
        box(0.09, 1.18, 0.1, frameMat, side * 1.56, 1.5, -8 + i * 2.67 + 1.3);
      }
      box(0.05, 0.06, CAR_L, frameMat, side * 1.56, 0.95, 0);
      box(0.05, 0.06, CAR_L, frameMat, side * 1.56, 2.05, 0);
      box(0.05, 0.06, CAR_L, yellowMat, side * 1.58, 0.16, 0);

      const route = new THREE.Mesh(
        new THREE.PlaneGeometry(7.5, 0.42),
        new THREE.MeshStandardMaterial({ map: T.route, roughness: 0.9 })
      );
      route.position.set(side * 1.55, 2.3, 0);
      route.rotation.y = -side * Math.PI / 2;
      car.add(route);

      const bench = box(0.52, 0.1, 5.4, seatMat, side * 1.28, 0.45, 2.2);
      bench.castShadow = false;
      box(0.09, 0.62, 5.4, seatMat, side * 1.5, 0.75, 2.2);
    }

    for (const z of [-7.7, 7.7]) {
      for (const x of [-0.76, 0.76]) {
        box(1.44, 2.02, 0.07, doorMat, x, 1.01, z);
        const dw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), glassMat);
        dw.position.set(x, 1.32, z + Math.sign(z) * 0.045);
        car.add(dw);
      }
      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 1.45),
        new THREE.MeshStandardMaterial({ map: T.poster2, roughness: 0.9 })
      );
      poster.position.set(-1.54, 1.15, z + Math.sign(z) * 0.05);
      poster.rotation.y = Math.PI / 2;
      car.add(poster);
      const posterB = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 1.45),
        new THREE.MeshStandardMaterial({ map: T.poster, roughness: 0.9 })
      );
      posterB.position.set(1.54, 1.15, z - Math.sign(z) * 0.05);
      posterB.rotation.y = -Math.PI / 2;
      car.add(posterB);
    }

    box(0.06, 0.06, 15.4, poleMat, 0, 2.02, 0);
    for (const [x, z] of [[-0.9, -4.6], [0.9, -4.6], [-0.9, 4.6], [0.9, 4.6]]) {
      box(0.05, 1.1, 0.05, poleMat, x, 1.45, z);
    }
    for (const z of [-2.6, 2.6]) {
      const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 10), poleMat);
      cy.rotation.z = Math.PI / 2;
      cy.position.set(0, 1.55, z);
      car.add(cy);
      box(0.05, 0.05, 0.05, strapMat, 0, 2.03, z);
    }
    for (const z of [-4.6, 4.6]) {
      box(0.09, 0.09, 0.09, strapMat, -0.9, 2.0, z);
      box(0.7, 0.03, 0.02, strapMat, -0.9, 1.83, z);
    }

    this.lightMats = [];
    for (const x of [-0.55, 0.55]) {
      for (let i = 0; i < 4; i++) {
        const g = new THREE.PointLight(0xffe9b8, 3.5, 6, 1.8);
        g.position.set(x, 2.4, -6.3 + i * 4.2);
        car.add(g);
        const lm = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.05, 1.5),
          new THREE.MeshBasicMaterial({ color: 0xfff3d2, toneMapped: false })
        );
        lm.position.set(x, 2.5, -6.3 + i * 4.2);
        car.add(lm);
        this.lightMats.push(lm.material);
      }
    }
    this.carLights = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const cy = new THREE.CylinderGeometry(0.045, 0.045, 2.2, 8);
      const m = new THREE.Mesh(cy, poleMat);
      m.position.set(-1.05, 1.35, -7 + i * 2.0);
      this.carLights.add(m);
    }
    car.add(this.carLights);
  }

  makePassenger(seated, palette) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: palette.shirt, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.9 });

    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      g.add(m);
      return m;
    };
    const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
    const sphere = (r) => new THREE.SphereGeometry(r, 14, 12);

    if (seated) {
      const T = new THREE.Group();
      g.add(T);
      add(capsule(0.17, 0.42), shirt, 0, 0.83, 0);
      const head = add(sphere(0.115), skin, 0, 1.42, 0);
      head.scale.set(1, 1.12, 1);
      add(sphere(0.117), hair, 0, 1.47, -0.025);
      g.children[g.children.length - 1].scale.set(1, 0.8, 1);
      add(capsule(0.05, 0.36), shirt, -0.185, 0.84, 0.02, 0, 0, 0.22);
      add(capsule(0.05, 0.36), shirt, 0.185, 0.84, 0.02, 0, 0, -0.22);
      add(capsule(0.075, 0.4), pants, -0.1, 0.5, 0.26, Math.PI / 2.2, 0, 0);
      add(capsule(0.075, 0.4), pants, 0.1, 0.5, 0.26, Math.PI / 2.2, 0, 0);
      g.userData.seated = true;
    } else {
      add(capsule(0.075, 0.5), pants, -0.105, 0.5, 0);
      add(capsule(0.075, 0.5), pants, 0.105, 0.5, 0);
      add(capsule(0.165, 0.44), shirt, 0, 1.14, 0);
      const head = add(sphere(0.115), skin, 0, 1.7, 0);
      head.scale.set(1, 1.12, 1);
      add(sphere(0.117), hair, 0, 1.75, -0.025);
      g.children[g.children.length - 1].scale.set(1, 0.8, 1);
      add(capsule(0.05, 0.4), shirt, -0.19, 1.1, 0, 0, 0, 0.14);
      add(capsule(0.05, 0.4), shirt, 0.19, 1.1, 0, 0, 0, -0.14);
      g.userData.seated = false;
    }
    g.userData.sway = Math.random() * Math.PI * 2;
    return g;
  }

  passengerPalette() {
    const skins = [0x8d5f43, 0x6c4632, 0xa97453, 0x5c3a2b, 0x96705a];
    const shirts = [0x23384f, 0x4f2f33, 0x2c3228, 0x403825, 0x5a4633, 0x333d4a, 0x6e2030];
    const hairs = [0x17110b, 0x2a1c10, 0x524033, 0x0d0d10];
    const pick = (a) => a[(Math.random() * a.length) | 0];
    return { skin: pick(skins), shirt: pick(shirts), hair: pick(hairs) };
  }

  buildPassengers() {
    this.passengers = [];

    const seats = [
      { x: -1.28, z: 3.6, rot: -Math.PI / 2 },
      { x: -1.28, z: 5.0, rot: -Math.PI / 2 },
      { x: -1.28, z: -0.2, rot: -Math.PI / 2 },
      { x: 1.28, z: 3.1, rot: Math.PI / 2 },
      { x: 1.28, z: 4.6, rot: Math.PI / 2 }
    ];
    for (const s of seats) {
      const p = this.makePassenger(true, this.passengerPalette());
      p.position.set(s.x, 0.1, s.z);
      p.rotation.y = s.rot;
      this.car.add(p);
      this.passengers.push(p);
    }
    const stand = [ { x: -0.9, z: -4.6 }, { x: 0.55, z: 2.7 } ];
    for (const s of stand) {
      const p = this.makePassenger(false, this.passengerPalette());
      p.position.set(s.x, 0, s.z);
      p.rotation.y = Math.random() * 0.6 - 0.3;
      this.car.add(p);
      this.passengers.push(p);
    }
  }

  buildExterior() {
    const T = this.T;
    const ext = new THREE.Group();
    this.ext = ext;
    this.scene.add(ext);

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x0e0f13 });
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), blackMat);
    fg.rotation.x = -Math.PI / 2;
    fg.position.set(0, -4.5, 0);
    ext.add(fg);
    const cg = new THREE.Mesh(new THREE.PlaneGeometry(30, 90), blackMat);
    cg.rotation.x = Math.PI / 2;
    cg.position.set(0, 5.6, 0);
    ext.add(cg);

    const tunnelMatL = new THREE.MeshBasicMaterial({
      map: repeatTex(T.tunnel, 4, 1), color: 0xffffff, side: THREE.DoubleSide
    });
    const tunnelMatR = tunnelMatL.clone();
    tunnelMatR.map = repeatTex(T.tunnel, 4, 1);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(96, 7.5), tunnelMatL);
    wl.rotation.y = Math.PI / 2;
    wl.position.set(-2.3, 3.4, 0);
    ext.add(wl);
    const wr = new THREE.Mesh(new THREE.PlaneGeometry(96, 7.5), tunnelMatR);
    wr.rotation.y = -Math.PI / 2;
    wr.position.set(2.3, 3.4, 0);
    ext.add(wr);
    this.tunnelMats = [tunnelMatL, tunnelMatR];

    const lightGeo = new THREE.BoxGeometry(0.08, 0.1, 0.55);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe3a0, toneMapped: false });
    const count = 48;
    this.lights = new THREE.InstancedMesh(lightGeo, lightMat, count * 2);
    this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lightMatrix = new THREE.Matrix4();
    this.lightCount = count;
    ext.add(this.lights);

    const st = new THREE.Group();
    this.station = st;
    ext.add(st);
    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.55, 26),
      new THREE.MeshStandardMaterial({ color: 0x4c5054, roughness: 0.9 })
    );
    plat.position.set(4.2, 0.28, 0);
    st.add(plat);
    const signMat = new THREE.MeshBasicMaterial({ map: T.station, toneMapped: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), signMat);
    sign.position.set(2.7, 2.7, 0);
    sign.rotation.y = -Math.PI / 2;
    st.add(sign);
    const sign2 = sign.clone();
    sign2.position.set(2.7, 2.7, -10);
    st.add(sign2);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false });
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 1.6), stripMat);
      l.position.set(2.5, 3.6, -11 + i * 5.5);
      st.add(l);
    }
    const figMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.6 });
    const fig = new THREE.Group();
    const figBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.05, 4, 10), figMat);
    figBody.position.y = 1.05;
    const figHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), figMat);
    figHead.position.y = 1.78;
    fig.add(figBody, figHead);
    fig.position.set(2.7, 0.55, 1.4);
    st.add(fig);
    this.fig = fig;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x30343a }));
    bench.position.set(4.4, 0.8, -4);
    st.add(bench);
    for (const z of [-7, 7]) {
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2222, toneMapped: false }));
      red.position.set(-2.24, 1.6, z);
      st.add(red);
    }
  }

  fx() {
    return Math.max(0, this.stress * 1.15 + (this.speed > 30 ? (this.speed - 30) / 130 : 0));
  }

  update(dt, tGlobal) {
    this.t += dt;
    const tt = this.t;

    if (tt >= DEPART && !this.phaseDone && !this.returnMode) {
      const t = tt - DEPART;
      const base = 24 * (1 - Math.exp(-t / 4.5));
      this.stress = Math.min(1, Math.max(0, (tt - HYPER_T) / 2.6));
      this.speed = base * (1 + this.stress * 4.2);
      this.dist += this.speed * dt;
    }
    if (tt >= DEPART && !this.phaseDone && this.returnMode) {
      const t = tt - DEPART;
      const base = 20 * (1 - Math.exp(-t / 4));
      let s = base;
      if (tt > 11.8) {
        const e = Math.max(0, Math.min(1, (tt - 11.8) / 1.4));
        s = base * (1 - e * e);
      }
      this.speed = Math.max(0, s);
      this.stress = 0;
      this.dist += this.speed * dt;
    }

    this.updateExterior();
    this.updateShake(dt);

    if (!this.returnMode) {
      if (!this._flagged.a2 && tt > 11.3) {
        this._flagged.a2 = true;
        this.audio.say('Attention passengers. This is the final stop on this line. Hold on.');
      }
      if (!this._flagged.fl && tt > 11.6) {
        this._flagged.fl = true;
        this.audio.screech(true);
      }
      if (!this._flagged.end && tt > 13.9) {
        this._flagged.end = true;
        this.audio.subHit();
      }
      if (!this._flagged.fade && tt > 15.05) {
        this._flagged.fade = true;
        this.ui.setFade('#000000', 0.55, true);
      }
      if (!this._flagged.done && tt > END_T) {
        this._flagged.done = true;
        this.phaseDone = true;
        this.audio.stopRumble();
        this.audio.screech(false);
        this.audio.stopWhoosh();
        const cb = this.done;
        setTimeout(() => cb(), 130);
      }
    } else {
      if (!this._flagged.a2 && tt > 10.6) {
        this._flagged.a2 = true;
        this.audio.say('Attention passengers. Welcome back. This is the last station. Again.');
      }
      if (!this._flagged.hiss && tt > 13.4 && this.speed < 0.5) {
        this._flagged.hiss = true;
        this.audio.hiss(1.6);
        this.audio.subHit();
      }
      if (!this._flagged.fade && tt > 14.6) {
        this._flagged.fade = true;
        this.ui.setFade('#000000', 0.8, true);
      }
      if (!this._flagged.done && tt > 15.6) {
        this._flagged.done = true;
        this.phaseDone = true;
        this.audio.stopRumble();
        const cb = this.done;
        setTimeout(() => cb(), 400);
      }
    }

    const stress = this.stress;
    for (const lm of this.lightMats) {
      if (Math.random() < 0.004 + stress * 0.06) {
        lm.color.setRGB(0.2 + Math.random() * 0.8, 0.19, 0.15);
      } else {
        lm.color.setRGB(1, 0.95, 0.82);
      }
    }

    this.audio.setRumble(Math.min(1, this.speed / 90), stress);
    this.camera.position.set(0.42 + this.shakeX, 1.5 + this.shakeY, 2.0);
    this.look.apply();
  }

  updateShake(dt) {
    const s = Math.min(1, this.speed / 26);
    this.vib = (0.002 + s * 0.004 + this.stress * 0.014) * (0.5 + (this.t % 0.03) / 0.03);
    this.shakeX = Math.sin(this.t * 31) * 0.012 * this.stress + (Math.random() - 0.5) * 0.006 * s;
    this.shakeY = Math.sin(this.t * 27) * 0.008 * this.stress + (Math.random() - 0.5) * 0.005 * s;
  }

  updateExterior() {
    const D = this.dist;
    this.tunnelMats[0].map.offset.x = D / 24;
    this.tunnelMats[1].map.offset.x = D / 24;

    const m = this.lightMatrix;
    for (let i = 0; i < this.lightCount; i++) {
      const z = -36 + ((i * 3 + D) % 72);
      m.identity();
      m.setPosition(-2.26, 1.6, z);
      this.lights.setMatrixAt(i * 2, m);
      m.identity();
      m.setPosition(2.26, 1.6, z);
      this.lights.setMatrixAt(i * 2 + 1, m);
    }
    this.lights.instanceMatrix.needsUpdate = true;

    this.station.position.z = -24 + (D % 96);
    this.station.visible = Math.abs(this.station.position.z) < 40;
    this.fig.rotation.y = Math.sin(this.t * 0.7) * 0.4;
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
