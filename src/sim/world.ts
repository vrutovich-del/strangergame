// Мир боя: бойцы, снаряды, помощники, подбираемые предметы. Фиксированный тик, без рендера.
import { SIM_HZ } from '../config';
import { GridMap, T } from '../core/grid';
import { clamp, dist2, TAU } from '../core/math';
import { Rng } from '../core/rng';
import { getHero } from '../heroes/registry';
import { BATTLE } from './rules';
import type {
  Fighter, FighterInput, Minion, Pickup, PlayerSlot, Projectile, ShotOptions, SimEvent, WorldApi, Zone,
} from './types';

export const levelMul = (level: number) => 1 + BATTLE.levelBonus * (level - 1);

export class World implements WorldApi {
  time = 0;
  tick = 0;
  dt = 1 / SIM_HZ;
  rng: Rng;
  fighters: Fighter[] = [];
  projectiles: Projectile[] = [];
  minions: Minion[] = [];
  pickups: Pickup[] = [];
  events: SimEvent[] = [];
  zone: Zone | null = null;
  private nextId = 1;
  private timers: { at: number; fn: () => void }[] = [];
  /** Ловушки режима (их задаёт режим при запуске). */
  onDeath: (victim: Fighter, killer: Fighter | undefined) => void = () => {};
  onPickup: (f: Fighter, p: Pickup) => void = () => {};
  /** Можно ли подобрать предмет (например, мёртвые не подбирают). */
  paused = false;

  constructor(public map: GridMap, seed: number) {
    this.rng = new Rng(seed);
  }

  id() { return this.nextId++; }
  emit(e: SimEvent) { this.events.push(e); }
  schedule(delay: number, fn: () => void) { this.timers.push({ at: this.time + delay, fn }); }

  effTeam(f: Fighter) { return this.time < f.infectedUntil ? f.infectTeam : f.team; }
  findById(id: number) { return this.fighters.find((f) => f.id === id); }
  minionById(id: number) { return this.minions.find((m) => m.id === id); }
  enemiesOf(team: number) { return this.fighters.filter((f) => f.alive && this.effTeam(f) !== team); }

  /** Видит ли команда бойца (кусты прячут). */
  isVisibleTo(f: Fighter, team: number) {
    if (!f.alive) return false;
    if (this.effTeam(f) === team) return true;
    if (!f.inBush) return true;
    if (this.time < f.revealUntil) return true;
    const r2 = BATTLE.bushRevealDist ** 2;
    for (const o of this.fighters) {
      if (o.alive && this.effTeam(o) === team && dist2(o.x, o.y, f.x, f.y) < r2) return true;
    }
    return false;
  }

  addFighter(slot: PlayerSlot, x: number, y: number): Fighter {
    const def = getHero(slot.heroId);
    const mul = levelMul(slot.level);
    const hp = Math.round(def.stats.hp * mul);
    const f: Fighter = {
      id: this.id(), heroId: slot.heroId, skinId: slot.skinId, name: slot.name, level: slot.level,
      team: slot.team, infectTeam: -1, infectedUntil: 0, infectedBy: 0,
      isBot: slot.isBot, owner: slot.owner, dummy: slot.dummy,
      x, y, px: x, py: y, vx: 0, vy: 0, facing: slot.team === 0 ? -Math.PI / 2 : Math.PI / 2, moving: false,
      radius: def.stats.radius ?? BATTLE.fighterRadius, speed: def.stats.speed,
      hp, maxHp: hp, baseHp: hp, dmgMul: mul,
      ammo: BATTLE.maxAmmo, attackReadyAt: 0, superCharge: 0,
      alive: true, deadAt: 0, respawnAt: 0, lastHurt: -99, lastShot: -99, revealUntil: 0, inBush: false,
      gems: 0, cubes: 0, dash: null, knock: null, emote: -1, emoteUntil: 0,
      shotAt: -99, superAt: -99, hurtAt: -99, spawnX: x, spawnY: y,
      stats: { damage: 0, kills: 0, deaths: 0, gems: 0, supers: 0, hits: 0 },
    };
    this.fighters.push(f);
    this.emit({ t: 'spawn', id: f.id });
    return f;
  }

  /** Воскрешение бойца на точке. */
  respawn(f: Fighter, x: number, y: number) {
    f.alive = true; f.hp = f.maxHp; f.ammo = BATTLE.maxAmmo; f.x = f.px = x; f.y = f.py = y;
    f.infectedUntil = 0; f.dash = null; f.knock = null; f.lastHurt = -99; f.revealUntil = 0;
    f.facing = f.team === 0 ? -Math.PI / 2 : Math.PI / 2;
    this.emit({ t: 'spawn', id: f.id });
  }

  // ───────────────────────── шаг симуляции ─────────────────────────
  step(inputs: Map<number, FighterInput>) {
    this.events.length = this.events.length > 400 ? 0 : this.events.length;
    this.time += this.dt;
    this.tick++;
    // отложенные действия (очереди выстрелов и т.п.)
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time + 1e-9);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time + 1e-9);
        for (const t of due) t.fn();
      }
    }
    for (const f of this.fighters) { f.px = f.x; f.py = f.y; }
    for (const m of this.minions) { m.px = m.x; m.py = m.y; }
    for (const p of this.pickups) { p.px = p.x; p.py = p.y; }
    for (const p of this.projectiles) { p.px = p.x; p.py = p.y; }

    for (const f of this.fighters) this.updateFighter(f, inputs.get(f.id));
    this.updateProjectiles();
    this.updateMinions();
    this.updatePickups();
    this.updateZone();
  }

  private updateFighter(f: Fighter, inp: FighterInput | undefined) {
    const dt = this.dt;
    if (!f.alive) return;
    const def = getHero(f.heroId);
    // заражение закончилось — «чих» и возвращение в команду
    if (f.infectedUntil > 0 && this.time >= f.infectedUntil) {
      f.infectedUntil = 0;
      this.emit({ t: 'cure', id: f.id });
    }
    // перезарядка
    if (f.ammo < BATTLE.maxAmmo) f.ammo = Math.min(BATTLE.maxAmmo, f.ammo + dt / def.stats.reload);
    // лечение
    if (this.time - f.lastHurt >= BATTLE.healDelay && this.time - f.lastShot >= BATTLE.healDelay && f.hp < f.maxHp) {
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * BATTLE.healPerSec * dt);
    }
    // рывок / отбрасывание
    let forced = false;
    if (f.dash) {
      if (this.time >= f.dash.until) f.dash = null;
      else { forced = true; this.dashStep(f); }
    }
    if (!forced && f.knock) {
      if (this.time >= f.knock.until) f.knock = null;
      else { forced = true; this.map.moveCircle(f, f.knock.vx * dt, f.knock.vy * dt, f.radius); }
    }
    if (inp && !forced) {
      let mx = inp.mx, my = inp.my;
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      f.moving = l > 0.1;
      if (f.moving) {
        this.map.moveCircle(f, mx * f.speed * dt, my * f.speed * dt, f.radius);
        f.facing = Math.atan2(my, mx);
      }
      if (inp.emote >= 0 && this.time >= f.emoteUntil - 1.5) {
        f.emote = inp.emote; f.emoteUntil = this.time + 2.2;
        this.emit({ t: 'emote', id: f.id, e: inp.emote });
      }
      if (inp.superAttack && f.superCharge >= 1) {
        const a = inp.superAttack === 2 ? this.autoAim(f, def.superAim.range) : inp.aim;
        f.superCharge = 0; f.facing = a; f.superAt = this.time; f.lastShot = this.time;
        f.revealUntil = this.time + BATTLE.revealOnShot;
        f.stats.supers++;
        this.emit({ t: 'shot', id: f.id, heroId: f.heroId, sup: true, x: f.x, y: f.y, a });
        def.superAttack(this, f, a);
      } else if (inp.attack && f.ammo >= 1 && this.time >= f.attackReadyAt) {
        const a = inp.attack === 2 ? this.autoAim(f, def.attackAim.range) : inp.aim;
        f.ammo -= 1; f.attackReadyAt = this.time + def.stats.attackCooldown;
        f.facing = a; f.shotAt = this.time; f.lastShot = this.time;
        f.revealUntil = this.time + BATTLE.revealOnShot;
        this.emit({ t: 'shot', id: f.id, heroId: f.heroId, sup: false, x: f.x, y: f.y, a });
        def.attack(this, f, a);
      }
    } else if (!forced) f.moving = false;
    f.vx = (f.x - f.px) / dt; f.vy = (f.y - f.py) / dt;
    f.inBush = this.map.isBushAt(f.x, f.y);
  }

  private dashStep(f: Fighter) {
    const d = f.dash!;
    const before = { x: f.x, y: f.y };
    // рывок ломает ящики на пути
    const nx = Math.floor(f.x + d.vx * this.dt * 2), ny = Math.floor(f.y + d.vy * this.dt * 2);
    if (this.map.get(nx, ny) === T.Crate) this.damageTile(nx, ny, 1, true);
    this.map.moveCircle(f, d.vx * this.dt, d.vy * this.dt, f.radius);
    if (Math.hypot(f.x - before.x, f.y - before.y) < 0.01) { f.dash = null; return; }
    const team = this.effTeam(f);
    for (const o of this.fighters) {
      if (!o.alive || this.effTeam(o) === team || d.hit.includes(o.id)) continue;
      if (dist2(o.x, o.y, f.x, f.y) < (o.radius + f.radius + 0.2) ** 2) {
        d.hit.push(o.id);
        this.damage(o, d.damage, f.id, true, 0);
        const l = Math.hypot(d.vx, d.vy) || 1;
        o.knock = { vx: (d.vx / l) * d.knock, vy: (d.vy / l) * d.knock, until: this.time + 0.3 };
      }
    }
    for (const m of this.minions) {
      if (m.alive && m.team !== team && !d.hit.includes(m.id) && dist2(m.x, m.y, f.x, f.y) < 1) {
        d.hit.push(m.id); this.damage(m, d.damage, f.id, true, 0);
      }
    }
  }

  /** Автоприцел: ближайший видимый враг в радиусе (или по направлению взгляда). */
  autoAim(f: Fighter, range: number): number {
    const team = this.effTeam(f);
    let best: { x: number; y: number } | null = null, bd = Infinity;
    const consider = (x: number, y: number, maxR: number) => {
      const d = dist2(x, y, f.x, f.y);
      if (d < maxR * maxR && d < bd) { bd = d; best = { x, y }; }
    };
    for (const o of this.fighters) if (o !== f && o.alive && this.effTeam(o) !== team && this.isVisibleTo(o, team)) consider(o.x, o.y, range * 1.25);
    for (const m of this.minions) if (m.alive && m.team !== team) consider(m.x, m.y, range * 1.25);
    if (!best) {
      // ящики с кубами
      for (const b of this.map.boxes) if (this.map.get(b.x, b.y) === T.Box) consider(b.x + 0.5, b.y + 0.5, range);
    }
    if (!best) {
      for (const o of this.fighters) if (o !== f && o.alive && this.effTeam(o) !== team && this.isVisibleTo(o, team)) consider(o.x, o.y, range * 2);
    }
    if (!best) return f.facing;
    const b = best as { x: number; y: number };
    return Math.atan2(b.y - f.y, b.x - f.x);
  }

  // ───────────────────────── снаряды ─────────────────────────
  spawnProjectile(owner: Fighter | Minion, o: ShotOptions): Projectile {
    const team = 'heroId' in owner && 'level' in owner ? this.effTeam(owner as Fighter) : (owner as Minion).team;
    const ownerId = 'ownerId' in owner ? (owner as Minion).ownerId : owner.id;
    const cos = Math.cos(o.angle), sin = Math.sin(o.angle);
    const off = o.offset ?? 0.45, side = o.side ?? 0;
    const p: Projectile = {
      id: this.id(), ownerId, heroId: owner.heroId, team, kind: o.kind,
      x: owner.x + cos * off - sin * side, y: owner.y + sin * off + cos * side, px: 0, py: 0,
      vx: cos * o.speed, vy: sin * o.speed, angle: o.angle, radius: o.radius ?? 0.18,
      damage: o.damage, travelled: 0, range: o.range, pierce: !!o.pierce, hitIds: [],
      isSuper: !!o.isSuper, superPerHit: o.superPerHit ?? 0, breaksCrates: !!o.breaksCrates, effect: o.effect ?? '', alive: true,
    };
    p.px = p.x; p.py = p.y;
    // если ствол уже в стене — снаряд сразу гаснет
    if (this.map.blocksShotAt(p.x, p.y)) {
      this.hitWall(p, Math.floor(p.x), Math.floor(p.y));
      return p;
    }
    this.projectiles.push(p);
    return p;
  }

  private hitWall(p: Projectile, tx: number, ty: number) {
    const t = this.map.get(tx, ty);
    if (t === T.Crate && p.breaksCrates) this.damageTile(tx, ty, 1, true);
    else if (t === T.Box) this.damageTile(tx, ty, p.damage, p.isSuper);
    p.alive = false;
    this.emit({ t: 'impact', x: p.x, y: p.y, kind: p.kind });
    getHero(p.heroId).onProjectileHit?.(this, p, null);
  }

  damageTile(tx: number, ty: number, amount: number, sup: boolean) {
    const t = this.map.get(tx, ty);
    if (t === T.Crate && sup) {
      this.map.set(tx, ty, T.Floor);
      this.emit({ t: 'tile', tx, ty, to: T.Floor });
    } else if (t === T.Box) {
      const i = ty * this.map.w + tx;
      this.map.hp[i] -= amount;
      this.emit({ t: 'impact', x: tx + 0.5, y: ty + 0.5, kind: 'box' });
      if (this.map.hp[i] <= 0) {
        this.map.set(tx, ty, T.Floor);
        this.emit({ t: 'tile', tx, ty, to: T.Floor });
        this.dropPickup('cube', tx + 0.5, ty + 0.5, 0);
      }
    }
  }

  private updateProjectiles() {
    const dt = this.dt;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const speed = Math.hypot(p.vx, p.vy);
      const stepLen = speed * dt;
      const sub = Math.max(1, Math.ceil(stepLen / 0.15));
      for (let s = 0; s < sub && p.alive; s++) {
        p.x += (p.vx * dt) / sub; p.y += (p.vy * dt) / sub;
        p.travelled += stepLen / sub;
        const tx = Math.floor(p.x), ty = Math.floor(p.y);
        if (this.map.blocksShot(tx, ty)) { this.hitWall(p, tx, ty); break; }
        // бойцы
        for (const f of this.fighters) {
          if (!f.alive || this.effTeam(f) === p.team || p.hitIds.includes(f.id)) continue;
          if (dist2(f.x, f.y, p.x, p.y) < (f.radius + p.radius) ** 2) {
            p.hitIds.push(f.id);
            this.damage(f, p.damage, p.ownerId, p.isSuper, p.superPerHit);
            getHero(p.heroId).onProjectileHit?.(this, p, f);
            if (!p.pierce) { p.alive = false; break; }
          }
        }
        if (!p.alive) break;
        for (const m of this.minions) {
          if (!m.alive || m.team === p.team || p.hitIds.includes(m.id)) continue;
          if (dist2(m.x, m.y, p.x, p.y) < (0.35 + p.radius) ** 2) {
            p.hitIds.push(m.id);
            this.damage(m, p.damage, p.ownerId, p.isSuper, p.superPerHit);
            getHero(p.heroId).onProjectileHit?.(this, p, m);
            if (!p.pierce) { p.alive = false; break; }
          }
        }
        if (p.alive && p.travelled >= p.range) {
          p.alive = false;
          this.emit({ t: 'impact', x: p.x, y: p.y, kind: p.kind + '_end' });
          getHero(p.heroId).onProjectileHit?.(this, p, null);
        }
      }
    }
    if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  // ───────────────────────── урон ─────────────────────────
  damage(target: Fighter | Minion, amount: number, byId: number, sup: boolean, superPerHit: number) {
    if (!target.alive || amount <= 0) return;
    const by = this.findById(byId);
    amount = Math.round(amount);
    const isFighter = 'level' in target;
    target.hp -= amount;
    target.hurtAt = this.time;
    if (isFighter) {
      const f = target as Fighter;
      f.lastHurt = this.time;
      f.revealUntil = Math.max(f.revealUntil, this.time + BATTLE.revealOnHurt);
      this.emit({ t: 'hit', id: f.id, by: byId, amount, x: f.x, y: f.y, sup });
    } else {
      this.emit({ t: 'mhit', id: target.id, amount, x: target.x, y: target.y });
    }
    if (by) {
      by.stats.damage += Math.min(amount, amount + Math.min(0, target.hp));
      by.stats.hits++;
      if (superPerHit > 0 && by.superCharge < 1) {
        by.superCharge = Math.min(1, by.superCharge + superPerHit);
        if (by.superCharge >= 1) this.emit({ t: 'ready', id: by.id });
      }
    }
    if (target.hp <= 0) {
      target.hp = 0;
      if (isFighter) this.kill(target as Fighter, by);
      else this.killMinion(target as Minion);
    }
  }

  kill(f: Fighter, by?: Fighter) {
    if (!f.alive) return;
    f.alive = false; f.deadAt = this.time; f.dash = null; f.knock = null;
    f.stats.deaths++;
    if (by && by !== f) by.stats.kills++;
    if (f.infectedUntil > 0) { f.infectedUntil = 0; }
    this.emit({ t: 'death', id: f.id, by: by?.id ?? 0, x: f.x, y: f.y });
    // помощники погибшего исчезают
    for (const m of this.minions) if (m.ownerId === f.id && m.alive) this.killMinion(m);
    this.onDeath(f, by);
  }

  private killMinion(m: Minion) {
    m.alive = false;
    this.emit({ t: 'minion', id: m.id, on: false, x: m.x, y: m.y });
  }

  infect(target: Fighter, by: Fighter, duration: number) {
    if (!target.alive || target.dummy === 'static') return;
    target.infectTeam = this.effTeam(by);
    target.infectedBy = by.id;
    target.infectedUntil = this.time + duration;
    this.emit({ t: 'infect', id: target.id, by: by.id });
  }

  // ───────────────────────── помощники ─────────────────────────
  spawnMinion(owner: Fighter, kind: string, x: number, y: number, hp: number, life: number, damage: number, range: number, slot: number): Minion {
    const m: Minion = {
      id: this.id(), ownerId: owner.id, heroId: owner.heroId, kind, team: this.effTeam(owner),
      x, y, px: x, py: y, facing: owner.facing, hp, maxHp: hp, bornAt: this.time, expiresAt: this.time + life,
      targetId: 0, fireAt: this.time + 0.35 + slot * 0.12, slot, damage, range, alive: true, shotAt: -99, hurtAt: -99,
    };
    this.minions.push(m);
    this.emit({ t: 'minion', id: m.id, on: true, x, y });
    return m;
  }

  private updateMinions() {
    for (const m of this.minions) {
      if (!m.alive) continue;
      if (this.time >= m.expiresAt) { this.killMinion(m); continue; }
      getHero(m.heroId).updateMinion?.(this, m);
    }
    if (this.minions.some((m) => !m.alive)) this.minions = this.minions.filter((m) => m.alive);
  }

  // ───────────────────────── предметы ─────────────────────────
  dropPickup(kind: 'gem' | 'cube', x: number, y: number, spread: number) {
    const a = this.rng.range(0, TAU), sp = spread > 0 ? this.rng.range(1.5, 3.2) : 0;
    const p: Pickup = { id: this.id(), kind, x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, bornAt: this.time, alive: true };
    this.pickups.push(p);
    return p;
  }

  private updatePickups() {
    const dt = this.dt;
    for (const p of this.pickups) {
      if (!p.alive) continue;
      if (p.vx || p.vy) {
        const q = { x: p.x, y: p.y };
        this.map.moveCircle(q, p.vx * dt, p.vy * dt, 0.2);
        p.x = q.x; p.y = q.y;
        p.vx *= 0.86; p.vy *= 0.86;
        if (Math.hypot(p.vx, p.vy) < 0.05) { p.vx = 0; p.vy = 0; }
      }
      if (this.time - p.bornAt < 0.45) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.dummy) continue;
        if (dist2(f.x, f.y, p.x, p.y) < (f.radius + 0.35) ** 2) {
          p.alive = false;
          this.onPickup(f, p);
          this.emit({ t: 'pickup', id: f.id, kind: p.kind, x: p.x, y: p.y });
          break;
        }
      }
    }
    if (this.pickups.some((p) => !p.alive)) this.pickups = this.pickups.filter((p) => p.alive);
  }

  // ───────────────────────── ядовитое облако ─────────────────────────
  private updateZone() {
    const z = this.zone;
    if (!z || !z.active) return;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.x < z.x0 || f.x > z.x1 || f.y < z.y0 || f.y > z.y1) {
        // урон облаком тикает раз в полсекунды
        if (this.tick % 15 === 0) {
          f.hp -= z.dps * 0.5; f.lastHurt = this.time; f.hurtAt = this.time;
          this.emit({ t: 'hit', id: f.id, by: 0, amount: Math.round(z.dps * 0.5), x: f.x, y: f.y, sup: false });
          if (f.hp <= 0) { f.hp = 0; this.kill(f, undefined); }
        }
      }
    }
  }

  /** Сжать безопасную зону к центру на заданную долю (0 — вся карта, 1 — точка). */
  setZoneShrink(k: number, dps: number) {
    const w = this.map.w, h = this.map.h;
    const cx = w / 2, cy = h / 2;
    k = clamp(k, 0, 1);
    const hw = (w / 2) * (1 - k) + 0.01, hh = (h / 2) * (1 - k) + 0.01;
    this.zone = { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh, active: true, dps };
  }
}
