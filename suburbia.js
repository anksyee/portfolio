import * as THREE from 'three';
import { makeTextures } from './textures.js?v=4';
import { Look } from './look.js?v=4';
import { PlayerController } from './player.js?v=4';

// liminal suburbia: perfect blue sky, a full grid of streets, mowed
// striped lawns, sidewalks, intersections — and identical gable houses
// in every solid color, facing every street.
const BLOCK = 60;          // block size; streets run along block edges
const ROAD_W = 8;
const FRONT_SET = 14;      // house front line inset from block edge
const HOUSE_DEPTH = 7.5;
const HOUSE_FRONT = 6.0;
const HOUSE_H = 2.7;
const SIDE_OFF = [10, 30]; // house offsets along each street edge

const PALETTE = [
  '#c85144', '#e6a23c', '#8fbf4d', '#4aa26f', '#57b8c2',
  '#c98a5a', '#b4574e', '#7fb069', '#4a8fc6', '#d98f6e'
];

function hash(seed) {
  let n = seed | 0;
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}
const seed3 = (bx, bz, i) => (bx * 92821 + bz * 68917 + i * 131 + 5) | 0;

export class Suburbia {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x3d82e2); // perfect blue sky
    this.scene.fog = new THREE.FogExp2(0xb6cbe0, 0.0075);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 400);
    this.look = new Look(this.camera, 0.0021, 1.5);
    this.player = new PlayerController({ run: 7.2, jumpV: 6.0 });

    this.T = makeTextures();
    this.build();
    this.blocks = new Map();
    this.cell = null;
    this.doorTarget = null;
    this.stepTimer = 0;
    this.rise = 0;
    this.watcherTimer = 12;
    this.lockedTried = new Set();
    this.greenDoor = null;
    this.greenOpen = false;
    this.greenEntered = false;
    this.doorGreenMat = new THREE.MeshStandardMaterial({ color: 0x1f7a32, roughness: 0.65 });
  }

  build() {
    const scene = this.scene;

    this.hemi = new THREE.HemisphereLight(0xcfe0f5, 0x51703f, 0.65);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff4dc, 1.15);
    sun.position.set(35, 70, -15);
    scene.add(sun);

    // mowed lawn: stripe bands across the block (run toward the horizon)
    {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 32;
      const g = c.getContext('2d');
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#3f913b' : '#4aa244';
        g.fillRect(i * 8, 0, 8, 32);
      }
      for (let i = 0; i < 400; i++) {
        g.globalAlpha = 0.12;
        g.fillStyle = Math.random() > 0.5 ? '#2f7d2e' : '#63b155';
        g.fillRect((Math.random() * 128) | 0, (Math.random() * 32) | 0, 2, 2);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(9, 1);
      this.lawnMat = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    }
    // road: plain asphalt with fine speckle
    {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#575a5e';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 800; i++) {
        g.globalAlpha = 0.1;
        g.fillStyle = Math.random() > 0.5 ? '#616468' : '#4a4d51';
        g.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 2, 2);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(1, 14);
      this.roadMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    }
    // sidewalk: pale concrete with joint lines
    {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#d2cfc4';
      g.fillRect(0, 0, 32, 64);
      g.strokeStyle = '#b5b2a6';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 2);
      g.lineTo(32, 2);
      g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(1, 29);
      this.walkMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }

    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.85 });
    this.doorMat = new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.7 });
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x7fb0d8, roughness: 0.4 });
    this.porchMat = new THREE.MeshStandardMaterial({ color: 0xc9c6bb, roughness: 0.85 });

    this.bodyGeo = new THREE.BoxGeometry(HOUSE_FRONT, HOUSE_H, HOUSE_DEPTH);
    this.slopeGeo = new THREE.BoxGeometry(3.3, 0.15, HOUSE_DEPTH + 1.2);
    const gv = new Float32Array([
      -HOUSE_FRONT / 2, 0, -HOUSE_DEPTH / 2, HOUSE_FRONT / 2, 0, -HOUSE_DEPTH / 2, 0, 1.0, -HOUSE_DEPTH / 2,
      -HOUSE_FRONT / 2, 0, HOUSE_DEPTH / 2, 0, 1.0, HOUSE_DEPTH / 2, HOUSE_FRONT / 2, 0, HOUSE_DEPTH / 2
    ]);
    this.gableGeo = new THREE.BufferGeometry();
    this.gableGeo.setAttribute('position', new THREE.BufferAttribute(gv, 3));
    this.gableGeo.computeVertexNormals();

    this.ghost = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 1.45, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 1 })
    );
    this.ghost.visible = false;
    scene.add(this.ghost);
  }

  makeHouse(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    const body = new THREE.Mesh(this.bodyGeo, bodyMat);
    body.position.y = HOUSE_H / 2;
    g.add(body);
    const gable = new THREE.Mesh(this.gableGeo, bodyMat);
    gable.position.y = HOUSE_H;
    g.add(gable);
    const s1 = new THREE.Mesh(this.slopeGeo, this.roofMat);
    s1.rotation.z = 0.42;
    s1.position.set(-1.7, HOUSE_H + 0.42, 0);
    const s2 = new THREE.Mesh(this.slopeGeo, this.roofMat);
    s2.rotation.z = -0.42;
    s2.position.set(1.7, HOUSE_H + 0.42, 0);
    g.add(s1, s2);
    for (const fz of [-HOUSE_DEPTH / 2 + 0.6, HOUSE_DEPTH / 2 - 0.6]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), this.roofMat);
      fin.position.set(0, HOUSE_H + 1.12, fz);
      g.add(fin);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, 0.1), this.doorMat);
    door.position.set(0, 1.02, HOUSE_DEPTH / 2 + 0.02);
    g.add(door);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.7), this.porchMat);
    step.position.set(0, 0.07, HOUSE_DEPTH / 2 + 0.42);
    g.add(step);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), this.windowMat);
    win.position.set(0, HOUSE_H + 0.42, HOUSE_DEPTH / 2 + 0.02);
    g.add(win);
    g.userData.doorMesh = door;
    return g;
  }

  start(audio, ui, done) {
    this.audio = audio;
    this.ui = ui;
    this.done = done;
    this.player.pos.set(30, 0, 30);
    this.player.vel.set(0, 0, 0);
    this.look.yaw = Math.PI;
    this.look.pitch = -0.03;
    this.cell = null;
    this.stepTimer = 0;
    this.rise = 0;
    this.doorTarget = null;
    this.watcherTimer = 12;
    this.lockedTried = new Set();
    this.greenDoor = null;
    this.greenOpen = false;
    this.greenEntered = false;
    audio.stopHum();
    audio.wind();
    audio.say('It is always noon here.');
    setTimeout(() => this.audio.say('Same house. Same house. Same house. None of them are yours.'), 18000);
  }

  fx() { return 0.01; }

  // house lots: 8 per block, fronting all four streets
  houseSpots(bx, bz) {
    const spots = [];
    const w = bx * BLOCK, z0 = bz * BLOCK;
    for (const s of SIDE_OFF) {
      spots.push([w + FRONT_SET + HOUSE_DEPTH / 2, z0 + s, -Math.PI / 2]);       // west row, faces -X
      spots.push([w + BLOCK - FRONT_SET - HOUSE_DEPTH / 2, z0 + s, Math.PI / 2]); // east row, faces +X
      spots.push([w + s, z0 + FRONT_SET + HOUSE_DEPTH / 2, Math.PI]);           // south row, faces -Z
      spots.push([w + s, z0 + BLOCK - FRONT_SET - HOUSE_DEPTH / 2, 0]);         // north row, faces +Z
    }
    return spots;
  }

  blockedHouse(x, z) {
    const bx = Math.floor(x / BLOCK), bz = Math.floor(z / BLOCK);
    const r = this.player.radius;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = bx + dx, c = bz + dz;
        const spots = this.houseSpots(b, c);
        for (let i = 0; i < spots.length; i++) {
          const [hx, hz] = spots[i];
          const wide = (i >> 1) & 1; // rows 0|2 are depth-x? compute per row
          // row 0/1 (west/east): depth along X; row 2/3 (south/north): depth along Z
          if (i < 2) {
            if (Math.abs(x - hx) < HOUSE_DEPTH / 2 + r && Math.abs(z - hz) < HOUSE_FRONT / 2 + r) return true;
          } else {
            if (Math.abs(x - hx) < HOUSE_FRONT / 2 + r && Math.abs(z - hz) < HOUSE_DEPTH / 2 + r) return true;
          }
        }
      }
    }
    return false;
  }

  update(dt, tGlobal) {
    const p = this.player;
    const res = p.update(dt, this.look.yaw, (x, z) => this.blockedHouse(x, z));
    this.rise = Math.max(0, this.rise - dt * 0.5);
    this.look.pitch += (0 - this.look.pitch) * Math.min(1, dt * 1.5);
    this.camera.position.set(p.pos.x, p.pos.y + p.eye + this.rise, p.pos.z);
    this.look.apply();

    const bx = Math.floor(p.pos.x / BLOCK), bz = Math.floor(p.pos.z / BLOCK);
    if (!this.cell || this.cell[0] !== bx || this.cell[1] !== bz) {
      this.cell = [bx, bz];
      this.updateChunks(bx, bz);
    }

    if (res.moving > 0.5 && res.ground) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = res.moving > 4.5 ? 0.34 : 0.5;
        this.audio.step();
      }
    }

    this.updateDoorPrompt(p);

    if (this.greenDoor && !this.greenEntered) {
      const gd = Math.hypot(this.greenDoor[0] - p.pos.x, this.greenDoor[1] - p.pos.z);
      if (gd < 2.6) {
        this.greenOpen = true;
        this.ui && this.ui.setPrompt && this.ui.setPrompt(null);
      }
      if (this.greenOpen && this.greenDoorMesh && this.greenDoorMesh.position.y > -2.3) {
        this.greenDoorMesh.position.y -= dt * 2.4;
      }
      if (gd < 0.9) {
        this.greenEntered = true;
        this.audio.hiss(1.4);
        this.ui.setPrompt(null);
        this.ui.setFade('#000000', 0.9, true);
        setTimeout(() => this.done && this.done(), 1050);
      }
    }

    this.watcherTimer -= dt;
    if (this.watcherTimer <= 0) {
      this.spawnWatcher(bx, bz);
      this.watcherTimer = 30 + Math.random() * 25;
    }
    if (this.ghost.visible) {
      const gxp = this.ghost.position.x - p.pos.x;
      const gzp = this.ghost.position.z - p.pos.z;
      this.ghost.rotation.y = Math.atan2(gxp, gzp);
      this.ghost.position.y = 1.15 + Math.sin(tGlobal * 0.4) * 0.06;
      if (Math.hypot(gxp, gzp) < 14) {
        this.ghost.visible = false;
        this.audio.crackle(0.04);
      }
    }
  }

  spawnWatcher(bx, bz) {
    const side = Math.floor(Math.random() * 4);
    const s = 8 + Math.random() * 18;
    let lx, lz;
    if (side < 2) {
      lx = bx * BLOCK + (side ? BLOCK - FRONT_SET - 8 : FRONT_SET + 2);
      lz = bz * BLOCK + s;
    } else {
      lx = bx * BLOCK + s;
      lz = bz * BLOCK + (side === 2 ? FRONT_SET + 2 : BLOCK - FRONT_SET - 8);
    }
    this.ghost.position.set(lx, 1.15, lz);
    this.ghost.visible = true;
  }

  updateChunks(bx, bz) {
    const scene = this.scene;
    const rm = [];
    for (const [k, objs] of this.blocks) {
      const [a, b] = k.split(',').map(Number);
      if (Math.abs(a - bx) > 2 || Math.abs(b - bz) > 2) {
        for (const o of objs) scene.remove(o);
        rm.push(k);
      }
    }
    for (const k of rm) this.blocks.delete(k);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = bx + dx, c = bz + dz;
        const key = `${b},${c}`;
        if (this.blocks.has(key)) continue;
        const objs = [];
        this.buildChunk(b, c, objs);
        this.blocks.set(key, objs);
      }
    }
    if (this.greenDoor) this.applyGreenDoor();
  }

  buildChunk(bx, bz, objs) {
    const scene = this.scene;
    const wx = bx * BLOCK, wz = bz * BLOCK;

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), this.lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(wx + BLOCK / 2, 0, wz + BLOCK / 2);
    scene.add(lawn);
    objs.push(lawn);

    // streets along owned east + north edges
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, BLOCK), this.roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(wx + BLOCK, 0.012, wz + BLOCK / 2);
    scene.add(roadV);
    objs.push(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, ROAD_W), this.roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(wx + BLOCK / 2, 0.012, wz + BLOCK);
    scene.add(roadH);
    objs.push(roadH);
    // sidewalks inside along all four edges (each road is lined on both sides)
    for (const [sxp, szp, r] of [
      [wx + 1.1, wz + BLOCK / 2, true],
      [wx + BLOCK - 1.1, wz + BLOCK / 2, true],
      [wx + BLOCK / 2, wz + 1.1, false],
      [wx + BLOCK / 2, wz + BLOCK - 1.1, false]
    ]) {
      const walk = new THREE.Mesh(r ? new THREE.PlaneGeometry(1.5, BLOCK) : new THREE.PlaneGeometry(BLOCK, 1.5), this.walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(sxp, 0.02, szp);
      scene.add(walk);
      objs.push(walk);
    }

    const spots = this.houseSpots(bx, bz);
    for (let i = 0; i < spots.length; i++) {
      const [hx, hz, rot] = spots[i];
      const color = PALETTE[(hash(seed3(bx, bz, i)) * PALETTE.length) | 0];
      const house = this.makeHouse(color);
      house.position.set(hx, 0, hz);
      house.rotation.y = rot;
      const fxp = hx + Math.sin(rot) * (HOUSE_DEPTH / 2);
      const fzp = hz + Math.cos(rot) * (HOUSE_DEPTH / 2);
      house.userData.front = [fxp, fzp];
      scene.add(house);
      objs.push(house);
    }
  }

  updateDoorPrompt(p) {
    const bx = Math.floor(p.pos.x / BLOCK), bz = Math.floor(p.pos.z / BLOCK);
    let best = null, bestD = 1e9;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = bx + dx, c = bz + dz;
        const spots = this.houseSpots(b, c);
        for (let i = 0; i < spots.length; i++) {
          const [hx, hz, rot] = spots[i];
          // front face position (local +z rotated by rot)
          const fxp = hx + Math.sin(rot) * (HOUSE_DEPTH / 2 + 0.1);
          const fzp = hz + Math.cos(rot) * (HOUSE_DEPTH / 2 + 0.1);
          const d = Math.hypot(fxp - p.pos.x, fzp - p.pos.z);
          if (d < 2.0 && d < bestD) {
            bestD = d;
            best = [fxp, fzp];
          }
        }
      }
    }
    this.doorTarget = best;
    this.ui && this.ui.setPrompt && this.ui.setPrompt(best ? '[ E ] TRY THE DOOR' : null);
  }

  interact() {
    if (!this.doorTarget) return;
    const [dx, dz] = this.doorTarget;
    if (this.greenDoor && Math.hypot(this.greenDoor[0] - dx, this.greenDoor[1] - dz) < 1.2) return;
    this.audio.step();
    this.ui.showLine('LOCKED.');
    const key = dx.toFixed(1) + ',' + dz.toFixed(1);
    if (!this.lockedTried.has(key)) {
      this.lockedTried.add(key);
      if (this.lockedTried.size >= 10 && !this.greenDoor) {
        // the tenth door you tried turns green — it leads out
        this.greenDoor = [dx, dz];
        this.audio.subHit();
        this.ui.showLine('Find the green door.', 6000);
        this.applyGreenDoor();
      }
    }
  }

  applyGreenDoor() {
    if (!this.greenDoor) return;
    for (const objs of this.blocks.values()) {
      for (const o of objs) {
        if (!o.isGroup || !o.userData.front) continue;
        const [fx, fz] = o.userData.front;
        if (Math.hypot(fx - this.greenDoor[0], fz - this.greenDoor[1]) > 1.2) continue;
        if (o.userData.green) continue;
        o.userData.green = true;
        o.userData.doorMesh.material = this.doorGreenMat;
        this.greenDoorMesh = o.userData.doorMesh;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.T.glow, color: 0x3fd960, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        }));
        glow.scale.set(1.6, 1.6, 1);
        glow.position.set(0, 1.4, HOUSE_DEPTH / 2 + 0.2);
        o.add(glow);
        const light = new THREE.PointLight(0x46e070, 4, 8, 1.8);
        light.position.set(0, 1.9, HOUSE_DEPTH / 2 + 0.3);
        o.add(light);
      }
    }
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
