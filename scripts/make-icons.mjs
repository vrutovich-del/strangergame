// Рисует иконку игры (смайл на фиолетовом фоне с зелёной бактерией) через SDF и сохраняет PNG.
import fs from 'fs';
import { encodePNG } from './png.mjs';

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function render(size, { round = 0.22, pad = 0 } = {}) {
  const px = new Uint8ClampedArray(size * size * 4);
  const SS = 3; // суперсэмплинг
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((x + (sx + 0.5) / SS) / size) * 2 - 1, v = ((y + (sy + 0.5) / SS) / size) * 2 - 1;
      const c = shade(u, v, round, pad);
      acc = acc.map((a, i) => a + c[i]);
    }
    const i = (y * size + x) * 4;
    px[i] = acc[0] / SS / SS; px[i + 1] = acc[1] / SS / SS; px[i + 2] = acc[2] / SS / SS; px[i + 3] = acc[3] / SS / SS;
  }
  return encodePNG(size, size, px);
}
const len = (x, y) => Math.hypot(x, y);
function sdRoundBox(x, y, b, r) { const qx = Math.abs(x) - b + r, qy = Math.abs(y) - b + r; return len(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; }
function shade(u, v, round, pad) {
  // фон: скруглённый квадрат с градиентом
  const bg = sdRoundBox(u, v, 1 - pad, round * 2);
  if (bg > 0) return [0, 0, 0, 0];
  const t = (v + 1) / 2;
  let col = mix(hex(0x6a3cff), hex(0x2b1a5e), t);
  // лучи
  const ang = Math.atan2(v, u);
  if (Math.sin(ang * 8) > 0.55) col = mix(col, hex(0x8a5cff), 0.35);
  // бактерия (сзади справа сверху)
  const gx = u - 0.48, gy = v + 0.45, gr = len(gx, gy);
  const wob = 0.27 + 0.03 * Math.sin(Math.atan2(gy, gx) * 7);
  if (gr < wob + 0.04) col = hex(0x1a0a24);
  if (gr < wob) { col = mix(hex(0xb05cff), hex(0x6b2a9e), (gy + 0.3) / 0.6); if (len(gx + 0.08, gy + 0.06) < 0.07 || len(gx - 0.1, gy + 0.02) < 0.06) col = hex(0xcfee45); }
  // смайл
  const sx = u + 0.08, sy = v - 0.08, r = len(sx, sy);
  if (r < 0.68) col = hex(0x2a1206);
  if (r < 0.62) {
    col = mix(hex(0xffe14a), hex(0xf28a17), Math.max(0, (sy + 0.2) / 0.9));
    // глаза
    for (const ex of [-0.22, 0.22]) {
      const ed = len((sx - ex) / 0.11, (sy + 0.15) / 0.15);
      if (ed < 1) col = hex(0x2a1206);
      if (len((sx - ex + 0.03) / 0.04, (sy + 0.2) / 0.05) < 1) col = [255, 255, 255];
    }
    // улыбка
    const mr = len(sx, sy + 0.02);
    if (sy > 0.08 && mr < 0.42 && mr > 0.0 && sy < 0.45) {
      if (mr < 0.42 && sy > 0.08 + 0.0) col = hex(0x6b1a17);
      if (mr > 0.36) col = hex(0x2a1206);
      if (sy < 0.17 && mr < 0.36) col = [255, 251, 241];
      if (len(sx, sy - 0.33) < 0.12 && mr < 0.36) col = hex(0xe8636b);
    }
  }
  return [...col, 255];
}
function mix(a, b, t) { t = Math.min(1, Math.max(0, t)); return a.map((x, i) => x + (b[i] - x) * t); }

fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', render(192));
fs.writeFileSync('public/icons/icon-512.png', render(512));
fs.writeFileSync('public/icons/maskable-512.png', render(512, { round: 0, pad: 0 }));
fs.writeFileSync('public/icons/apple-touch-icon.png', render(180, { round: 0, pad: 0 }));
console.log('Иконки готовы');
