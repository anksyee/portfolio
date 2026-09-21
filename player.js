import * as THREE from 'three';

export class PlayerController {
  constructor({
    walk = 3.4,
    run = 6.6,
    jumpV = 6.2,
    gravity = 17,
    eye = 1.62,
    radius = 0.33
  } = {}) {
    this.walk = walk;
    this.run = run;
    this.jumpV = jumpV;
    this.gravity = gravity;
    this.eye = eye;
    this.radius = radius;

    this.pos = new THREE.Vector3(0, 0, 4);
    this.vel = new THREE.Vector3();
    this.onGround = true;
    this.keys = Object.create(null);

    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); });
  }

  update(dt, yaw, collide) {
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);

    let ix = 0, iz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) { ix += fwdX; iz += fwdZ; }
    if (this.keys.KeyS || this.keys.ArrowDown) { ix -= fwdX; iz -= fwdZ; }
    if (this.keys.KeyD || this.keys.ArrowRight) { ix += rightX; iz += rightZ; }
    if (this.keys.KeyA || this.keys.ArrowLeft) { ix -= rightX; iz -= rightZ; }

    const len = Math.hypot(ix, iz);
    let tx = 0, tz = 0;
    if (len > 0) {
      const speed = (this.keys.ShiftLeft || this.keys.ShiftRight) ? this.run : this.walk;
      tx = (ix / len) * speed;
      tz = (iz / len) * speed;
    }

    const k = 1 - Math.exp(-12 * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;

    if ((this.keys.Space) && this.onGround) {
      this.vel.y = this.jumpV;
      this.onGround = false;
    }
    this.vel.y -= this.gravity * dt;

    if (collide) {
      const nx = this.pos.x + this.vel.x * dt;
      if (!collide(nx, this.pos.z)) this.pos.x = nx;
      else this.vel.x = 0;
      const nz = this.pos.z + this.vel.z * dt;
      if (!collide(this.pos.x, nz)) this.pos.z = nz;
      else this.vel.z = 0;
    } else {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
    }

    this.pos.y += this.vel.y * dt;
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }
    return { moving, ground: this.onGround };
  }
}
