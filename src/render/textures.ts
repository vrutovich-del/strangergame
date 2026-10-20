// Текстуры, нарисованные кодом: снаряды-смайлики, бактерии, энергошары, лица помощников.
import * as THREE from 'three';
import { canvasTexture, hexStr } from './kit';

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) { t = make(); cache.set(key, t); }
  return t;
}

function shade(c: number, k: number) {
  const col = new THREE.Color(c);
  col.multiplyScalar(k);
  return '#' + col.getHexString();
}

/** Смайлик-снаряд. mood: 0 — улыбка, 1 — злой, 2 — грустный, 3 — хохочет. */
export function smileTexture(color = 0xffd23f, mood = 0) {
  return cached(`smile:${color}:${mood}`, () => canvasTexture(128, (g, s) => {
    const c = s / 2, r = s * 0.4;
    g.fillStyle = '#2a1206';
    g.beginPath(); g.arc(c, c, r + 6, 0, Math.PI * 2); g.fill();
    const grd = g.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r);
    grd.addColorStop(0, shade(color, 1.25)); grd.addColorStop(0.7, hexStr(color)); grd.addColorStop(1, shade(color, 0.75));
    g.fillStyle = grd;
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1206';
    g.strokeStyle = '#2a1206';
    g.lineWidth = 6; g.lineCap = 'round';
    // глаза
    for (const ex of [-1, 1]) {
      g.beginPath(); g.ellipse(c + ex * r * 0.35, c - r * 0.2, r * 0.11, r * 0.17, 0, 0, Math.PI * 2); g.fill();
      if (mood === 1) { g.beginPath(); g.moveTo(c + ex * r * 0.6, c - r * 0.55); g.lineTo(c + ex * r * 0.15, c - r * 0.38); g.stroke(); }
    }
    // рот
    if (mood === 2) { g.beginPath(); g.arc(c, c + r * 0.55, r * 0.32, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else {
      g.beginPath(); g.arc(c, c + r * 0.08, r * 0.52, Math.PI * 0.12, Math.PI * 0.88); g.closePath();
      g.fillStyle = '#6b1a17'; g.fill(); g.stroke();
      g.fillStyle = '#fffbf1'; g.fillRect(c - r * 0.3, c + r * 0.12, r * 0.6, r * 0.12);
    }
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.ellipse(c - r * 0.45, c - r * 0.55, r * 0.15, r * 0.09, -0.6, 0, Math.PI * 2); g.fill();
  }));
}

/** Бактерия-снаряд: капля с жгутиками и хитрыми глазками. */
export function germTexture(color = 0xb05cff, big = false) {
  return cached(`germ:${color}:${big}`, () => canvasTexture(128, (g, s) => {
    const c = s / 2, r = s * (big ? 0.32 : 0.3);
    g.strokeStyle = '#14071c'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      g.quadraticCurveTo(c + Math.cos(a + 0.3) * r * 1.35, c + Math.sin(a + 0.3) * r * 1.35, c + Math.cos(a) * r * 1.55, c + Math.sin(a) * r * 1.55);
      g.stroke();
    }
    g.strokeStyle = hexStr(color); g.lineWidth = 3.5;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      g.quadraticCurveTo(c + Math.cos(a + 0.3) * r * 1.35, c + Math.sin(a + 0.3) * r * 1.35, c + Math.cos(a) * r * 1.5, c + Math.sin(a) * r * 1.5);
      g.stroke();
    }
    g.fillStyle = '#14071c';
    g.beginPath(); g.ellipse(c, c, r + 6, r * 0.92 + 6, 0.3, 0, Math.PI * 2); g.fill();
    const grd = g.createRadialGradient(c - r * 0.3, c - r * 0.3, 2, c, c, r);
    grd.addColorStop(0, shade(color, 1.5)); grd.addColorStop(1, shade(color, 0.7));
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(c, c, r, r * 0.92, 0.3, 0, Math.PI * 2); g.fill();
    // ядро
    g.fillStyle = shade(color, 0.45);
    g.beginPath(); g.arc(c + r * 0.25, c + r * 0.3, r * 0.22, 0, Math.PI * 2); g.fill();
    // глаза (жёлто-зелёные, хитрые)
    for (const ex of [-1, 1]) {
      g.fillStyle = '#cfee45';
      g.beginPath(); g.arc(c + ex * r * 0.33, c - r * 0.15, r * 0.22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0a0a';
      g.beginPath(); g.arc(c + ex * r * 0.33 + 2, c - r * 0.12, r * 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(color, 0.9);
      g.fillRect(c + ex * r * 0.33 - r * 0.24, c - r * 0.42, r * 0.48, r * 0.16);
    }
    if (big) {
      g.strokeStyle = '#14071c'; g.lineWidth = 5;
      g.beginPath(); g.arc(c, c + r * 0.25, r * 0.35, 0.2, Math.PI - 0.2); g.stroke();
    }
  }));
}

/** Светящийся энергошар (снаряд робота). */
export function energyTexture(color: number) {
  return cached(`energy:${color}`, () => canvasTexture(64, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, hexStr(color)); grd.addColorStop(0.7, hexStr(color) + '88'); grd.addColorStop(1, hexStr(color) + '00');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }));
}

/** Удар когтями: три изогнутые царапины (дугой к +X, поворачивается по направлению удара). */
export function clawTexture(color = 0xffc24a, mirror = false) {
  return cached(`claw:${color}:${mirror}`, () => canvasTexture(128, (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    if (mirror) g.scale(1, -1);
    g.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const r = s * 0.36 + i * 9, a0 = -0.95 + i * 0.05, a1 = 0.95 + i * 0.05;
      // светящийся след
      g.strokeStyle = hexStr(color) + '66'; g.lineWidth = 15;
      g.beginPath(); g.arc(-s * 0.18, 0, r, a0, a1); g.stroke();
      // острая царапина
      g.strokeStyle = '#ffffff'; g.lineWidth = 6;
      g.beginPath(); g.arc(-s * 0.18, 0, r, a0 + 0.12, a1 - 0.12); g.stroke();
      g.strokeStyle = hexStr(color); g.lineWidth = 3;
      g.beginPath(); g.arc(-s * 0.18, 0, r + 3, a0 + 0.2, a1 - 0.2); g.stroke();
    }
  }));
}

/** Мягкое круглое пятно (тени, вспышки). */
export function blobTexture() {
  return cached('blob', () => canvasTexture(64, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }));
}

/** Лицо помощника Смайла на развёртке сферы. mood: 0 — сердитый, 1 — улыбка, 2 — грустный. */
export function helperFaceTexture(color: number, mood: number) {
  return cached(`helper:${color}:${mood}`, () => canvasTexture(128, (g, s) => {
    const w = s * 2, h = s;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, shade(color, 1.2)); grd.addColorStop(0.6, hexStr(color)); grd.addColorStop(1, shade(color, 0.7));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // лицо в центре развёртки (u = 0.5 смотрит в +Z после поворота сферы)
    const cx = w * 0.5, cy = h * 0.52;
    g.fillStyle = '#2a1206'; g.strokeStyle = '#2a1206'; g.lineWidth = 5; g.lineCap = 'round';
    for (const ex of [-1, 1]) {
      g.beginPath(); g.ellipse(cx + ex * 17, cy - 10, 5, 9, 0, 0, Math.PI * 2); g.fill();
      if (mood === 0) { g.beginPath(); g.moveTo(cx + ex * 28, cy - 28); g.lineTo(cx + ex * 9, cy - 20); g.stroke(); }
      if (mood === 2) { g.beginPath(); g.moveTo(cx + ex * 28, cy - 20); g.lineTo(cx + ex * 9, cy - 27); g.stroke(); }
    }
    if (mood === 1) {
      g.beginPath(); g.arc(cx, cy + 2, 18, 0.15 * Math.PI, 0.85 * Math.PI); g.closePath(); g.fillStyle = '#6b1a17'; g.fill(); g.stroke();
    } else if (mood === 2) {
      g.beginPath(); g.arc(cx, cy + 22, 12, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx - 12, cy + 12); g.lineTo(cx + 12, cy + 12); g.stroke();
    }
  }, 256));
}

/** Рябь на воде (повторяющаяся текстура). */
export function waterTexture() {
  return cached('water', () => {
    const t = canvasTexture(128, (g, s) => {
      g.fillStyle = '#3fb4ff'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const y = (i + 0.5) * (s / 6), x0 = (i * 37) % s;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + 12, y - 6, x0 + 24, y); g.stroke();
      }
      g.fillStyle = 'rgba(20,90,200,0.25)';
      for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((i * 53) % s, (i * 29) % s, 8, 0, Math.PI * 2); g.fill(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}
