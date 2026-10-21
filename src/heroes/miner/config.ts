// Шахтёр: все числа героя (уровень 1). Каждый уровень даёт +8% HP и урона.
export const MINER = {
  hp: 3700,
  speed: 2.45,
  reload: 1.35,
  superPerHit: 0.16,
  attackCooldown: 0.5,
  radius: 0.4,
  /** Брошенная кирка крутится и летит по прямой. */
  pickaxe: { damage: 980, range: 6.5, speed: 10, radius: 0.32 },
  super: {
    /** Разбег: дальность (плитки) и скорость. */
    dashTiles: 5,
    dashSpeed: 11,
    /** Кого сбил по пути. */
    dashDamage: 700,
    knock: 7,
    /** В конце разбега — удар двумя кирками по земле. */
    slamDamage: 1100,
    slamRadius: 1.7,
  },
};
