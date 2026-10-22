// Шахтёр — метатель кирок. Атака: бросает крутящуюся кирку. Супер: разбег, сбивает всех на пути
// и в конце бьёт двумя кирками по земле (урон вокруг, ломает ящики).
import { T } from '../../core/grid';
import { dist2 } from '../../core/math';
import type { Fighter, HeroDef, WorldApi } from '../../sim/types';
import { MINER } from './config';

const P = MINER.pickaxe, S = MINER.super;

/** Удар кирками в конце разбега. */
function slam(w: WorldApi, f: Fighter) {
  const team = w.effTeam(f);
  const fx = f.x + Math.cos(f.facing) * 0.6, fy = f.y + Math.sin(f.facing) * 0.6;
  for (const o of w.fighters) {
    if (!o.alive || o === f || w.effTeam(o) === team) continue;
    if (dist2(o.x, o.y, fx, fy) > (S.slamRadius + o.radius) ** 2) continue;
    w.damage(o, S.slamDamage * f.dmgMul, f.id, true, 0);
  }
  for (const m of w.minions) {
    if (m.alive && m.team !== team && dist2(m.x, m.y, fx, fy) < S.slamRadius ** 2) w.damage(m, S.slamDamage * f.dmgMul, f.id, true, 0);
  }
  const r = Math.ceil(S.slamRadius);
  for (let ty = Math.floor(fy) - r; ty <= Math.floor(fy) + r; ty++) {
    for (let tx = Math.floor(fx) - r; tx <= Math.floor(fx) + r; tx++) {
      const t = w.map.get(tx, ty);
      if (t !== T.Crate && t !== T.Box) continue;
      if (dist2(tx + 0.5, ty + 0.5, fx, fy) > (S.slamRadius + 0.3) ** 2) continue;
      w.damageTile(tx, ty, t === T.Crate ? 1 : S.slamDamage * f.dmgMul, true);
    }
  }
  w.emit({ t: 'impact', x: fx, y: fy, kind: 'miner_slam' });
}

const miner: HeroDef = {
  id: 'miner',
  name: 'Шахтёр',
  role: 'Метатель кирок',
  description: 'Крокодил-шахтёр в каске с фонариком. Кидается кирками и с разбегу таранит врагов!',
  playable: true,
  order: 5,
  color: '#4fb33a',
  rarity: 'superrare',
  stats: {
    hp: MINER.hp, speed: MINER.speed, reload: MINER.reload, superPerHit: MINER.superPerHit,
    attackCooldown: MINER.attackCooldown, damage: P.damage, superDamage: S.dashDamage + S.slamDamage, radius: MINER.radius,
  },
  attackName: 'Кирка',
  attackDesc: 'Бросает крутящуюся кирку. Попадает больно!',
  superName: 'Таран с кирками',
  superDesc: 'Разбегается, сбивает всех на пути и бьёт двумя кирками по земле. Ломает ящики!',
  attackAim: { shape: 'line', range: P.range, width: 0.65 },
  superAim: { shape: 'dash', range: S.dashTiles, width: 1.1 },
  ai: { range: 5, style: 'ranged' },

  attack(w: WorldApi, f: Fighter, angle: number) {
    w.spawnProjectile(f, {
      angle, speed: P.speed, range: P.range, damage: P.damage * f.dmgMul, radius: P.radius,
      kind: 'pickaxe', superPerHit: MINER.superPerHit, side: -0.15,
    });
  },

  superAttack(w: WorldApi, f: Fighter, angle: number) {
    const dur = S.dashTiles / S.dashSpeed;
    f.dash = { vx: Math.cos(angle) * S.dashSpeed, vy: Math.sin(angle) * S.dashSpeed, until: w.time + dur, hit: [], damage: S.dashDamage * f.dmgMul, knock: S.knock };
    w.emit({ t: 'dash', id: f.id });
    const token = f.superAt;
    w.schedule(dur, () => {
      if (!f.alive || f.superAt !== token) return;
      f.dash = null;
      // короткая пауза на удар: стоит на месте, пока кирки бьют по земле
      f.stunUntil = Math.max(f.stunUntil, w.time + 0.25);
      slam(w, f);
    });
  },
};

export default miner;
