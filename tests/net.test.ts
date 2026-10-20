import { describe, expect, it } from 'vitest';
import { buildLineup } from '../src/modes/lineup';
import { CODE_ALPHABET, normalizeCode, randomCode } from '../src/net/code';
import { InputQueue, mergeInputs } from '../src/net/netBattle';
import { decodeFighter, decodeInput, encodeInput, encodeStats, makeSnapshot, pack, unpack } from '../src/net/protocol';
import { Match } from '../src/sim/match';
import { emptyInput, type FighterInput } from '../src/sim/types';

describe('коды комнат', () => {
  it('5 символов без похожих 0/O и 1/I', () => {
    for (let i = 0; i < 200; i++) {
      const c = randomCode();
      expect(c).toHaveLength(5);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
      expect(c).not.toMatch(/[01OI]/);
    }
  });
  it('код чистится от мусора и пробелов', () => {
    expect(normalizeCode(' k7m-2x ')).toBe('K7M2X');
    expect(normalizeCode('k7m2xyz')).toBe('K7M2X');
  });
});

describe('сериализация сетевых сообщений', () => {
  it('ввод упаковывается и распаковывается', () => {
    const inp: FighterInput = { mx: 0.71, my: -0.71, aim: 2.345, attack: 2, superAttack: 1, emote: 5, seq: 1234 };
    const back = decodeInput(JSON.parse(JSON.stringify(encodeInput(inp))));
    expect(back.seq).toBe(1234);
    expect(back.mx).toBeCloseTo(0.71, 2);
    expect(back.my).toBeCloseTo(-0.71, 2);
    expect(back.aim).toBeCloseTo(2.345, 3);
    expect(back.attack).toBe(2);
    expect(back.superAttack).toBe(1);
    expect(back.emote).toBe(5);
  });
  it('плохой ввод от клиента обрезается до безопасных значений', () => {
    const back = decodeInput([1, 9999, -9999, 0, 7, 99, 500]);
    expect(back.mx).toBe(1);
    expect(back.my).toBe(-1);
    expect(back.attack).toBe(0);
    expect(back.superAttack).toBe(0);
    expect(back.emote).toBe(-1);
  });
  it('снимок мира переносит бойцов, снаряды и счёт', () => {
    const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Хост', heroId: 'smile', skinId: 'default', level: 3, owner: 'peer-a' }, { name: 'Друг', heroId: 'bacteria', skinId: 'default', level: 2, owner: 'peer-b' }], difficulty: 'normal', seed: 9, mapId: 'gem1' });
    const m = new Match(cfg);
    for (let i = 0; i < 90; i++) { m.step(new Map()); m.drainEvents(); }
    const w = m.world;
    const f = w.fighters[1];
    f.gems = 4; f.superCharge = 0.5;
    const snap = makeSnapshot(w, 77, m.rules.hud(m), [{ t: 'gem', x: 10.5, y: 15.5 }], 0, true);
    const msg = unpack(pack({ t: 'snap', s: snap }));
    expect(msg?.t).toBe('snap');
    if (msg?.t !== 'snap') return;
    const s = msg.s;
    expect(s.ack).toBe(77);
    expect(s.f).toHaveLength(6);
    expect(s.fi?.find((a) => a[0] === f.id)?.[1]).toBe('bacteria');
    const d = decodeFighter(s.f[1]);
    expect(d.id).toBe(f.id);
    expect(d.x).toBeCloseTo(f.x, 1);
    expect(d.y).toBeCloseTo(f.y, 1);
    expect(d.hp).toBe(Math.round(f.hp));
    expect(d.gems).toBe(4);
    expect(d.superCharge).toBeCloseTo(0.5, 2);
    expect(d.alive).toBe(f.alive);
    expect(s.h.timer).toBeGreaterThan(140);
    expect(s.ev[0]).toEqual({ t: 'gem', x: 10.5, y: 15.5 });
    // снимок небольшой — его можно слать 20 раз в секунду
    expect(pack({ t: 'snap', s: snap }).length).toBeLessThan(6000);
  });
  it('статистика в конце боя', () => {
    const cfg = buildLineup({ mode: 'knockout', humans: [{ name: 'Я', heroId: 'smile', skinId: 'default', level: 1, owner: 'a' }], difficulty: 'easy', seed: 3 });
    const m = new Match(cfg);
    m.world.fighters[0].stats.kills = 3;
    const st = encodeStats(m.world);
    expect(st[0][0]).toBe(m.world.fighters[0].id);
    expect(st[0][2]).toBe(3);
  });
  it('мусор вместо сообщения не ломает разбор', () => {
    expect(unpack('не json')).toBeNull();
    expect(unpack('42')).toBeNull();
  });
});

describe('ввод друга у хоста (игра по Wi‑Fi)', () => {
  const inp = (seq: number, o: Partial<FighterInput> = {}): FighterInput => ({ ...emptyInput(), mx: 1, seq, ...o });
  it('ровно один ввод за тик — движение у друга и у хоста совпадает', () => {
    const q = new InputQueue();
    q.push(inp(1)); q.push(inp(2)); q.push(inp(3));
    expect(q.next()?.seq).toBe(1);
    expect(q.next()?.seq).toBe(2);
    expect(q.next()?.seq).toBe(3);
  });
  it('пакеты пришли пачкой после паузы: ни один шаг не теряется и не повторяется', () => {
    const q = new InputQueue();
    let moved = 0;
    const tick = () => { const i = q.next(); if (i) moved += i.steps ?? 1; };
    let seq = 0;
    for (let t = 0; t < 300; t++) {
      // Wi‑Fi: то пусто, то сразу несколько пакетов
      if (t % 5 === 0) for (let k = 0; k < 5; k++) q.push(inp(++seq));
      tick();
    }
    for (let t = 0; t < 20; t++) tick();
    expect(moved).toBe(seq);
  });
  it('очередь не растёт бесконечно: хост догоняет, выстрелы не теряются', () => {
    const q = new InputQueue();
    for (let i = 1; i <= 60; i++) q.push(inp(i, { attack: i === 3 ? 1 : 0 }));
    let attacks = 0, ticks = 0;
    let i;
    while ((i = q.next())) { ticks++; if (i.attack) attacks++; }
    expect(attacks).toBe(1);
    expect(ticks).toBeLessThan(60);
  });
  it('склейка двух вводов: два шага движения и последний выстрел', () => {
    const m = mergeInputs(inp(1, { attack: 1, aim: 2 }), inp(2, { mx: 0, my: 1 }));
    expect(m.steps).toBe(2);
    expect(m.mx).toBeCloseTo(0.5); expect(m.my).toBeCloseTo(0.5);
    expect(m.attack).toBe(1); expect(m.aim).toBe(2); expect(m.seq).toBe(2);
  });
  it('дальность прицела супера доходит до хоста', () => {
    expect(decodeInput(encodeInput(inp(5, { superAttack: 1, power: 0.42 }))).power).toBeCloseTo(0.42, 2);
    expect(decodeInput([1, 0, 0, 0, 0, 0, -1]).power).toBe(1); // старый формат
  });
  it('прыжок Льва и оглушение — «вынужденное движение»: друг не предсказывает его сам', () => {
    const cfg = buildLineup({ mode: 'gemgrab', humans: [{ name: 'Я', heroId: 'lion', skinId: 'default', level: 1, owner: 'a' }], difficulty: 'normal', seed: 1, mapId: 'gem1' });
    const m = new Match(cfg);
    const f = m.world.fighters[0];
    f.leap = { x0: f.x, y0: f.y, x1: f.x + 3, y1: f.y, t0: 0, t1: 1 };
    expect(decodeFighter(makeSnapshot(m.world, 0, m.rules.hud(m), [], 0, false).f[0]).forced).toBe(true);
    f.leap = null;
    expect(decodeFighter(makeSnapshot(m.world, 0, m.rules.hud(m), [], 0, false).f[0]).forced).toBe(false);
    f.stunUntil = m.world.time + 1;
    expect(decodeFighter(makeSnapshot(m.world, 0, m.rules.hud(m), [], 0, false).f[0]).forced).toBe(true);
    f.stunUntil = 0;
    expect(decodeFighter(makeSnapshot(m.world, 0, m.rules.hud(m), [], 0, false, true).f[0]).forced).toBe(true);
  });
});
