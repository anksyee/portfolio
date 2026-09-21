import * as THREE from 'three';
import { makeTextures, repeatTex } from './textures.js?v=4';
import { Look } from './look.js?v=4';
import { PlayerController } from './player.js?v=4';

const CELL = 8;
const WALL_T = 0.22;
const WALL_H = 3;
const HW = 1.7;      // corridor half width (3.4m corridor)
const DOOR_W = 1.5;  // interface door width
const NOOK_W = 1.15; // nook door width
const R2 = 3;

function rnd(seed) {
  let n = seed | 0;
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}
const cellKey = (cx, cz) => `${cx},${cz}`;
function edgeSeed(cx, cz, d) { return (cx * 92821 + cz * 68917 + d * 31337) | 0; }

function isClosed(cx, cz, d) {
  if (rnd(edgeSeed(cx, cz, d)) >= 0.66) return false;
  let others;
  if (d === 0) others = [edgeSeed(cx, cz, 1), edgeSeed(cx - 1, cz, 0), edgeSeed(cx, cz - 1, 1)];
  else others = [edgeSeed(cx, cz, 0), edgeSeed(cx - 1, cz, 0), edgeSeed(cx, cz - 1, 1)];
  const closedOthers = others.filter((s) => rnd(s) < 0.66).length;
  if (closedOthers >= 3) return false;
  return true;
}

// radial banding: wide rooms (doorless) → tight hallways → wide rooms...
// cycle ≈ 15 cells (120m); wide shells are deep so the player explores a
// good while before the first hallway appears.
function zoneBand(cx, cz) {
  const w = (rnd(edgeSeed(cx, cz, 9)) - 0.5) * 1.1;
  const d = Math.hypot(cx, cz) + w;
  return ((d % 15) + 15) % 15;
}
function cellPattern(cx, cz) {
  const m = zoneBand(cx, cz);
  if (m < 10.5) return 'ROOM'; // wide space: clean, doorless, deep
  const s = rnd(edgeSeed(cx, cz, 3));
  const tx = -cz, tz = cx; // ring tangent direction
  if (s < 0.12) return 'J';
  return Math.abs(tx) >= Math.abs(tz) ? 'X' : 'Z';
}
const cor = (q) => q === 'X' || q === 'Z' || q === 'J';

const TH = WALL_T / 2;
const DH = DOOR_W / 2 - 0.005; // wall break half-width for interface doors (= slab width)
const NOOK_A = NOOK_W / 2 + 0.005;

// ---- geometry spec per cell: wall rects + doors (deterministic) ----
// Wall rects are broken exactly around door gaps so a closed slab seals the wall.
function segsOf(cx, cz) {
  const p = cellPattern(cx, cz);
  const x0 = cx * CELL, z0 = cz * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
  const xc = x0 + CELL / 2, zc = z0 + CELL / 2;
  const rects = [];
  const doors = [];
  const R = (x0_, x1_, z0_, z1_) => rects.push({ x0: x0_, x1: x1_, z0: z0_, z1: z1_ });
  const D = (o, x, z, w) => doors.push({ o, x, z, w, state: 0, slide: 0 });
  const nE = cellPattern(cx + 1, cz), nN = cellPattern(cx, cz + 1);
  const nW = cellPattern(cx - 1, cz), nS = cellPattern(cx, cz - 1);

  if (p === 'ROOM') {
    // wide space: fully doorless. Edges facing the hallway shells are walled
    // off — occasionally with a plain (doorless) opening into the narrow
    // architecture. No slab, no red door, nothing visible inside the wide space.
    if (cor(nE)) {
      if (rnd(edgeSeed(cx, cz, 10)) < 0.5) {
        R(x1 - TH, x1 + TH, z0, zc - DH);
        R(x1 - TH, x1 + TH, zc + DH, z1);
      } else {
        R(x1 - TH, x1 + TH, z0, z1);
      }
    } else if (isClosed(cx, cz, 0)) {
      R(x1 - TH, x1 + TH, z0, z1);
    }
    if (cor(nN)) {
      if (rnd(edgeSeed(cx, cz, 11)) < 0.5) {
        R(x0, xc - DH, z1 - TH, z1 + TH);
        R(xc + DH, x1, z1 - TH, z1 + TH);
      } else {
        R(x0, x1, z1 - TH, z1 + TH);
      }
    } else if (isClosed(cx, cz, 1)) {
      R(x0, x1, z1 - TH, z1 + TH);
    }
    if (rnd(edgeSeed(cx, cz, 7)) < 0.12) R(xc - 0.45, xc + 0.45, zc - 0.45, zc + 0.45);
    return { p, rects, doors };
  }

  if (p === 'J') {
    // cross junction: X through, Z through, corner pockets sealed
    R(x0, xc - HW - TH, zc - HW - TH, zc - HW + TH);
    R(xc + HW + TH, x1, zc - HW - TH, zc - HW + TH);
    R(x0, xc - HW - TH, zc + HW - TH, zc + HW + TH);
    R(xc + HW + TH, x1, zc + HW - TH, zc + HW + TH);
    R(xc - HW - TH, xc - HW + TH, z0, zc - HW - TH);
    R(xc + HW - TH, xc + HW + TH, z0, zc - HW - TH);
    R(xc - HW - TH, xc - HW + TH, zc + HW + TH, z1);
    R(xc + HW - TH, xc + HW + TH, zc + HW + TH, z1);
    if (nE === 'X' || nE === 'J') {
      R(x1 - TH, x1 + TH, z0, zc - HW);
      R(x1 - TH, x1 + TH, zc + HW, z1);
    } else if (nE === 'ROOM') {
      if (rnd(edgeSeed(cx, cz, 10)) < 0.5) {
        R(x1 - TH, x1 + TH, z0, zc - DH);
        R(x1 - TH, x1 + TH, zc + DH, z1);
      } else {
        R(x1 - TH, x1 + TH, z0, z1);
      }
    } else {
      R(x1 - TH, x1 + TH, z0, zc - DH);
      R(x1 - TH, x1 + TH, zc + DH, z1);
      D('v', x1, zc, DOOR_W);
    }
    if (nN === 'Z' || nN === 'J') {
      R(x0, xc - HW, z1 - TH, z1 + TH);
      R(xc + HW, x1, z1 - TH, z1 + TH);
    } else if (nN === 'ROOM') {
      if (rnd(edgeSeed(cx, cz, 11)) < 0.5) {
        R(x0, xc - DH, z1 - TH, z1 + TH);
        R(xc + DH, x1, z1 - TH, z1 + TH);
      } else {
        R(x0, x1, z1 - TH, z1 + TH);
      }
    } else {
      R(x0, xc - DH, z1 - TH, z1 + TH);
      R(xc + DH, x1, z1 - TH, z1 + TH);
      D('h', xc, z1, DOOR_W);
    }
    return { p, rects, doors };
  }

  // wall builder along X (constant z plane) with red gaps at doorPositions
  const xWall = (zp, positions) => {
    const gaps = positions.slice().sort((a, b) => a - b);
    let cur = x0;
    for (const c of gaps) {
      if (c - NOOK_A > cur) R(cur, c - NOOK_A, zp - TH, zp + TH);
      cur = Math.max(cur, c + NOOK_A);
      D('h', c, zp, NOOK_W);
    }
    if (cur < x1) R(cur, x1, zp - TH, zp + TH);
  };
  const zWall = (xp, positions) => {
    const gaps = positions.slice().sort((a, b) => a - b);
    let cur = z0;
    for (const c of gaps) {
      if (c - NOOK_A > cur) R(xp - TH, xp + TH, cur, c - NOOK_A);
      cur = Math.max(cur, c + NOOK_A);
      D('v', xp, c, NOOK_W);
    }
    if (cur < z1) R(xp - TH, xp + TH, cur, z1);
  };

  if (p === 'X') {
    // hallway runs tangentially around the origin. Both walls are lined with
    // red doors every 2.6m: through them run narrow side-hallways that
    // chain along the block and open up into the wide shells again.
    xWall(zc - HW, [x0 + 1.4, x0 + 4.0, x0 + 6.6]);
    xWall(zc + HW, [x0 + 1.4, x0 + 4.0, x0 + 6.6]);
    // east edge
    if (nE === 'X' || nE === 'J') {
      // open: corridor continues around the ring
    } else if (nE === 'ROOM') {
      if (rnd(edgeSeed(cx, cz, 10)) < 0.5) {
        R(x1 - TH, x1 + TH, z0, zc - DH);
        R(x1 - TH, x1 + TH, zc + DH, z1);
      } else {
        R(x1 - TH, x1 + TH, z0, z1);
      }
    } else {
      R(x1 - TH, x1 + TH, z0, zc - DH);
      R(x1 - TH, x1 + TH, zc + DH, z1);
      D('v', x1, zc, DOOR_W);
    }
    // north edge (owned by this cell): doorless opening when it faces a wide shell
    if (nN === 'X') {
      // parallel corridors
    } else if (nN === 'ROOM') {
      if (rnd(edgeSeed(cx, cz, 11)) < 0.5) {
        R(x0, xc - HW - TH, z1 - TH, z1 + TH);
        R(xc + HW + TH, x1, z1 - TH, z1 + TH);
      } else {
        R(x0, x1, z1 - TH, z1 + TH);
      }
    } else {
      R(x0, xc - HW - TH, z1 - TH, z1 + TH);
      R(xc + HW + TH, x1, z1 - TH, z1 + TH);
    }
    return { p, rects, doors };
  }

  // p === 'Z' (mirror of X)
  zWall(xc - HW, [z0 + 1.4, z0 + 4.0, z0 + 6.6]);
  zWall(xc + HW, [z0 + 1.4, z0 + 4.0, z0 + 6.6]);
  if (nE === 'Z' || nE === 'J') {
    // open
  } else if (nE === 'ROOM') {
    if (rnd(edgeSeed(cx, cz, 10)) < 0.5) {
      R(x1 - TH, x1 + TH, z0, zc - DH);
      R(x1 - TH, x1 + TH, zc + DH, z1);
    } else {
      R(x1 - TH, x1 + TH, z0, z1);
    }
  } else {
    R(x1 - TH, x1 + TH, z0, zc - DH);
    R(x1 - TH, x1 + TH, zc + DH, z1);
    D('v', x1, zc, DOOR_W);
  }
  if (nN === 'Z') {
    // open chain
  } else if (nN === 'X' || nN === 'J') {
    R(x0, xc - HW - TH, z1 - TH, z1 + TH);
    R(xc + HW + TH, x1, z1 - TH, z1 + TH);
  } else if (nN === 'ROOM') {
    if (rnd(edgeSeed(cx, cz, 11)) < 0.5) {
      R(x0, xc - DH, z1 - TH, z1 + TH);
      R(xc + DH, x1, z1 - TH, z1 + TH);
    } else {
      R(x0, x1, z1 - TH, z1 + TH);
    }
  } else {
    R(x0, xc - DH, z1 - TH, z1 + TH);
    R(xc + DH, x1, z1 - TH, z1 + TH);
    D('h', xc, z1, DOOR_W);
  }
  return { p, rects, doors };
}

export class Backrooms {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x8a7b45);
    this.scene.fog = new THREE.FogExp2(fogColor, 0.058);
    this.scene.background = fogColor;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
    this.look = new Look(this.camera, 0.0021, 1.5);
    this.player = new PlayerController({ run: 6.8, jumpV: 5.8 });

    this.T = makeTextures();
    this.build();
    this.cells = new Map();
    this.doorObjs = new Map();
    this.fixtures = new Map();
    this.cell = null;
    this.watcherTimer = 14;
    this.stepTimer = 0;
    this.targetDoor = null;
    this.rise = 0;
  }

  build() {
    const T = this.T;
    const scene = this.scene;

    this.wallMat = new THREE.MeshStandardMaterial({
      map: repeatTex(T.wallpaper, 3.4, 1.05),
      roughness: 0.92
    });
    this.pillarGeo = new THREE.BoxGeometry(0.9, WALL_H, 0.9);
    this.pillarMat = this.wallMat.clone();
    this.pillarMat.map = repeatTex(T.wallpaper, 0.6, 1.2);

    this.floorMat = new THREE.MeshStandardMaterial({
      map: repeatTex(T.carpet, 16, 16),
      roughness: 1
    });
    this.ceilMat = new THREE.MeshStandardMaterial({
      map: repeatTex(T.ceiling, 24, 24),
      color: 0xbdb088,
      roughness: 0.9
    });

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 8, CELL * 8), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    scene.add(this.floor);

    this.ceil = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 8, CELL * 8), this.ceilMat);
    this.ceil.rotation.x = Math.PI / 2;
    this.ceil.position.y = WALL_H;
    scene.add(this.ceil);

    this.frameGeo = new THREE.BoxGeometry(5.6, 0.07, 1.7);
    this.poolGeo = new THREE.PlaneGeometry(6.5, 6.5);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: T.glow.clone(), color: 0xffd784, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    this.poolMat.map.needsUpdate = true;
    this.fluoMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6, toneMapped: false });

    this.hemi = new THREE.HemisphereLight(0xfff2cf, 0x463c1f, 0.5);
    scene.add(this.hemi);
    this.plights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffe9b0, 0, 16, 1.7);
      scene.add(l);
      this.plights.push(l);
    }

    this.watcher = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 1.5, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x100f0c, roughness: 1 })
    );
    this.watcher.visible = false;
    this.watcher.position.y = 1.05;
    scene.add(this.watcher);

    // red doors, backrooms style
    this.doorSlabMat = new THREE.MeshStandardMaterial({ color: 0x96241e, roughness: 0.72 });
    this.doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x2e1c14, roughness: 0.85 });
    this.doorGreenMat = new THREE.MeshStandardMaterial({ color: 0x1f7a32, roughness: 0.65 });
  }

  start(audio, ui, done) {
    this.audio = audio;
    this.ui = ui;
    this.done = done;
    this.player.pos.set(0, 0, 4.5);
    this.player.vel.set(0, 0, 0);
    this.look.yaw = 0;
    this.look.pitch = -0.45;
    this.rise = 0.55;
    this.cell = null;
    this.watcherTimer = 14;
    this.stepTimer = 0;
    this.targetDoor = null;
    this.redOpened = 0;
    this.lastOpenKey = null;
    this.greenKey = null;
    this.greenSpec = null;
    this.greenEntered = false;
    this.wanderT = 0;
    this._foundRed = false;
    this._line1 = false;
    this._line2 = false;
    for (const gr of this.doorObjs.values()) {
      const d = gr.userData.door;
      if (d) {
        d.state = 0;
        d.slide = 0;
      }
      gr.children[3].position.set(0, 1.2, 0);
    }
    audio.hum();
  }

  fx() { return 0.05; }

  interact() {
    if (this.targetDoor && this.targetDoor.state === 0) {
      this.targetDoor.state = 1;
      if (!this.targetDoor.green) this.redOpened++;
      this.lastOpenKey = this.targetDoor._key || null;
      this.audio.hiss(0.9);
    }
  }

  maybeSpawnGreen(cx, cz) {
    if (this.redOpened < 10 || this.greenKey) return;
    let key = null, gr = null;
    // 1) the very door the player just opened — right beside them
    if (this.lastOpenKey) {
      const g = this.doorObjs.get(this.lastOpenKey);
      if (g) {
        key = this.lastOpenKey;
        gr = g;
      }
    }
    // 2) any closed door within 8m
    if (!gr) {
      const px = this.player.pos.x, pz = this.player.pos.z;
      let bestD = 1e9;
      for (const [k, g] of this.doorObjs) {
        const sp = g.userData.door;
        if (!sp || sp.state >= 0.45) continue;
        const d = Math.hypot(sp.x - px, sp.z - pz);
        if (d < bestD) {
          bestD = d;
          key = k;
          gr = g;
        }
      }
      if (bestD > 8) {
        key = null;
        gr = null;
      }
    }
    // 3) any door at all near the player (relock it)
    if (!gr) {
      const px = this.player.pos.x, pz = this.player.pos.z;
      let bestD = 1e9;
      for (const [k, g] of this.doorObjs) {
        const sp = g.userData.door;
        const d = Math.hypot(sp.x - px, sp.z - pz);
        if (d < bestD) {
          bestD = d;
          key = k;
          gr = g;
        }
      }
    }
    if (!gr) return;
    const spec = gr.userData.door;
    spec.state = 0;
    spec.slide = 0;
    gr.children[3].position.set(0, 1.2, 0);
    this.audio.subHit();
    spec.green = true;
    gr.children[3].material = this.doorGreenMat;
    this.greenKey = key;
    this.greenSpec = spec;
    if (!this._line2) {
      this._line2 = true;
      this.ui.showLine('Find a green door.', 6500);
    }
  }

  ensureGreenGlow() {
    if (!this.greenKey) return;
    const gp = this.doorObjs.get(this.greenKey);
    if (!gp || gp.userData.glow) return;
    const spec = gp.userData.door;
    if (!spec || !spec.green) return;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.T.glow, color: 0x3fd960, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    glow.scale.set(1.6, 1.6, 1);
    glow.position.set(0, 1.4, 0);
    gp.add(glow);
    const light = new THREE.PointLight(0x46e070, 4, 8, 1.8);
    light.position.set(0, 1.9, 0);
    gp.add(light);
    gp.userData.glow = true;
  }

  update(dt, tGlobal) {
    const p = this.player;
    const res = p.update(dt, this.look.yaw, (x, z) => this.blocked(x, z));
    if (res.moving > 0.3) this.wanderT += dt;
    if (!this._line1 && this.wanderT > 60) {
      this._line1 = true;
      this.ui.showLine('Find the red door.', 5200);
    }
    this.rise = Math.max(0, this.rise - dt * 0.4);
    this.look.pitch += (0 - this.look.pitch) * Math.min(1, dt * 1.6);
    this.camera.position.set(p.pos.x, p.pos.y + p.eye + this.rise, p.pos.z);
    this.look.apply();

    const cx = Math.floor(p.pos.x / CELL);
    const cz = Math.floor(p.pos.z / CELL);
    const px = cx * CELL + CELL / 2;
    const pz = cz * CELL + CELL / 2;
    this.floor.position.set(px, 0, pz);
    this.ceil.position.set(px, WALL_H, pz);

    if (!this.cell || this.cell[0] !== cx || this.cell[1] !== cz) {
      this.cell = [cx, cz];
      this.updateChunks(cx, cz);
      this.updateLights();
    }
    this.updateDoors(dt);
    this.maybeSpawnGreen(cx, cz);
    if (this.greenKey) {
      const gp = this.doorObjs.get(this.greenKey);
      this.greenSpec = gp ? gp.userData.door : null;
      this.ensureGreenGlow();
    }
    if (this.greenSpec && this.greenSpec.state >= 0.45 && !this.greenEntered) {
      const gd = Math.hypot(this.greenSpec.x - p.pos.x, this.greenSpec.z - p.pos.z);
      if (gd < 0.8) {
        this.greenEntered = true;
        this.audio.hiss(1.4);
        this.ui.setPrompt(null);
        this.ui.setFade('#000000', 0.9, true);
        setTimeout(() => this.done && this.done(), 1050);
      }
    }
    this.updatePrompt(p, cx, cz);

    if (res.moving > 0.5 && res.ground) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = res.moving > 4.5 ? 0.34 : 0.5;
        this.audio.step();
      }
    }

    this.updateFlicker(dt);

    this.watcherTimer -= dt;
    if (this.watcherTimer <= 0) {
      this.spawnWatcher(cx, cz);
      this.watcherTimer = 26 + Math.random() * 20;
    }
    if (this.watcher.visible) {
      const dx = this.watcher.position.x - p.pos.x;
      const dz = this.watcher.position.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      this.watcher.rotation.y = Math.atan2(dx, dz);
      const bob = Math.sin(tGlobal * 6.5) * 0.012;
      this.watcher.position.y = 1.05 + bob + (d > 26 ? Math.sin(tGlobal * 0.4) * 0.08 : 0);
      if (d < 14) {
        this.watcher.visible = false;
        this.watcherTimer = 40;
        this.audio.crackle(0.05);
        this.audio.setHum(0.5);
        setTimeout(() => this.audio.setHum(1), 2500);
        setTimeout(() => this.audio.subHit(), 2600);
      }
    }
  }

  spawnWatcher(cx, cz) {
    const a = Math.random() * Math.PI * 2;
    const fx = Math.floor(cx + Math.cos(a) * 3.5);
    const fz = Math.floor(cz + Math.sin(a) * 3.5);
    const x = (fx + 0.5) * CELL;
    const z = (fz + 0.5) * CELL;
    if (this.blocked(x, z)) return;
    this.watcher.position.set(x, 1.05, z);
    this.watcher.visible = true;
  }

  blocked(x, z) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const r = this.player.radius;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const s = segsOf(cx + dx, cz + dz);
        for (const rc of s.rects) {
          if (x > rc.x0 - r && x < rc.x1 + r && z > rc.z0 - r && z < rc.z1 + r) return true;
        }
        const ck = cellKey(cx + dx, cz + dz);
        for (let j = 0; j < s.doors.length; j++) {
          const d = this.doorSpec(ck, j, s.doors[j]);
          if (d.state >= 0.45) continue;
          const half = d.w / 2;
          const t2 = 0.06;
          if (d.o === 'v') {
            if (x > d.x - t2 - r && x < d.x + t2 + r && z > d.z - half - r && z < d.z + half + r) return true;
          } else {
            if (z > d.z - t2 - r && z < d.z + t2 + r && x > d.x - half - r && x < d.x + half + r) return true;
          }
        }
      }
    }
    return false;
  }

  doorSpec(cellk, j, fresh) {
    const gr = this.doorObjs.get(cellk + ':d' + j);
    if (gr && gr.userData.door) return gr.userData.door;
    return fresh;
  }

  updateChunks(cx, cz) {
    const scene = this.scene;
    const rm = [];
    for (const [key, m] of this.cells) {
      const [xs, zs] = key.split(':');
      const [x, z] = xs.split(',').map(Number);
      if (Math.abs(x - cx) > R2 + 1 || Math.abs(z - cz) > R2 + 1) {
        scene.remove(m);
        rm.push(key);
      }
    }
    for (const k of rm) this.cells.delete(k);
    const rdm = [];
    for (const [key, gr] of this.doorObjs) {
      const [xs, zs] = key.split(':');
      const [x, z] = xs.split(',').map(Number);
      if (Math.abs(x - cx) > R2 + 1 || Math.abs(z - cz) > R2 + 1) {
        scene.remove(gr);
        rdm.push(key);
      }
    }
    for (const k of rdm) this.doorObjs.delete(k);

    for (let dx = -R2; dx <= R2; dx++) {
      for (let dz = -R2; dz <= R2; dz++) {
        const x = cx + dx, z = cz + dz;
        const key = cellKey(x, z);
        const s = segsOf(x, z);
        for (let i = 0; i < s.rects.length; i++) {
          const k = key + ':r' + i;
          if (this.cells.has(k)) continue;
          const rc = s.rects[i];
          const w = new THREE.Mesh(new THREE.BoxGeometry(rc.x1 - rc.x0, WALL_H, rc.z1 - rc.z0), this.wallMat);
          w.position.set((rc.x0 + rc.x1) / 2, WALL_H / 2, (rc.z0 + rc.z1) / 2);
          scene.add(w);
          this.cells.set(k, w);
        }
        for (let j = 0; j < s.doors.length; j++) {
          const k = key + ':d' + j;
          if (this.doorObjs.has(k)) continue;
          const d = s.doors[j];
          d._key = k;
          const gr = this.makeDoor(d);
          gr.position.set(d.x, 0, d.z);
          scene.add(gr);
          if (this.greenKey === k) {
            d.green = true;
            gr.children[3].material = this.doorGreenMat;
          }
          this.doorObjs.set(k, gr);
          d.obj = gr;
        }
        if (!this.fixtures.has(key) && Math.abs(dx) < R2 - 1 && Math.abs(dz) < R2 - 1) {
          this.addFixture(x, z);
        }
      }
    }
    const rfxm = [];
    for (const [k, f] of this.fixtures) {
      const [x, z] = k.split(',').map(Number);
      if (Math.abs(x - cx) > R2 || Math.abs(z - cz) > R2) {
        scene.remove(f.group);
        rfxm.push(k);
      }
    }
    for (const k of rfxm) this.fixtures.delete(k);
  }

  makeDoor(spec) {
    const g = new THREE.Group();
    const dir = spec.o === 'v' ? 'v' : 'h';
    const w = spec.w;
    // frame
    const frameW = w + 0.3;
    const post = new THREE.BoxGeometry(0.14, 2.45, 0.16);
    const lp = new THREE.Mesh(post, this.doorFrameMat);
    const rp = new THREE.Mesh(post, this.doorFrameMat);
    if (dir === 'v') {
      lp.position.set(0, 1.22, -frameW / 2 + 0.07);
      rp.position.set(0, 1.22, frameW / 2 - 0.07);
    } else {
      lp.position.set(-frameW / 2 + 0.07, 1.22, 0);
      rp.position.set(frameW / 2 - 0.07, 1.22, 0);
    }
    g.add(lp, rp);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(
      dir === 'v' ? 0.16 : frameW, 0.18, dir === 'v' ? frameW : 0.16
    ), this.doorFrameMat);
    lintel.position.set(0, 2.5, 0);
    g.add(lintel);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(dir === 'v' ? 0.1 : w, 2.28, dir === 'v' ? w : 0.1),
      this.doorSlabMat
    );
    slab.position.y = 1.2;
    g.add(slab);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.4, metalness: 0.6 })
    );
    knob.position.set(dir === 'v' ? 0.07 : w / 2 - 0.12, 1.05, dir === 'v' ? -w / 2 + 0.12 : 0.07);
    g.add(knob);
    g.position.set(spec.x, 0, spec.z);
    g.userData = { door: spec };
    return g;
  }

  updateDoors(dt) {
    for (const [, gr] of this.doorObjs) {
      const spec = gr.userData.door;
      if (spec.state === 1 && spec.slide < 1) {
        spec.slide = Math.min(1, spec.slide + dt * 1.1);
        const off = 1.35 * spec.slide;
        const slab = gr.children[3];
        if (spec.o === 'v') slab.position.z = -off;
        else slab.position.x = off;
      }
    }
  }

  updatePrompt(p, cx, cz) {
    let best = null, bestDist = 1e9;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = cx + dx, z = cz + dz;
        const s = segsOf(x, z);
        for (let j = 0; j < s.doors.length; j++) {
          const spec = this.doorSpec(cellKey(x, z), j, s.doors[j]);
          if (spec.state >= 0.45) continue;
          const d = Math.hypot(spec.x - p.pos.x, spec.z - p.pos.z);
          if (d >= 2.1) continue;
          const fwdX = -Math.sin(this.look.yaw) * Math.cos(this.look.pitch);
          const fwdZ = -Math.cos(this.look.yaw) * Math.cos(this.look.pitch);
          const vx = (spec.x - p.pos.x) / (d || 1);
          const vz = (spec.z - p.pos.z) / (d || 1);
          if (fwdX * vx + fwdZ * vz > 0.35 && d < bestDist) {
            best = spec;
            bestDist = d;
          }
        }
      }
    }
    if (best && !best.green) this._foundRed = true;
    this.targetDoor = best;
    if (this.ui && this.ui.setPrompt) {
      if (!best) {
        this.ui.setPrompt(null);
      } else if (best.green) {
        this.ui.setPrompt('[ E ] OPEN THE GREEN DOOR');
      } else {
        this.ui.setPrompt('[ E ] OPEN · RED ' + this.redOpened + '/10');
      }
    }
  }

  addFixture(x, z) {
    const group = new THREE.Group();
    group.position.set(x * CELL + CELL / 2, 0, z * CELL + CELL / 2);
    const frame = new THREE.Mesh(this.frameGeo, new THREE.MeshStandardMaterial({ color: 0x3a321d, roughness: 0.9 }));
    frame.position.y = WALL_H - 0.05;
    group.add(frame);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 1.35), this.fluoMat.clone());
    panel.rotation.x = Math.PI / 2;
    panel.position.y = WALL_H - 0.11;
    group.add(panel);
    const pool = new THREE.Mesh(this.poolGeo, this.poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    group.add(pool);
    this.scene.add(group);
    this.fixtures.set(cellKey(x, z), {
      group, mat: panel.material, flick: 0
    });
  }

  updateFlicker(dt) {
    if (Math.random() < 0.014) {
      const keys = [...this.fixtures.keys()];
      const k = keys[(Math.random() * keys.length) | 0];
      const f = this.fixtures.get(k);
      if (f) {
        f.flick = 0.35 + Math.random() * 0.5;
        if (Math.random() < 0.4) this.audio.crackle(0.025 + Math.random() * 0.02);
      }
    }
    for (const f of this.fixtures.values()) {
      if (f.flick > 0) {
        f.flick -= dt;
        const v = Math.random() < 0.4 ? 0.18 + Math.random() * 0.35 : 1;
        f.mat.color.setRGB(v, v * 0.97, v * 0.84);
      } else if (f.mat.color.r < 1) {
        f.mat.color.setRGB(1, 0.97, 0.84);
      }
    }
  }

  updateLights() {
    const cx = this.cell[0], cz = this.cell[1];
    const camX = (cx + 0.5) * CELL, camZ = (cz + 0.5) * CELL;
    const list = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = cx + dx, z = cz + dz;
        if (!this.fixtures.has(cellKey(x, z))) continue;
        const px = (x + 0.5) * CELL, pz = (z + 0.5) * CELL;
        list.push([(px - camX) ** 2 + (pz - camZ) ** 2, px, pz]);
      }
    }
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.plights.length; i++) {
      const l = this.plights[i];
      if (list[i]) {
        l.position.set(list[i][1], WALL_H - 0.5, list[i][2]);
        l.intensity = 26;
      } else {
        l.intensity = 0;
      }
    }
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
