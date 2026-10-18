// Бактерия: все числа героя (уровень 1). Каждый уровень даёт +8% HP и урона.
export const BACTERIA = {
  hp: 3800,
  speed: 2.4,
  reload: 1.6,
  superPerHit: 0.06,
  attackCooldown: 0.5,
  swarm: { count: 5, spreadDeg: 30, damage: 280, range: 6, speed: 11, radius: 0.18 },
  super: { damage: 400, range: 8, speed: 9, radius: 0.45, infectSeconds: 5 },
};
