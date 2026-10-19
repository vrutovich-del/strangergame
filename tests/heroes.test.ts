import { describe, expect, it } from 'vitest';
import { buildLineup } from '../src/modes/lineup';
import { Match } from '../src/sim/match';
import { emptyInput, type FighterInput } from '../src/sim/types';

function setup(heroId: string, mapId = 'gem1') {
  const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Я', heroId, skinId: 'default', level: 1, owner: 'local' }], difficulty: 'normal', seed: 5, mapId });
  const m = new Match(cfg);
  // роботов «выключаем», чтобы проверять только героя
  m.brains.clear();
  for (const f of m.world.fighters) f.isBot = false;
  const me = m.fighterOf('local')!;
  return { m, me, w: m.world };
}
const steps = (m: Match, n: number, inputs = new Map<number, FighterInput>()) => { for (let i = 0; i < n; i++) { m.step(inputs); inputs.clear(); m.drainEvents(); } };

describe('Смайл', () => {
  it('атака: очередь из 3 смайликов по 360 урона', () => {
    const { m, me, w } = setup('smile');
    const enemy = w.fighters.find((f) => f.team !== me.team)!;
    enemy.x = enemy.px = me.x; enemy.y = enemy.py = me.y - 4;
    w.map.set(Math.floor(me.x), Math.floor(me.y - 1), 0); w.map.set(Math.floor(me.x), Math.floor(me.y - 2), 0); w.map.set(Math.floor(me.x), Math.floor(me.y - 3), 0);
    const hp = enemy.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 30);
    expect(hp - enemy.hp).toBe(1080);
    expect(me.ammo).toBeLessThan(3);
    expect(me.superCharge).toBeCloseTo(0.3, 5);
  });
  it('супер: 3 помощника сами выбирают разные цели и исчезают через 6 секунд', () => {
    const { m, me, w } = setup('smile');
    const enemies = w.fighters.filter((f) => f.team !== me.team);
    enemies.forEach((e, i) => { e.x = e.px = me.x - 3 + i * 3; e.y = e.py = me.y - 3; });
    me.superCharge = 1;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 2 }]]));
    expect(w.minions).toHaveLength(3);
    steps(m, 20);
    const targets = new Set(w.minions.map((x) => x.targetId));
    expect(targets.size).toBe(3);
    const hpBefore = enemies.reduce((a, e) => a + e.hp, 0);
    steps(m, 60);
    expect(enemies.reduce((a, e) => a + e.hp, 0)).toBeLessThan(hpBefore);
    steps(m, 30 * 4);
    expect(w.minions).toHaveLength(0);
  });
});

describe('Бактерия', () => {
  it('атака: веер из 5 бактерий, вблизи попадают все', () => {
    const { m, me, w } = setup('bacteria');
    const enemy = w.fighters.find((f) => f.team !== me.team)!;
    enemy.x = enemy.px = me.x; enemy.y = enemy.py = me.y - 1.2;
    const hp = enemy.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 20);
    expect(hp - enemy.hp).toBe(5 * 280);
  });
  it('супер: враг заражается на 5 секунд, атакует своих и возвращается', () => {
    const { m, me, w } = setup('bacteria');
    const enemy = w.fighters.find((f) => f.team !== me.team)!;
    enemy.x = enemy.px = me.x; enemy.y = enemy.py = me.y - 2;
    me.superCharge = 1;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 10);
    expect(w.effTeam(enemy)).toBe(me.team);
    // свои по заражённому не попадают, а бывшие союзники — могут
    const exAlly = w.fighters.find((f) => f.team === enemy.team && f !== enemy)!;
    expect(w.effTeam(exAlly)).not.toBe(w.effTeam(enemy));
    steps(m, 30 * 5);
    expect(w.effTeam(enemy)).toBe(enemy.team);
  });
});

describe('общие правила боя', () => {
  it('3 патрона, перезарядка и лечение через 3 секунды', () => {
    const { m, me } = setup('smile');
    for (let i = 0; i < 3; i++) { steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: Math.PI / 2 }]])); steps(m, 15); }
    expect(me.ammo).toBeLessThan(1.5);
    me.hp = 1000;
    steps(m, 30 * 2);
    expect(me.hp).toBe(1000); // ещё рано
    steps(m, 30 * 2);
    expect(me.hp).toBeGreaterThan(1000);
    expect(me.ammo).toBeCloseTo(3, 5);
  });
  it('по своим урона нет', () => {
    const { m, me, w } = setup('bacteria');
    const ally = w.fighters.find((f) => f.team === me.team && f !== me)!;
    ally.x = ally.px = me.x; ally.y = ally.py = me.y - 1.2;
    const hp = ally.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 20);
    expect(ally.hp).toBe(hp);
  });
  it('в Захвате кристаллов 10 кристаллов и отсчёт 15 секунд дают победу', () => {
    const { m, me } = setup('smile');
    me.gems = 10;
    steps(m, 30 * 14);
    expect(m.result).toBeNull();
    steps(m, 30 * 2);
    expect(m.result?.winnerTeam).toBe(me.team);
  });
});
