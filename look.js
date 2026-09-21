export class Look {
  constructor(camera, sens = 0.0021, maxPitch = 1.45) {
    this.camera = camera;
    this.sens = sens;
    this.maxPitch = maxPitch;
    this.yaw = 0;
    this.pitch = 0;
  }

  move(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch -= dy * this.sens;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
  }

  apply(roll = 0) {
    this.camera.rotation.set(this.pitch, this.yaw, roll, 'YXZ');
  }
}
