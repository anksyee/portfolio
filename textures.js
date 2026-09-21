import * as THREE from 'three';

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h || w;
  return [c, c.getContext('2d')];
}

function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function repeatTex(t, rx, ry) {
  const r = t.clone();
  r.wrapS = r.wrapT = THREE.RepeatWrapping;
  r.repeat.set(rx, ry);
  r.needsUpdate = true;
  return r;
}

function speckle(g, w, h, count, colors, rmin, rmax, alpha) {
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * (0.3 + Math.random() * 0.7);
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const r = rmin + Math.random() * (rmax - rmin);
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, r, 0, 6.3);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function makeTextures() {
  const T = {};

  // ---- backrooms wallpaper (tile ~ 2m x 2m) ----
  {
    const [c, g] = cnv(512);
    g.fillStyle = '#c3ae5d';
    g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) {
      if ((x / 64) % 2 === 0) {
        g.fillStyle = 'rgba(222,204,130,0.22)';
        g.fillRect(x, 0, 64, 512);
      }
      g.fillStyle = 'rgba(120,102,48,0.85)';
      g.fillRect(x, 0, 3, 512);
    }
    g.fillStyle = 'rgba(150,132,70,0.55)';
    g.fillRect(0, 0, 512, 14);
    g.fillRect(0, 498, 512, 14);
    speckle(g, 512, 512, 2600, ['#8a7a3c', '#a8984f', '#4e431f'], 0.6, 1.6, 0.14);
    T.wallpaper = toTex(c);
  }

  // ---- backrooms carpet (tile ~ 4m) ----
  {
    const [c, g] = cnv(512);
    g.fillStyle = '#8a7a3e';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      g.globalAlpha = 0.16 + Math.random() * 0.14;
      g.fillStyle = Math.random() > 0.5 ? '#77683a' : '#9c8c4d';
      const x = Math.random() * 512, y = Math.random() * 512;
      const rx = 20 + Math.random() * 90, ry = 16 + Math.random() * 70;
      g.beginPath();
      g.ellipse(x, y, rx, ry, Math.random() * 3.1, 0, 6.3);
      g.fill();
    }
    speckle(g, 512, 512, 7000, ['#6f6234', '#554b26', '#a5914f', '#3f3819'], 0.7, 1.8, 0.5);
    T.carpet = toTex(c);
  }

  // ---- ceiling tiles (tile ~ 2.6m x 2.6m) ----
  {
    const [c, g] = cnv(256);
    g.fillStyle = '#cfc290';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14; i++) {
      g.globalAlpha = 0.10 + Math.random() * 0.16;
      g.fillStyle = '#b4a672';
      const x = Math.random() * 256, y = Math.random() * 256;
      g.beginPath();
      g.ellipse(x, y, 22 + Math.random() * 60, 18 + Math.random() * 44, 0, 0, 6.3);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = '#a3965f';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    speckle(g, 256, 256, 900, ['#b8ab72', '#93855a'], 0.6, 1.2, 0.2);
    T.ceiling = toTex(c);
  }

  // ---- subway wall panel ----
  {
    const [c, g] = cnv(256);
    g.fillStyle = '#6e7880';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      g.globalAlpha = 0.045 + Math.random() * 0.05;
      g.fillStyle = '#e6edf2';
      g.fillRect(Math.random() * 256, 0, 1.4 + Math.random() * 2, 256);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(30,34,38,0.85)';
    g.fillRect(0, 0, 6, 256);
    g.fillRect(250, 0, 6, 256);
    T.panel = toTex(c);
  }

  // ---- subway floor ----
  {
    const [c, g] = cnv(256);
    g.fillStyle = '#33363a';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 2200, ['#3f4246', '#222427', '#4a4e53'], 0.6, 1.8, 0.5);
    T.grip = toTex(c);
  }

  // ---- route map strip ----
  {
    const [c, g] = cnv(512, 96);
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, 512, 96);
    g.strokeStyle = '#c33';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(8, 48);
    g.lineTo(504, 48);
    g.stroke();
    const lines = [
      ['L', '#8b2f8b', 60], ['M', '#f2a72e', 140], ['1', '#e33c2e', 220],
      ['V', '#2e9e4f', 300], ['X', '#2e48c9', 380]
    ];
    g.font = '700 30px Arial';
    for (const [ch, col, x] of lines) {
      g.fillStyle = col;
      g.beginPath(); g.arc(x, 26, 12, 0, 6.3); g.fill();
      g.beginPath(); g.arc(x, 70, 12, 0, 6.3); g.fill();
      g.fillStyle = '#111';
      g.textAlign = 'center';
      g.fillText(ch, x, 37);
      g.fillText(ch, x, 81);
    }
    g.font = '700 17px Arial';
    g.fillStyle = '#333';
    g.textAlign = 'left';
    g.fillText('LIMINAL EXPRESS · ONE-WAY LINE', 330, 14);
    T.route = toTex(c);
  }

  // ---- poster ----
  {
    const [c, g] = cnv(192, 288);
    g.fillStyle = '#0d0f12';
    g.fillRect(0, 0, 192, 288);
    g.strokeStyle = '#e8e4d8';
    g.lineWidth = 5;
    g.strokeRect(6, 6, 180, 276);
    g.fillStyle = '#e8c84a';
    g.font = '900 34px Arial';
    g.textAlign = 'center';
    g.fillText('DEEP', 96, 62);
    g.fillText('STATION', 96, 104);
    g.fillStyle = '#bdb6a2';
    g.font = '13px Arial';
    g.fillText('a play at the end', 96, 152);
    g.fillText('of an endless line', 96, 172);
    T.poster = toTex(c);
  }
  {
    const [c, g] = cnv(192, 288);
    g.fillStyle = '#1c1a14';
    g.fillRect(0, 0, 192, 288);
    g.strokeStyle = '#e8c84a';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 176, 272);
    g.fillStyle = '#e8c84a';
    g.font = '900 30px Arial';
    g.textAlign = 'center';
    g.fillText('LAST', 96, 70);
    g.fillText('EXIT', 96, 108);
    g.fillStyle = '#cfc8b2';
    g.font = '13px Arial';
    g.fillText('7 stops from nowhere', 96, 158);
    g.fillText('nothing sells out faster', 96, 178);
    g.fillStyle = '#7d7660';
    g.font = '12px Arial';
    g.fillText('THE L LINE', 96, 226);
    T.poster2 = toTex(c);
  }

  // ---- tunnel wall (ribs) ----
  {
    const [c, g] = cnv(256);
    g.fillStyle = '#17181c';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 64) {
      g.fillStyle = '#26282f';
      g.fillRect(x, 0, 10, 256);
      g.fillStyle = '#0d0e12';
      g.fillRect(x + 10, 0, 6, 256);
    }
    speckle(g, 256, 256, 800, ['#101114', '#26282e'], 1, 2.4, 0.4);
    T.tunnel = toTex(c);
  }

  // ---- station sign ----
  {
    const [c, g] = cnv(512, 160);
    g.fillStyle = '#0a0a0c';
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#f2d24a';
    g.lineWidth = 6;
    g.strokeRect(4, 4, 504, 152);
    g.fillStyle = '#f2d24a';
    g.font = '900 84px Arial';
    g.textAlign = 'center';
    g.fillText('NOWHERE', 256, 104);
    g.font = '700 30px Arial';
    g.fillStyle = '#cfc8b2';
    g.fillText('S T A T I O N', 256, 144);
    T.station = toTex(c);
  }

  // ---- fluorescent panel ----
  {
    const [c, g] = cnv(96, 160);
    const grad = g.createLinearGradient(0, 0, 96, 0);
    grad.addColorStop(0, '#fff4cf');
    grad.addColorStop(0.5, '#fffbe9');
    grad.addColorStop(1, '#fff4cf');
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 160);
    T.fluo = toTex(c);
  }

  // ---- radial glow (sprites / light pool) ----
  {
    const [c, g] = cnv(256);
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    T.glow = toTex(c);
  }

  return T;
}
