// Сетка карты: плитки, столкновения кругов со стенами, луч видимости, поиск пути.
import { clamp } from './math';

/** Типы плиток. */
export const T = { Floor: 0, Wall: 1, Crate: 2, Bush: 3, Water: 4, Box: 5 } as const;
export type TileType = (typeof T)[keyof typeof T];

/** Ящик с кубом силы: сколько урона выдерживает. Ящики % ломаются только суперами. */
export const BOX_HP = 4000;

export interface P2 { x: number; y: number }

export class GridMap {
  id = '';
  name = '';
  theme: 'grass' | 'sand' = 'grass';
  tiles: Uint8Array;
  hp: Float32Array;
  blueSpawns: P2[] = [];
  redSpawns: P2[] = [];
  mines: P2[] = [];
  boxes: P2[] = [];
  /** Счётчик изменений плиток (для рендера и сети). */
  version = 0;
  constructor(public w: number, public h: number) {
    this.tiles = new Uint8Array(w * h);
    this.hp = new Float32Array(w * h);
  }
  inside(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx: number, ty: number): number { return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : T.Wall; }
  set(tx: number, ty: number, t: number) {
    if (!this.inside(tx, ty)) return;
    this.tiles[ty * this.w + tx] = t;
    this.version++;
  }
  resetHp() {
    for (let i = 0; i < this.tiles.length; i++) this.hp[i] = this.tiles[i] === T.Box ? BOX_HP : 0;
  }
  /** Нельзя пройти: стены, ящики, вода, край карты. */
  blocksMove(tx: number, ty: number) {
    const t = this.get(tx, ty);
    return t === T.Wall || t === T.Crate || t === T.Water || t === T.Box;
  }
  /** Нельзя прострелить: стены и ящики (через воду стрелять можно). */
  blocksShot(tx: number, ty: number) {
    const t = this.get(tx, ty);
    return t === T.Wall || t === T.Crate || t === T.Box;
  }
  isBushAt(x: number, y: number) { return this.get(Math.floor(x), Math.floor(y)) === T.Bush; }
  blocksMoveAt(x: number, y: number) { return this.blocksMove(Math.floor(x), Math.floor(y)); }
  blocksShotAt(x: number, y: number) { return this.blocksShot(Math.floor(x), Math.floor(y)); }

  /** Выталкивает круг из твёрдых плиток. */
  resolveCircle(p: P2, r: number) {
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r), y0 = Math.floor(p.y - r), y1 = Math.floor(p.y + r);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.blocksMove(tx, ty)) continue;
        const cx = clamp(p.x, tx, tx + 1), cy = clamp(p.y, ty, ty + 1);
        const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (dx / d) * push; p.y += (dy / d) * push;
        } else {
          // центр внутри плитки — выталкиваем по кратчайшей оси
          const l = p.x - tx, rr = tx + 1 - p.x, t = p.y - ty, b = ty + 1 - p.y;
          const m = Math.min(l, rr, t, b);
          if (m === l) p.x = tx - r; else if (m === rr) p.x = tx + 1 + r; else if (m === t) p.y = ty - r; else p.y = ty + 1 + r;
        }
      }
    }
  }

  /** Двигает круг на (dx, dy) со скольжением вдоль стен. */
  moveCircle(p: P2, dx: number, dy: number, r: number) {
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / 0.2));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      p.x += sx; this.resolveCircle(p, r);
      p.y += sy; this.resolveCircle(p, r);
    }
  }

  /** Есть ли прямая видимость для выстрела между точками. */
  lineClear(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocksShotAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  /** Где луч из точки упирается в стену (для прицела и ИИ). Возвращает длину до стены, не больше max. */
  rayLength(ax: number, ay: number, ang: number, max: number) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let d = 0.1; d < max; d += 0.1) if (this.blocksShotAt(ax + dx * d, ay + dy * d)) return d;
    return max;
  }

  /** Есть ли проход для движения по прямой (для ИИ). */
  walkClear(ax: number, ay: number, bx: number, by: number, r = 0.35) {
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 1e-6) return true;
    const n = Math.ceil(d / 0.25);
    const nx = -(by - ay) / d, ny = (bx - ax) / d;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (this.blocksMoveAt(x, y) || this.blocksMoveAt(x + nx * r, y + ny * r) || this.blocksMoveAt(x - nx * r, y - ny * r)) return false;
    }
    return true;
  }

  /** Поиск пути A* по плиткам. Возвращает точки-центры плиток (без стартовой). */
  findPath(sx: number, sy: number, gx: number, gy: number, maxNodes = 3000): P2[] | null {
    const w = this.w, h = this.h;
    const stx = clamp(Math.floor(sx), 0, w - 1), sty = clamp(Math.floor(sy), 0, h - 1);
    const s = sty * w + stx;
    let gtx = clamp(Math.floor(gx), 0, w - 1), gty = clamp(Math.floor(gy), 0, h - 1);
    if (this.blocksMove(gtx, gty)) {
      const alt = this.nearestFree(gtx + 0.5, gty + 0.5);
      if (!alt) return null;
      gtx = Math.floor(alt.x); gty = Math.floor(alt.y);
    }
    const goal = gty * w + gtx;
    if (s === goal) return [{ x: gx, y: gy }];
    const g = new Float32Array(w * h).fill(Infinity);
    const f = new Float32Array(w * h).fill(Infinity);
    const came = new Int32Array(w * h).fill(-1);
    const closed = new Uint8Array(w * h);
    const open: number[] = [s];
    const H = (i: number) => {
      const x = i % w, y = (i / w) | 0;
      const dx = Math.abs(x - gtx), dy = Math.abs(y - gty);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    g[s] = 0; f[s] = H(s);
    let nodes = 0;
    while (open.length && nodes++ < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.inside(nx, ny) || this.blocksMove(nx, ny)) continue;
        if (dx && dy && (this.blocksMove(cx + dx, cy) || this.blocksMove(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + H(ni); came[ni] = cur; open.push(ni); }
      }
    }
    if (came[goal] < 0) return null;
    const path: P2[] = [];
    for (let c = goal; c !== s && c >= 0; c = came[c]) path.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 });
    path.reverse();
    return path;
  }

  /** Ближайшая свободная клетка (центр) к точке. */
  nearestFree(x: number, y: number): P2 | null {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let r = 0; r < 14; r++) {
      let best: P2 | null = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (!this.inside(nx, ny) || this.blocksMove(nx, ny)) continue;
        const d = (nx + 0.5 - x) ** 2 + (ny + 0.5 - y) ** 2;
        if (d < bd) { bd = d; best = { x: nx + 0.5, y: ny + 0.5 }; }
      }
      if (best) return best;
    }
    return null;
  }
}
