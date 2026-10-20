// Бактерия — «дробовик» ближней и средней дистанции. Атака: веер бактерий. Супер: заражение на 5 секунд.
import type { Fighter, HeroDef, Minion, Projectile, WorldApi } from '../../sim/types';
import { BACTERIA } from './config';

const bacteria: HeroDef = {
  id: 'bacteria',
  name: 'Бактерия',
  role: 'Боец ближнего боя',
  description: 'Хитрая фиолетовая бактерия с бластером. Чихает целым роем и заражает врагов!',
  playable: true,
  order: 2,
  color: '#b05cff',
  rarity: 'rare',
  stats: {
    hp: BACTERIA.hp, speed: BACTERIA.speed, reload: BACTERIA.reload, superPerHit: BACTERIA.superPerHit,
    attackCooldown: BACTERIA.attackCooldown, damage: BACTERIA.swarm.damage, superDamage: BACTERIA.super.damage,
  },
  attackName: 'Рой',
  attackDesc: `Веер из ${BACTERIA.swarm.count} бактерий. Чем ближе враг, тем больше попадёт.`,
  superName: 'Заражение',
  superDesc: `Большая бактерия заражает врага на ${BACTERIA.super.infectSeconds} секунд — он воюет за твою команду!`,
  attackAim: { shape: 'cone', range: BACTERIA.swarm.range, width: (BACTERIA.swarm.spreadDeg * Math.PI) / 180 },
  superAim: { shape: 'line', range: BACTERIA.super.range, width: 0.9 },
  ai: { range: 3.5, style: 'shotgun' },

  attack(w: WorldApi, f: Fighter, angle: number) {
    const s = BACTERIA.swarm;
    const spread = (s.spreadDeg * Math.PI) / 180;
    for (let i = 0; i < s.count; i++) {
      const a = angle - spread / 2 + (spread * i) / (s.count - 1);
      w.spawnProjectile(f, {
        angle: a + w.rng.range(-0.02, 0.02), speed: s.speed * w.rng.range(0.94, 1.06), range: s.range, damage: s.damage * f.dmgMul,
        radius: s.radius, kind: 'germ', superPerHit: BACTERIA.superPerHit,
      });
    }
  },

  superAttack(w: WorldApi, f: Fighter, angle: number) {
    const s = BACTERIA.super;
    w.spawnProjectile(f, {
      angle, speed: s.speed, range: s.range, damage: s.damage * f.dmgMul, radius: s.radius,
      kind: 'germ_big', isSuper: true, breaksCrates: true, effect: 'infect', offset: 0.6,
    });
  },

  onProjectileHit(w: WorldApi, p: Projectile, target: Fighter | Minion | null) {
    if (p.effect !== 'infect' || !target || !('level' in target)) return;
    const owner = w.findById(p.ownerId);
    const victim = target as Fighter;
    if (owner && victim.alive) w.infect(victim, owner, BACTERIA.super.infectSeconds);
  },
};

export default bacteria;
