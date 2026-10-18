// Роботы — все боты в игре. Напарники синие, враги красные. Здесь их характеристики, атаки и суперы.
import type { Fighter, HeroDef, WorldApi } from '../sim/types';

export const ROBOT_STATS = {
  blaster: { hp: 3000, speed: 2.3, reload: 1.6, damage: 720, range: 7.5, superDamage: 560, superBalls: 5, superSpreadDeg: 44, superPerHit: 0.2 },
  tank: { hp: 5000, speed: 2.05, reload: 1.25, damage: 1050, range: 1.9, superDamage: 900, dashTiles: 5, dashSpeed: 11, superPerHit: 0.25 },
  sniper: { hp: 2400, speed: 2.3, reload: 2.1, damage: 1100, range: 10, superDamage: 1300, superRange: 14, superPerHit: 0.3 },
  dummy: { hp: 6000, speed: 1.6, reload: 2.2, damage: 250, range: 6 },
};

const B = ROBOT_STATS.blaster, TK = ROBOT_STATS.tank, S = ROBOT_STATS.sniper, D = ROBOT_STATS.dummy;

const blaster: HeroDef = {
  id: 'robo_blaster', name: 'Робо-Бластер', role: 'Средняя дистанция', description: 'Стреляет энергошарами.',
  playable: false, order: 100, color: '#ff4b55',
  stats: { hp: B.hp, speed: B.speed, reload: B.reload, superPerHit: B.superPerHit, attackCooldown: 0.5, damage: B.damage, superDamage: B.superDamage },
  attackName: 'Энергошар', attackDesc: 'Одиночный энергошар.', superName: 'Залп', superDesc: 'Пять шаров веером.',
  attackAim: { shape: 'line', range: B.range, width: 0.5 }, superAim: { shape: 'cone', range: B.range, width: (B.superSpreadDeg * Math.PI) / 180 },
  ai: { range: 5.5, style: 'ranged' },
  attack(w: WorldApi, f: Fighter, a: number) {
    w.spawnProjectile(f, { angle: a, speed: 11, range: B.range, damage: B.damage * f.dmgMul, radius: 0.22, kind: 'energy', superPerHit: B.superPerHit });
  },
  superAttack(w: WorldApi, f: Fighter, a: number) {
    const sp = (B.superSpreadDeg * Math.PI) / 180;
    for (let i = 0; i < B.superBalls; i++) {
      w.spawnProjectile(f, { angle: a - sp / 2 + (sp * i) / (B.superBalls - 1), speed: 11, range: B.range, damage: B.superDamage * f.dmgMul, radius: 0.24, kind: 'energy_big', isSuper: true, breaksCrates: true });
    }
  },
};

const tank: HeroDef = {
  id: 'robo_tank', name: 'Робо-Танк', role: 'Ближний бой', description: 'Медленный, но очень крепкий.',
  playable: false, order: 101, color: '#ff4b55',
  stats: { hp: TK.hp, speed: TK.speed, reload: TK.reload, superPerHit: TK.superPerHit, attackCooldown: 0.45, damage: TK.damage, superDamage: TK.superDamage, radius: 0.45 },
  attackName: 'Кулак', attackDesc: 'Мощный удар кулаком.', superName: 'Таран', superDesc: 'Рывок вперёд, отбрасывает врагов.',
  attackAim: { shape: 'melee', range: TK.range, width: 1.2 }, superAim: { shape: 'dash', range: TK.dashTiles, width: 1.0 },
  ai: { range: 1.2, style: 'melee' },
  attack(w: WorldApi, f: Fighter, a: number) {
    w.spawnProjectile(f, { angle: a, speed: 12, range: TK.range, damage: TK.damage * f.dmgMul, radius: 0.5, kind: 'punch', superPerHit: TK.superPerHit, offset: 0.2 });
  },
  superAttack(w: WorldApi, f: Fighter, a: number) {
    const dur = TK.dashTiles / TK.dashSpeed;
    f.dash = { vx: Math.cos(a) * TK.dashSpeed, vy: Math.sin(a) * TK.dashSpeed, until: w.time + dur, hit: [], damage: TK.superDamage * f.dmgMul, knock: 9 };
    w.emit({ t: 'dash', id: f.id });
  },
};

const sniper: HeroDef = {
  id: 'robo_sniper', name: 'Робо-Снайпер', role: 'Дальний бой', description: 'Стреляет лазером издалека.',
  playable: false, order: 102, color: '#ff4b55',
  stats: { hp: S.hp, speed: S.speed, reload: S.reload, superPerHit: S.superPerHit, attackCooldown: 0.6, damage: S.damage, superDamage: S.superDamage },
  attackName: 'Лазер', attackDesc: 'Быстрый лазерный выстрел.', superName: 'Луч', superDesc: 'Пробивающий луч через всю линию.',
  attackAim: { shape: 'line', range: S.range, width: 0.3 }, superAim: { shape: 'beam', range: S.superRange, width: 0.6 },
  ai: { range: 8, style: 'sniper' },
  attack(w: WorldApi, f: Fighter, a: number) {
    w.spawnProjectile(f, { angle: a, speed: 18, range: S.range, damage: S.damage * f.dmgMul, radius: 0.15, kind: 'laser', superPerHit: S.superPerHit });
  },
  superAttack(w: WorldApi, f: Fighter, a: number) {
    const len = w.map.rayLength(f.x, f.y, a, S.superRange);
    w.emit({ t: 'beam', x: f.x, y: f.y, x2: f.x + Math.cos(a) * len, y2: f.y + Math.sin(a) * len, team: w.effTeam(f) });
    w.spawnProjectile(f, { angle: a, speed: 30, range: S.superRange, damage: S.superDamage * f.dmgMul, radius: 0.35, kind: 'beam', pierce: true, isSuper: true, breaksCrates: true });
  },
};

/** Робот-мишень для полигона. */
const dummy: HeroDef = {
  id: 'robo_dummy', name: 'Робо-Мишень', role: 'Мишень', description: 'Тренировочный робот.',
  playable: false, order: 103, color: '#ff9b3f',
  stats: { hp: D.hp, speed: D.speed, reload: D.reload, superPerHit: 0, attackCooldown: 1.5, damage: D.damage, superDamage: 0, radius: 0.45 },
  attackName: 'Пулька', attackDesc: '', superName: '', superDesc: '',
  attackAim: { shape: 'line', range: D.range, width: 0.4 }, superAim: { shape: 'line', range: 1, width: 0.4 },
  ai: { range: 5, style: 'ranged' },
  attack(w: WorldApi, f: Fighter, a: number) {
    w.spawnProjectile(f, { angle: a, speed: 7, range: D.range, damage: D.damage, radius: 0.2, kind: 'energy' });
  },
  superAttack() {},
};

export const ROBOTS: HeroDef[] = [blaster, tank, sniper, dummy];
export const COMBAT_ROBOTS = ['robo_blaster', 'robo_tank', 'robo_sniper'];

/** Смешные ники роботов. */
export const ROBOT_NAMES = [
  'Робо-Вася', 'ЖелезныйДэн', 'Болтик-3000', 'Гаечка', 'Шестерёнкин', 'Ржавчик', 'Робо-Петя', 'Винтик',
  'Шпунтик', 'Кнопкин', 'Пылесосыч', 'Чайник-5', 'ТостерМакс', 'Батарейкин', 'Лампочка', 'Робо-Жора',
  'Пиксель', 'Микросхемыч', 'Утюжок', 'Бип-Буп', 'Кибер-Котлета', 'Магнитик', 'Робо-Бабушка', 'Железяка',
];
