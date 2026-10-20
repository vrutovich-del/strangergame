// Лев: все числа героя (уровень 1). Каждый уровень даёт +8% HP и урона.
export const LION = {
  hp: 4300,
  speed: 2.65,
  reload: 1.15,
  superPerHit: 0.14,
  attackCooldown: 0.42,
  radius: 0.42,
  /** Два удара когтями подряд: правой, потом левой лапой. */
  claw: { swipes: 2, gap: 0.16, damage: 480, range: 2.1, speed: 15, radius: 0.55 },
  super: {
    /** Дальность прыжка (плитки) и время в воздухе (секунды). */
    range: 6.5,
    leapTime: 0.5,
    /** Если враг ближе этого к точке прицела — Лев прыгает прямо на него. */
    lockRadius: 2.2,
    /** Удар при приземлении. */
    slamDamage: 600,
    slamRadius: 1.6,
    /** Потом град ударов когтями. */
    hits: 6,
    hitEvery: 0.16,
    hitDamage: 300,
    hitRadius: 1.75,
  },
};
