// Лев — боец ближнего боя. Атака: два удара когтями. Супер: прыжок на врага и град ударов когтями.
import { T } from '../../core/grid';
import { dist2 } from '../../core/math';
import type { Fighter, HeroDef, WorldApi } from '../../sim/types';
import { LION } from './config';

const C = LION.claw, S = LION.super;

/** Враги, которых Лев видит (для прыжка). */
function visibleEnemies(w: WorldApi, f: Fighter) {
  const team = w.effTeam(f);
  return w.fighters.filter((o) => o !== f && o.alive && w.effTeam(o) !== team && w.isVisibleTo(o, team));
}

function nearestTo(list: Fighter[], x: number, y: number, maxR: number) {
  let best: Fighter | undefined, bd = maxR * maxR;
  for (const o of list) {
    const d = dist2(o.x, o.y, x, y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/** Удар при приземлении: урон вокруг, враги оглушены, ящики-укрытия ломаются. */
function slam(w: WorldApi, f: Fighter) {
  const team = w.effTeam(f);
  const flurry = S.hits * S.hitEvery;
  for (const o of w.fighters) {
    if (!o.alive || o === f || w.effTeam(o) === team) continue;
    if (dist2(o.x, o.y, f.x, f.y) > (S.slamRadius + o.radius) ** 2) continue;
    w.damage(o, S.slamDamage * f.dmgMul, f.id, true, 0);
    if (o.alive && o.dummy !== 'static') o.stunUntil = Math.max(o.stunUntil, w.time + flurry);
  }
  for (const m of w.minions) {
    if (m.alive && m.team !== team && dist2(m.x, m.y, f.x, f.y) < S.slamRadius ** 2) w.damage(m, S.slamDamage * f.dmgMul, f.id, true, 0);
  }
  const r = Math.ceil(S.slamRadius);
  for (let ty = Math.floor(f.y) - r; ty <= Math.floor(f.y) + r; ty++) {
    for (let tx = Math.floor(f.x) - r; tx <= Math.floor(f.x) + r; tx++) {
      const t = w.map.get(tx, ty);
      if (t !== T.Crate && t !== T.Box) continue;
      if (dist2(tx + 0.5, ty + 0.5, f.x, f.y) > (S.slamRadius + 0.3) ** 2) continue;
      w.damageTile(tx, ty, t === T.Crate ? 1 : S.slamDamage * f.dmgMul, true);
    }
  }
  w.emit({ t: 'impact', x: f.x, y: f.y, kind: 'lion_slam' });
}

/** Один удар из града: бьёт всех врагов рядом и поворачивается к ближайшему. */
function flurryHit(w: WorldApi, f: Fighter, i: number) {
  const team = w.effTeam(f);
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (const o of w.fighters) {
    if (!o.alive || o === f || w.effTeam(o) === team) continue;
    const d = dist2(o.x, o.y, f.x, f.y);
    if (d > (S.hitRadius + o.radius) ** 2) continue;
    w.damage(o, S.hitDamage * f.dmgMul, f.id, true, 0);
    if (d < bd) { bd = d; best = o; }
  }
  for (const m of w.minions) {
    if (!m.alive || m.team === team) continue;
    const d = dist2(m.x, m.y, f.x, f.y);
    if (d > S.hitRadius ** 2) continue;
    w.damage(m, S.hitDamage * f.dmgMul, f.id, true, 0);
    if (d < bd) { bd = d; best = m; }
  }
  if (best) f.facing = Math.atan2(best.y - f.y, best.x - f.x);
  const side = i % 2 ? -0.35 : 0.35;
  const a = f.facing + side;
  w.emit({ t: 'impact', x: best ? best.x : f.x + Math.cos(a) * 0.9, y: best ? best.y : f.y + Math.sin(a) * 0.9, kind: 'claw_hit' });
}

const lion: HeroDef = {
  id: 'lion',
  name: 'Лев',
  role: 'Боец ближнего боя',
  description: 'Свирепый лев-воин в боевой жилетке. Бегает на четырёх лапах и дерётся когтями!',
  playable: true,
  order: 3,
  color: '#f2902e',
  rarity: 'epic',
  stats: {
    hp: LION.hp, speed: LION.speed, reload: LION.reload, superPerHit: LION.superPerHit,
    attackCooldown: LION.attackCooldown, damage: C.damage, superDamage: S.slamDamage + S.hits * S.hitDamage, radius: LION.radius,
  },
  attackName: 'Когти',
  attackDesc: `Два быстрых удара когтями вблизи. Задевают всех врагов перед Львом.`,
  superName: 'Прыжок хищника',
  superDesc: `Прыгает на врага прямо через стены, оглушает его и ${S.hits} раз бьёт когтями!`,
  attackAim: { shape: 'melee', range: C.range, width: 1.9 },
  superAim: { shape: 'throw', range: S.range, width: S.slamRadius * 2 },
  ai: { range: 1.4, style: 'melee' },

  attack(w: WorldApi, f: Fighter, angle: number) {
    for (let i = 0; i < C.swipes; i++) {
      w.schedule(i * C.gap, () => {
        if (!f.alive || f.leap) return;
        w.spawnProjectile(f, {
          angle, speed: C.speed, range: C.range, damage: C.damage * f.dmgMul, radius: C.radius,
          kind: 'claw', pierce: true, superPerHit: LION.superPerHit, offset: 0.3, side: i % 2 ? -0.12 : 0.12,
        });
      });
    }
  },

  superAttack(w: WorldApi, f: Fighter, angle: number, power: number) {
    const enemies = visibleEnemies(w, f);
    let tx: number, ty: number;
    let target: Fighter | undefined;
    if (power < 0) {
      // автоприцел: на ближайшего врага
      target = nearestTo(enemies, f.x, f.y, S.range * 1.25);
      const a = target ? Math.atan2(target.y - f.y, target.x - f.x) : angle;
      tx = f.x + Math.cos(a) * S.range; ty = f.y + Math.sin(a) * S.range;
    } else {
      const d = Math.max(1.5, S.range * power);
      tx = f.x + Math.cos(angle) * d; ty = f.y + Math.sin(angle) * d;
      target = nearestTo(enemies, tx, ty, S.lockRadius);
      if (target && dist2(target.x, target.y, f.x, f.y) > (S.range * 1.25) ** 2) target = undefined;
    }
    if (target) {
      // приземляемся вплотную к врагу, с нашей стороны
      const a = Math.atan2(target.y - f.y, target.x - f.x);
      const gap = Math.min(target.radius + f.radius * 0.8, Math.sqrt(dist2(target.x, target.y, f.x, f.y)));
      tx = target.x - Math.cos(a) * gap; ty = target.y - Math.sin(a) * gap;
    }
    // точка приземления: внутри карты и не в стене
    const land = { x: Math.max(0.5, Math.min(w.map.w - 0.5, tx)), y: Math.max(0.5, Math.min(w.map.h - 0.5, ty)) };
    if (w.map.blocksMoveAt(land.x, land.y)) {
      const free = w.map.nearestFree(land.x, land.y);
      if (free) { land.x = free.x; land.y = free.y; }
    }
    w.map.resolveCircle(land, f.radius);
    f.facing = Math.atan2(land.y - f.y, land.x - f.x);
    const leap = { x0: f.x, y0: f.y, x1: land.x, y1: land.y, t0: w.time, t1: w.time + S.leapTime };
    f.leap = leap;
    w.emit({ t: 'dash', id: f.id });
    const token = f.superAt;
    w.schedule(S.leapTime, () => {
      if (!f.alive || f.leap !== leap) return;
      f.leap = null;
      f.x = leap.x1; f.y = leap.y1;
      w.map.resolveCircle(f, f.radius);
      // стоит на месте и дубасит, пока не закончится град ударов
      f.stunUntil = w.time + S.hits * S.hitEvery + 0.05;
      slam(w, f);
      for (let i = 1; i <= S.hits; i++) {
        w.schedule(i * S.hitEvery, () => {
          if (!f.alive || f.superAt !== token || w.time > f.stunUntil) return;
          flurryHit(w, f, i);
        });
      }
    });
  },
};

export default lion;
