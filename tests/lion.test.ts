import { describe, expect, it } from 'vitest';
import { T } from '../src/core/grid';
import { LION } from '../src/heroes/lion/config';
import { getHero } from '../src/heroes/registry';
import { buildLineup } from '../src/modes/lineup';
import { Match } from '../src/sim/match';
import { emptyInput, type Fighter, type FighterInput } from '../src/sim/types';

function setup(mapId = 'gem1') {
  const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Я', heroId: 'lion', skinId: 'default', level: 1, owner: 'local' }], difficulty: 'normal', seed: 5, mapId });
  const m = new Match(cfg);
  m.brains.clear();
  for (const f of m.world.fighters) f.isBot = false;
  const me = m.fighterOf('local')!;
  const enemies = m.world.fighters.filter((f) => f.team !== me.team);
  return { m, me, w: m.world, enemies };
}
const steps = (m: Match, n: number, inputs = new Map<number, FighterInput>()) => { for (let i = 0; i < n; i++) { m.step(inputs); inputs.clear(); m.drainEvents(); } };
/** Расчистить прямоугольник карты (чтобы стены не мешали проверкам). */
function clearArea(w: Match['world'], x0: number, y0: number, x1: number, y1: number) {
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) w.map.set(x, y, T.Floor);
}
const place = (f: Fighter, x: number, y: number) => { f.x = f.px = x; f.y = f.py = y; };

describe('Лев', () => {
  it('есть в списке героев, эпический, ближний бой', () => {
    const d = getHero('lion');
    expect(d.playable).toBe(true);
    expect(d.rarity).toBe('epic');
    expect(d.stats.hp).toBe(LION.hp);
    expect(d.ai.style).toBe('melee');
  });

  it('атака: два удара когтями по врагу вплотную', () => {
    const { m, me, w, enemies } = setup();
    const e = enemies[0];
    clearArea(w, me.x - 2, me.y - 3, me.x + 2, me.y);
    place(e, me.x, me.y - 1.3);
    const hp = e.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 15);
    expect(hp - e.hp).toBe(LION.claw.damage * 2);
    expect(me.superCharge).toBeCloseTo(LION.superPerHit * 2, 5);
  });

  it('удар когтями задевает сразу двух врагов, а дальний враг цел', () => {
    const { m, me, w, enemies } = setup();
    clearArea(w, me.x - 3, me.y - 5, me.x + 3, me.y);
    place(enemies[0], me.x - 0.5, me.y - 1.2);
    place(enemies[1], me.x + 0.5, me.y - 1.2);
    place(enemies[2], me.x, me.y - 4.5);
    const hps = enemies.map((e) => e.hp);
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 15);
    expect(hps[0] - enemies[0].hp).toBe(LION.claw.damage * 2);
    expect(hps[1] - enemies[1].hp).toBe(LION.claw.damage * 2);
    expect(enemies[2].hp).toBe(hps[2]);
  });

  it('супер: прыгает на врага, оглушает и дубасит когтями', () => {
    const { m, me, w, enemies } = setup();
    const e = enemies[0];
    clearArea(w, me.x - 2, me.y - 7, me.x + 2, me.y);
    place(e, me.x, me.y - 5);
    for (const o of enemies.slice(1)) place(o, 1.5, 1.5);
    const hp = e.hp;
    me.superCharge = 1;
    // прицел чуть мимо — всё равно «прилипает» к врагу
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 1, aim: -Math.PI / 2 + 0.15, power: 0.8 }]]));
    expect(me.leap).not.toBeNull();
    steps(m, Math.ceil(LION.super.leapTime * 30) + 1);
    expect(me.leap).toBeNull();
    expect(Math.hypot(me.x - e.x, me.y - e.y)).toBeLessThan(1.2);
    expect(w.time).toBeLessThan(e.stunUntil);
    // враг не может уйти, пока Лев бьёт
    const ex = e.x, ey = e.y;
    steps(m, 10, new Map([[e.id, { ...emptyInput(), mx: 1 }]]));
    expect(e.x).toBeCloseTo(ex, 5); expect(e.y).toBeCloseTo(ey, 5);
    steps(m, 40);
    const s = LION.super;
    expect(hp - e.hp).toBe(s.slamDamage + s.hits * s.hitDamage);
    // супер не заряжает сам себя
    expect(me.superCharge).toBe(0);
    // после града ударов снова можно двигаться
    const mx = me.x;
    steps(m, 10, new Map([[me.id, { ...emptyInput(), mx: 1 }]]));
    steps(m, 1, new Map([[me.id, { ...emptyInput(), mx: 1 }]]));
    expect(me.x).toBeGreaterThan(mx);
  });

  it('супер перепрыгивает стену', () => {
    const { m, me, w, enemies } = setup();
    const e = enemies[0];
    clearArea(w, me.x - 2, me.y - 6, me.x + 2, me.y);
    for (let x = Math.floor(me.x) - 2; x <= Math.floor(me.x) + 2; x++) w.map.set(x, Math.floor(me.y) - 2, T.Wall);
    place(e, me.x, me.y - 4);
    const wallY = Math.floor(me.y) - 2;
    me.superCharge = 1;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 2 }]]));
    steps(m, 20);
    expect(me.y).toBeLessThan(wallY); // оказался за стеной
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('прыжок в пустоту приземляется не в стену', () => {
    const { m, me, w } = setup();
    me.superCharge = 1;
    for (let i = 0; i < 6; i++) {
      steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 1, aim: (i * Math.PI) / 3, power: 1 }]]));
      steps(m, 60);
      expect(w.map.blocksMoveAt(me.x, me.y)).toBe(false);
      me.superCharge = 1;
    }
  });

  it('робот-напарник с Львом тоже прыгает (после отключения друга)', () => {
    const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Я', heroId: 'lion', skinId: 'default', level: 3, owner: 'peer' }], difficulty: 'hard', seed: 2, mapId: 'gem1' });
    const m = new Match(cfg);
    m.replaceWithBot('peer');
    const lion = m.world.fighters.find((f) => f.heroId === 'lion')!;
    let supers = 0;
    for (let i = 0; i < 30 * 90 && !m.result; i++) {
      m.step(new Map());
      for (const e of m.drainEvents()) if (e.t === 'shot' && e.id === lion.id && e.sup) supers++;
    }
    expect(supers).toBeGreaterThan(0);
  });
});
