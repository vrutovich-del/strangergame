import { describe, expect, it } from 'vitest';
import { T } from '../src/core/grid';
import { MINER } from '../src/heroes/miner/config';
import { getHero } from '../src/heroes/registry';
import { skinsOf } from '../src/heroes/skins';
import { STOPTIME } from '../src/heroes/stoptime/config';
import { buildLineup } from '../src/modes/lineup';
import { Match } from '../src/sim/match';
import { emptyInput, type Fighter, type FighterInput } from '../src/sim/types';

function setup(heroId: string, mapId = 'gem1') {
  const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Я', heroId, skinId: 'default', level: 1, owner: 'local' }], difficulty: 'normal', seed: 5, mapId });
  const m = new Match(cfg);
  // роботов «выключаем», чтобы проверять только героя
  m.brains.clear();
  for (const f of m.world.fighters) f.isBot = false;
  const me = m.fighterOf('local')!;
  const enemies = m.world.fighters.filter((f) => f.team !== me.team);
  return { m, me, w: m.world, enemies };
}
const steps = (m: Match, n: number, inputs = new Map<number, FighterInput>()) => { for (let i = 0; i < n; i++) { m.step(inputs); m.drainEvents(); } };
function clearArea(w: Match['world'], x0: number, y0: number, x1: number, y1: number) {
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) w.map.set(x, y, T.Floor);
}
const place = (f: Fighter, x: number, y: number) => { f.x = f.px = x; f.y = f.py = y; };

describe('Стоп-Тайм', () => {
  it('есть в списке героев, мифический, со скинами', () => {
    const d = getHero('stoptime');
    expect(d.playable).toBe(true);
    expect(d.rarity).toBe('mythic');
    expect(d.stats.hp).toBe(STOPTIME.hp);
    expect(skinsOf('stoptime').map((s) => s.id)).toContain('cuckoo');
  });

  it('атака: два шара времени попадают во врага', () => {
    const { m, me, w, enemies } = setup('stoptime');
    const e = enemies[0];
    clearArea(w, me.x - 2, me.y - 5, me.x + 2, me.y);
    place(e, me.x, me.y - 3);
    const hp = e.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 30);
    expect(hp - e.hp).toBe(STOPTIME.ball.damage * STOPTIME.ball.count);
    expect(me.superCharge).toBeCloseTo(STOPTIME.superPerHit * 2, 5);
  });

  it('супер: враги и их снаряды замирают на 5 секунд, а Стоп-Тайм ходит и бьёт', () => {
    const { m, me, w, enemies } = setup('stoptime');
    const e = enemies[0];
    clearArea(w, me.x - 3, me.y - 6, me.x + 3, me.y);
    place(e, me.x, me.y - 4);
    for (const o of enemies.slice(1)) place(o, 1.5, 1.5);
    // враг стреляет в нас, и в этот момент время останавливается
    steps(m, 1, new Map([[e.id, { ...emptyInput(), attack: 1, aim: Math.PI / 2 }]]));
    const shot = w.projectiles.find((p) => p.ownerId === e.id)!;
    expect(shot).toBeTruthy();
    me.superCharge = 1;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 2 }]]));
    expect(w.timeStopped).toBe(true);
    expect(w.isFrozen(e)).toBe(true);
    expect(w.isFrozen(me)).toBe(false);
    const sx = shot.x, sy = shot.y, ex = e.x, ey = e.y, ammo = e.ammo;
    // замерший враг не ходит и не стреляет, его снаряд висит в воздухе
    for (let i = 0; i < 30; i++) steps(m, 1, new Map([[e.id, { ...emptyInput(), mx: 1, attack: 1, aim: Math.PI / 2 }]]));
    expect(e.x).toBeCloseTo(ex, 5); expect(e.y).toBeCloseTo(ey, 5);
    expect(shot.x).toBeCloseTo(sx, 5); expect(shot.y).toBeCloseTo(sy, 5);
    expect(e.ammo).toBeCloseTo(ammo, 5);
    // а Стоп-Тайм свободно ходит и бьёт замершего врага
    const mx = me.x;
    steps(m, 10, new Map([[me.id, { ...emptyInput(), mx: 1 }]]));
    steps(m, 1, new Map([[me.id, { ...emptyInput(), mx: 1 }]]));
    expect(me.x).toBeGreaterThan(mx);
    const hp = e.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 2 }]]));
    steps(m, 30);
    expect(e.hp).toBeLessThan(hp);
    // через 5 секунд время идёт снова
    steps(m, 30 * STOPTIME.super.seconds);
    expect(w.timeStopped).toBe(false);
    const ex2 = e.x;
    steps(m, 10, new Map([[e.id, { ...emptyInput(), mx: 1 }]]));
    steps(m, 1, new Map([[e.id, { ...emptyInput(), mx: 1 }]]));
    expect(e.x).toBeGreaterThan(ex2);
  });
});

describe('Шахтёр', () => {
  it('есть в списке героев, сверхредкий, со скинами', () => {
    const d = getHero('miner');
    expect(d.playable).toBe(true);
    expect(d.rarity).toBe('superrare');
    expect(skinsOf('miner').map((s) => s.id)).toEqual(['default', 'viking', 'crystal', 'basketball', 'football', 'baseball']);
  });

  it('атака: брошенная кирка', () => {
    const { m, me, w, enemies } = setup('miner');
    const e = enemies[0];
    clearArea(w, me.x - 2, me.y - 5, me.x + 2, me.y);
    place(e, me.x, me.y - 3);
    const hp = e.hp;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), attack: 1, aim: -Math.PI / 2 }]]));
    steps(m, 30);
    expect(hp - e.hp).toBe(MINER.pickaxe.damage);
  });

  it('супер: разбег сбивает врага и в конце бьёт кирками по земле', () => {
    const { m, me, w, enemies } = setup('miner');
    const S = MINER.super;
    clearArea(w, me.x - 2, me.y - 8, me.x + 2, me.y);
    // первый враг на пути разбега, второй — там, где Шахтёр остановится
    const a = enemies[0], b = enemies[1];
    place(a, me.x, me.y - 2);
    place(b, me.x + 0.3, me.y - S.dashTiles - 0.9);
    for (const o of enemies.slice(2)) place(o, 1.5, 1.5);
    w.map.set(Math.floor(me.x) + 1, Math.floor(me.y - S.dashTiles - 0.5), T.Crate);
    const ha = a.hp, hb = b.hp, y0 = me.y;
    me.superCharge = 1;
    steps(m, 1, new Map([[me.id, { ...emptyInput(), superAttack: 1, aim: -Math.PI / 2 }]]));
    expect(me.dash).not.toBeNull();
    steps(m, 30);
    expect(y0 - me.y).toBeGreaterThan(S.dashTiles - 0.5);
    expect(ha - a.hp).toBeGreaterThanOrEqual(S.dashDamage);
    expect(hb - b.hp).toBeGreaterThanOrEqual(S.slamDamage);
    expect(w.map.get(Math.floor(me.x) + 1, Math.floor(y0 - S.dashTiles - 0.5))).toBe(T.Floor);
  });
});

describe('Выживание: роботы', () => {
  it('с самого начала дерутся с теми, кто подошёл близко (а не ждут удара игрока)', () => {
    const cfg = buildLineup({ mode: 'showdown', humans: [{ name: 'Я', heroId: 'smile', skinId: 'default', level: 1, owner: 'local' }], difficulty: 'normal', seed: 4, mapId: 'sd2' });
    const m = new Match(cfg);
    const w = m.world;
    const me = m.fighterOf('local')!;
    const [a, b] = w.fighters.filter((f) => f.isBot && f.heroId !== 'robo_tank');
    // два робота рядом друг с другом на открытом месте, игрок далеко и ничего не делает
    clearArea(w, 14, 14, 19, 18);
    place(a, 15, 16); place(b, 18, 16);
    place(me, 2, 2);
    // считаем выстрелы роботов друг в друга (по направлению на соседа)
    let shots = 0;
    for (let i = 0; i < 30 * 4; i++) {
      m.step(new Map([[me.id, emptyInput()]]));
      for (const e of m.drainEvents()) {
        if (e.t !== 'shot' || (e.id !== a.id && e.id !== b.id)) continue;
        const o = e.id === a.id ? b : a;
        const want = Math.atan2(o.y - e.y, o.x - e.x);
        if (Math.abs(Math.atan2(Math.sin(e.a - want), Math.cos(e.a - want))) < 0.6) shots++;
      }
    }
    expect(shots).toBeGreaterThan(0);
  });
});
