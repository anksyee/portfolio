export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._buffers = {};
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);
  }

  noise(type = 'brown') {
    if (this._buffers[type]) return this._buffers[type];
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    this._buffers[type] = buf;
    return buf;
  }

  say(text) {
    if (!text) return;
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8;
    u.pitch = 0.55;
    u.volume = 0.9;
    speechSynthesis.speak(u);
    window.dispatchEvent(new CustomEvent('liminal-line', { detail: text }));
  }

  rumble() {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('brown');
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 90;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this._rumble = { src, f, g };
  }

  setRumble(speed01, stress) {
    if (!this._rumble) return;
    const t = this.ctx.currentTime;
    this._rumble.f.frequency.setTargetAtTime(60 + speed01 * 260, t, 0.15);
    this._rumble.g.gain.setTargetAtTime(0.05 + speed01 * 0.22 + stress * 0.3, t, 0.12);
  }

  stopRumble() {
    if (!this._rumble) return;
    const t = this.ctx.currentTime;
    this._rumble.g.gain.setTargetAtTime(0, t, 0.2);
    this._rumble.f.frequency.setTargetAtTime(50, t, 0.2);
  }

  screech(on) {
    if (on && !this._screech) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise('white');
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1700;
      f.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this._screech = { src, g };
      g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.4);
    } else if (!on && this._screech) {
      this._screech.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      this._screech = null;
    }
  }

  whoosh() {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('white');
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    f.Q.value = 0.9;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this._whoosh = { src, g, f };
  }

  setWhoosh(u) {
    if (!this._whoosh) return;
    const t = this.ctx.currentTime;
    this._whoosh.g.gain.setTargetAtTime(0.02 + u * 0.34, t, 0.15);
    this._whoosh.f.frequency.setTargetAtTime(220 + u * 2600, t, 0.2);
  }

  stopWhoosh(dur = 1.2) {
    if (!this._whoosh) return;
    this._whoosh.g.gain.setTargetAtTime(0, this.ctx.currentTime, dur * 0.3);
    this._whoosh = null;
  }

  subHit() {
    this.ensure();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(42, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(24, ctx.currentTime + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
    osc.connect(g); g.connect(this.master);
    osc.start(); osc.stop(ctx.currentTime + 1.8);
  }

  hiss(dur = 0.6) {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('white');
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.1);
  }

  hum() {
    this.ensure();
    const ctx = this.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 50;
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 100.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lg = ctx.createGain();
    lg.gain.value = 0.006;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this._hum = { g };
    g.gain.setTargetAtTime(0.09, ctx.currentTime, 1.5);
  }

  setHum(v) {
    if (this._hum) this._hum.g.gain.setTargetAtTime(0.09 * v, this.ctx.currentTime, 0.4);
  }

  stopHum() {
    if (!this._hum) return;
    this._hum.g.gain.setTargetAtTime(0, this.ctx.currentTime, 1.2);
    this._hum = null;
  }

  crackle(vol = 0.05) {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('white');
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05 + Math.random() * 0.08);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.25);
  }

  wind() {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('white');
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 1.5);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this._wind = g;
  }

  stopWind(dur = 1) {
    if (!this._wind) return;
    this._wind.gain.setTargetAtTime(0.001, this.ctx.currentTime, dur);
    this._wind = null;
  }

  step() {
    this.ensure();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise('brown');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.08);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.12);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.65;
    return this.muted;
  }
}
