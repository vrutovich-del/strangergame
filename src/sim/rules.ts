// Общие правила боя (числа для баланса). Меняйте здесь, а не в логике.
export const BATTLE = {
  /** Патронов у каждого героя. */
  maxAmmo: 3,
  /** Через сколько секунд без урона и выстрелов начинается лечение. */
  healDelay: 3,
  /** Лечение: доля максимального HP в секунду. */
  healPerSec: 0.13,
  /** Бонус HP и урона за каждый уровень героя (+8%). */
  levelBonus: 0.08,
  /** Радиус бойца (плитки). */
  fighterRadius: 0.38,
  /** На каком расстоянии враг замечает бойца в кустах. */
  bushRevealDist: 2.2,
  /** Сколько секунд боец виден после выстрела из куста. */
  revealOnShot: 1.0,
  /** Сколько секунд боец виден после получения урона. */
  revealOnHurt: 0.6,
  /** Нормальная скорость (плиток в секунду). */
  normalSpeed: 2.4,
  /** Куб силы: +10% HP и урона. */
  cubeBonus: 0.1,
  /** Длительность заражения Бактерии. */
  infectSeconds: 5,
};

export const MODES = {
  gemgrab: {
    gemEvery: 7,
    gemsToWin: 10,
    countdown: 15,
    timeLimit: 150,
    respawn: 3,
  },
  showdown: {
    fighters: 10,
    poisonStart: 40,
    /** За сколько секунд облако сожмётся до финального размера. */
    poisonDuration: 60,
    /** Финальный размер безопасной зоны (доля карты). */
    poisonFinal: 0.9,
    poisonDps: 1000,
  },
  knockout: {
    winsNeeded: 2,
    poisonStart: 45,
    poisonDuration: 45,
    poisonDps: 1000,
    roundPause: 3,
  },
  training: {
    respawn: 2,
  },
};
