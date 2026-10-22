// Стоп-Тайм — робот с часами на рюкзаке. Атака: два шара времени из пушек на руках. Супер: останавливает время на 5 секунд —
// враги, их снаряды и помощники замирают, а Стоп-Тайм и его команда бьют, кого захотят.
import type { Fighter, HeroDef, WorldApi } from '../../sim/types';
import { STOPTIME } from './config';

const B = STOPTIME.ball, S = STOPTIME.super;

const stoptime: HeroDef = {
  id: 'stoptime',
  name: 'Стоп-Тайм',
  role: 'Повелитель времени',
  description: 'Робот с экраном вместо лица и часами на рюкзаке. Стреляет шарами времени из пушек на руках и умеет останавливать время!',
  playable: true,
  order: 4,
  color: '#2f62b8',
  rarity: 'mythic',
  stats: {
    hp: STOPTIME.hp, speed: STOPTIME.speed, reload: STOPTIME.reload, superPerHit: STOPTIME.superPerHit,
    attackCooldown: STOPTIME.attackCooldown, damage: B.damage, superDamage: 0,
  },
  attackName: 'Шары времени',
  attackDesc: `Стреляет из пушек на руках: ${B.count} светящихся шара времени по прямой.`,
  superName: 'Стоп, время!',
  superDesc: `Останавливает время на ${S.seconds} секунд: враги и их снаряды замирают, а ты бьёшь кого захочешь!`,
  attackAim: { shape: 'line', range: B.range, width: 0.55 },
  superAim: { shape: 'throw', range: 0, width: S.wave * 2 },
  ai: { range: 6, style: 'ranged' },

  attack(w: WorldApi, f: Fighter, angle: number) {
    for (let i = 0; i < B.count; i++) {
      w.schedule(i * B.gap, () => {
        if (!f.alive) return;
        w.spawnProjectile(f, {
          angle: angle + (i ? B.spread : -B.spread) * 0.5, speed: B.speed, range: B.range, damage: B.damage * f.dmgMul, radius: B.radius,
          kind: 'timeball', superPerHit: STOPTIME.superPerHit, side: i ? -0.12 : 0.12,
        });
      });
    }
  },

  superAttack(w: WorldApi, f: Fighter) {
    w.stopTime(f, S.seconds);
  },
};

export default stoptime;
