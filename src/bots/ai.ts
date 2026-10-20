// ИИ роботов. Работает на стороне хоста как часть симуляции и выдаёт обычный ввод (как у игрока).
import { dist, dist2, TAU } from '../core/math';
import type { P2 } from '../core/grid';
import { getHero } from '../heroes/registry';
import type { Difficulty, Fighter, FighterInput, Minion } from '../sim/types';
import { emptyInput } from '../sim/types';
import type { World } from '../sim/world';

/** Цель от режима: куда идти и что делать. */
export interface BotGoal {
  x: number;
  y: number;
  /** Насколько важно дойти (0 — гулять рядом, 1 — срочно, например, из облака). */
  urgency: number;
  /** Во что стрелять, если нет врагов (ящик с кубом). */
  shootAt?: P2;
  /** Держаться подальше от врагов (несёт кристаллы). */
  careful?: boolean;
  /** На каком расстоянии ввязываться в бой (например, в начале Выживания роботы сперва ищут кубы). */
  engage?: number;
}

export const DIFFICULTY = {
  easy: { think: 0.34, aimError: 0.32, lead: 0.0, dodge: 0.12, fireDelay: 0.65, superDelay: 2.5, retreatHp: 0.22, rangeUse: 0.8, bush: 0.15, sight: 7 },
  normal: { think: 0.2, aimError: 0.15, lead: 0.5, dodge: 0.38, fireDelay: 0.3, superDelay: 0.9, retreatHp: 0.3, rangeUse: 0.92, bush: 0.45, sight: 9 },
  hard: { think: 0.12, aimError: 0.07, lead: 0.85, dodge: 0.65, fireDelay: 0.12, superDelay: 0.3, retreatHp: 0.3, rangeUse: 1.0, bush: 0.75, sight: 10 },
};

type Target = Fighter | Minion;

export class BotBrain {
  private p: (typeof DIFFICULTY)['normal'];
  private nextThink = 0;
  private input: FighterInput = emptyInput();
  private path: P2[] = [];
  private pathGoal: P2 = { x: -99, y: -99 };
  private pathAt = -99;
  private targetId = 0;
  private targetSeenAt = -99;
  private strafe = 1;
  private strafeUntil = 0;
  private dodge: { x: number; y: number; until: number } | null = null;
  private dodgedIds = new Set<number>();
  private fireAllowedAt = 0;
  private superSeenAt = -1;
  private retreating = false;
  private wanderPt: P2 | null = null;
  private wanderUntil = 0;
  private stuckCheck = { x: 0, y: 0, at: 0 };

  constructor(public f: Fighter, public difficulty: Difficulty) {
    this.p = DIFFICULTY[difficulty];
    this.nextThink = Math.random() * this.p.think;
  }

  update(w: World, goal: BotGoal | null): FighterInput {
    const f = this.f;
    if (!f.alive) { this.path = []; return emptyInput(); }
    if (f.dummy) return this.dummyThink(w);
    // реакция обновляется не каждый тик — так ведёт себя «живой» соперник
    this.checkDodge(w);
    if (w.time >= this.nextThink) {
      this.nextThink = w.time + this.p.think * (0.8 + Math.random() * 0.4);
      this.think(w, goal);
    } else {
      // между размышлениями продолжаем идти по пути
      this.input.attack = 0; this.input.superAttack = 0;
      this.steer(w);
    }
    if (this.dodge && w.time < this.dodge.until) { this.input.mx = this.dodge.x; this.input.my = this.dodge.y; }
    return this.input;
  }

  private think(w: World, goal: BotGoal | null) {
    const f = this.f, def = getHero(f.heroId), team = w.effTeam(f);
    const inp = this.input;
    inp.attack = 0; inp.superAttack = 0; inp.mx = 0; inp.my = 0;
    const range = def.attackAim.range;
    const pref = def.ai.range;
    // ── выбор цели ──
    const target = this.pickTarget(w, team, Math.min(Math.max(range + 3, this.p.sight), goal?.engage ?? 99));
    const hpFrac = f.hp / f.maxHp;
    // отступление при низком здоровье
    if (hpFrac < this.p.retreatHp && !(goal && goal.urgency >= 1)) this.retreating = true;
    if (hpFrac > 0.85) this.retreating = false;
    const infected = w.time < f.infectedUntil;
    let moveTo: P2 | null = null;
    let faceAim: number | null = null;

    if (target) {
      const d = dist(f.x, f.y, target.x, target.y);
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      faceAim = ang;
      if (this.retreating && !infected) {
        // отходим от врага к своей базе / в кусты
        const away = { x: f.x - Math.cos(ang) * 4, y: f.y - Math.sin(ang) * 4 };
        moveTo = this.findBushNear(w, away, 4) ?? { x: (away.x + f.spawnX) / 2, y: (away.y + f.spawnY) / 2 };
      } else if (goal && goal.urgency >= 1) {
        moveTo = goal;
      } else if (goal?.careful && d > 3) {
        moveTo = goal;
      } else {
        // держим свою дистанцию и стрейфимся
        if (w.time > this.strafeUntil) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeUntil = w.time + 0.6 + Math.random() * 0.9; }
        const clear = w.map.lineClear(f.x, f.y, target.x, target.y);
        let want: number;
        if (!clear) want = Math.max(1.2, d - 2.5); // нет линии огня — подходим
        else if (d > pref * 1.15) want = pref;
        else if (d < pref * 0.6 && def.ai.style !== 'melee') want = pref;
        else want = d;
        const side = ang + (Math.PI / 2) * this.strafe;
        const tx = target.x - Math.cos(ang) * want + Math.cos(side) * 1.2;
        const ty = target.y - Math.sin(ang) * want + Math.sin(side) * 1.2;
        moveTo = clear ? { x: tx, y: ty } : { x: target.x, y: target.y };
      }
      // ── стрельба ──
      if (w.time >= this.fireAllowedAt) {
        const clear = w.map.lineClear(f.x, f.y, target.x, target.y);
        const useRange = range * this.p.rangeUse * (def.ai.style === 'shotgun' ? 0.85 : 1);
        if (clear && d <= useRange + 0.3 && f.ammo >= 1) {
          inp.attack = 1;
          inp.aim = this.aimAt(w, target, def.ai.style === 'melee' ? 30 : 12);
          this.fireAllowedAt = w.time + this.p.fireDelay * (0.6 + Math.random() * 0.8);
        }
      }
      // ── супер ──
      if (f.superCharge >= 1) {
        if (this.superSeenAt < 0) this.superSeenAt = w.time;
        if (w.time - this.superSeenAt >= this.p.superDelay) {
          const sRange = def.superAim.range;
          const clear = w.map.lineClear(f.x, f.y, target.x, target.y);
          const ok = def.superAim.shape === 'throw' ? d < 7 : def.superAim.shape === 'dash' ? d < sRange && w.map.walkClear(f.x, f.y, target.x, target.y, 0.3) : d <= sRange * 0.95 && clear;
          if (ok) {
            inp.superAttack = 1; inp.attack = 0;
            inp.aim = this.aimAt(w, target, 12);
            inp.power = Math.min(1, d / Math.max(1, sRange));
            this.superSeenAt = -1;
          }
        }
      }
    } else {
      this.superSeenAt = f.superCharge >= 1 ? this.superSeenAt : -1;
      if (this.retreating && !infected) {
        moveTo = this.findBushNear(w, { x: f.x, y: f.y }, 5) ?? { x: f.spawnX, y: f.spawnY };
      } else if (goal) {
        moveTo = goal;
        if (goal.shootAt && w.time >= this.fireAllowedAt && f.ammo >= 1) {
          const d = dist(f.x, f.y, goal.shootAt.x, goal.shootAt.y);
          if (d <= range + 0.5) {
            inp.attack = 1; inp.aim = Math.atan2(goal.shootAt.y - f.y, goal.shootAt.x - f.x);
            this.fireAllowedAt = w.time + 0.4 + this.p.fireDelay;
          }
        }
        // в кустах можно устроить засаду
        if (goal.urgency < 0.5 && Math.random() < this.p.bush * 0.3 && !f.inBush) {
          const b = this.findBushNear(w, goal, 3);
          if (b) moveTo = b;
        }
      } else {
        moveTo = this.wander(w);
      }
    }
    if (moveTo) this.setDestination(w, moveTo);
    this.steer(w);
    if (faceAim !== null && !inp.attack && !inp.superAttack) inp.aim = faceAim;
  }

  /** Цель: ближайший или самый раненый видимый враг. */
  private pickTarget(w: World, team: number, sight: number): Target | null {
    const f = this.f;
    const prev = w.findById(this.targetId) ?? w.minionById(this.targetId);
    let best: Target | null = null, bestScore = Infinity;
    const s2 = sight * sight;
    for (const o of w.fighters) {
      if (o === f || !o.alive || w.effTeam(o) === team) continue;
      if (o.dummy === 'static' && f.dummy) continue;
      if (!w.isVisibleTo(o, team)) continue;
      const d2 = dist2(o.x, o.y, f.x, f.y);
      if (d2 > s2) continue;
      let score = Math.sqrt(d2) - (1 - o.hp / o.maxHp) * 3.5;
      if (prev && o.id === prev.id) score -= 1.5; // не дёргаемся между целями
      if (!o.isBot) score += 0.5; // чуть реже набрасываемся на живого игрока
      if (score < bestScore) { bestScore = score; best = o; }
    }
    for (const m of w.minions) {
      if (!m.alive || m.team === team) continue;
      const d2 = dist2(m.x, m.y, f.x, f.y);
      if (d2 > 36) continue;
      const score = Math.sqrt(d2) + 2.5;
      if (score < bestScore) { bestScore = score; best = m; }
    }
    if (best) { this.targetId = best.id; this.targetSeenAt = w.time; }
    else if (prev && prev.alive && w.time - this.targetSeenAt < 0.8) best = prev; // ещё помним, куда он делся
    return best;
  }

  /** Прицел с упреждением и ошибкой по сложности. */
  private aimAt(w: World, t: Target, speed: number) {
    const f = this.f;
    let tx = t.x, ty = t.y;
    if ('vx' in t) {
      const d = dist(f.x, f.y, t.x, t.y);
      const time = d / speed;
      tx += (t as Fighter).vx * time * this.p.lead;
      ty += (t as Fighter).vy * time * this.p.lead;
    }
    const err = (Math.random() * 2 - 1) * this.p.aimError;
    return Math.atan2(ty - f.y, tx - f.x) + err;
  }

  /** Уклонение от летящих снарядов шагом в сторону. */
  private checkDodge(w: World) {
    const f = this.f, team = w.effTeam(f);
    if (this.dodge && w.time < this.dodge.until) return;
    for (const p of w.projectiles) {
      if (p.team === team || this.dodgedIds.has(p.id)) continue;
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
      if (d > 4 || d < 0.6) continue;
      const pv = Math.hypot(p.vx, p.vy) || 1;
      const along = (dx * p.vx + dy * p.vy) / pv;
      if (along <= 0) continue;
      const perp = Math.abs(dx * p.vy - dy * p.vx) / pv;
      if (perp > f.radius + p.radius + 0.25) continue;
      this.dodgedIds.add(p.id);
      if (Math.random() > this.p.dodge) continue;
      // шаг перпендикулярно полёту снаряда, в сторону от линии
      let sx = -p.vy / pv, sy = p.vx / pv;
      if (sx * dx + sy * dy < 0) { sx = -sx; sy = -sy; }
      if (w.map.blocksMoveAt(f.x + sx * 0.8, f.y + sy * 0.8)) { sx = -sx; sy = -sy; }
      this.dodge = { x: sx, y: sy, until: w.time + 0.32 };
      return;
    }
    if (this.dodgedIds.size > 64) this.dodgedIds.clear();
  }

  private setDestination(w: World, to: P2) {
    const f = this.f;
    const tx = Math.max(0.5, Math.min(w.map.w - 0.5, to.x)), ty = Math.max(0.5, Math.min(w.map.h - 0.5, to.y));
    if (w.map.walkClear(f.x, f.y, tx, ty, f.radius * 0.9) && !w.map.blocksMoveAt(tx, ty)) {
      this.path = [{ x: tx, y: ty }];
      this.pathGoal = { x: tx, y: ty };
      return;
    }
    if (dist2(tx, ty, this.pathGoal.x, this.pathGoal.y) > 1.5 || w.time - this.pathAt > 0.8 || !this.path.length) {
      this.path = w.map.findPath(f.x, f.y, tx, ty) ?? [];
      this.pathGoal = { x: tx, y: ty };
      this.pathAt = w.time;
    }
  }

  private steer(w: World) {
    const f = this.f, inp = this.input;
    while (this.path.length && dist2(f.x, f.y, this.path[0].x, this.path[0].y) < 0.12) this.path.shift();
    // срезаем углы, если можно идти напрямую к следующей точке
    if (this.path.length > 1 && w.map.walkClear(f.x, f.y, this.path[1].x, this.path[1].y, f.radius * 0.9)) this.path.shift();
    if (!this.path.length) { inp.mx = 0; inp.my = 0; return; }
    const n = this.path[0];
    const dx = n.x - f.x, dy = n.y - f.y, d = Math.hypot(dx, dy) || 1;
    const slow = d < 0.35 && this.path.length === 1 ? d / 0.35 : 1;
    inp.mx = (dx / d) * slow; inp.my = (dy / d) * slow;
    // застряли? пробуем другой путь
    if (w.time - this.stuckCheck.at > 1) {
      if (dist2(f.x, f.y, this.stuckCheck.x, this.stuckCheck.y) < 0.04 && (inp.mx || inp.my)) { this.path = []; this.pathAt = -99; this.wanderPt = null; }
      this.stuckCheck = { x: f.x, y: f.y, at: w.time };
    }
  }

  private findBushNear(w: World, p: P2, r: number): P2 | null {
    let best: P2 | null = null, bd = Infinity;
    const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r), y0 = Math.floor(p.y - r), y1 = Math.floor(p.y + r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (w.map.get(x, y) !== 3) continue;
      const d = dist2(x + 0.5, y + 0.5, this.f.x, this.f.y) + dist2(x + 0.5, y + 0.5, p.x, p.y);
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    return best;
  }

  private wander(w: World): P2 {
    if (!this.wanderPt || w.time > this.wanderUntil || dist2(this.f.x, this.f.y, this.wanderPt.x, this.wanderPt.y) < 1) {
      const a = Math.random() * TAU, r = 3 + Math.random() * 5;
      const p = w.map.nearestFree(w.map.w / 2 + Math.cos(a) * r, w.map.h / 2 + Math.sin(a) * r);
      this.wanderPt = p ?? { x: w.map.w / 2, y: w.map.h / 2 };
      this.wanderUntil = w.time + 5;
    }
    return this.wanderPt;
  }

  /** Мишени на полигоне. */
  private dummyThink(w: World): FighterInput {
    const f = this.f, inp = this.input;
    inp.attack = 0; inp.superAttack = 0; inp.mx = 0; inp.my = 0;
    if (f.dummy === 'move') {
      const t = w.time * 0.7 + f.id;
      inp.mx = Math.sin(t) > 0 ? 1 : -1;
      if (w.map.blocksMoveAt(f.x + inp.mx * 0.6, f.y)) inp.mx = -inp.mx;
    }
    if (f.dummy === 'shoot' && w.time >= this.fireAllowedAt) {
      const team = w.effTeam(f);
      const t = this.pickTarget(w, team, 7);
      if (t && w.map.lineClear(f.x, f.y, t.x, t.y)) {
        inp.attack = 1; inp.aim = Math.atan2(t.y - f.y, t.x - f.x) + (Math.random() - 0.5) * 0.2;
        this.fireAllowedAt = w.time + 1.6;
      }
    }
    if (w.time < f.infectedUntil) {
      // заражённая мишень атакует своих
      const t = this.pickTarget(w, w.effTeam(f), 7);
      if (t && w.time >= this.fireAllowedAt) { inp.attack = 1; inp.aim = Math.atan2(t.y - f.y, t.x - f.x); this.fireAllowedAt = w.time + 0.8; }
    }
    return inp;
  }
}
