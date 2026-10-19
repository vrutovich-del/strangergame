import { describe, expect, it } from 'vitest';
import { buildLineup } from '../src/modes/lineup';
import { CODE_ALPHABET, normalizeCode, randomCode } from '../src/net/code';
import { decodeFighter, decodeInput, encodeInput, encodeStats, makeSnapshot, pack, unpack } from '../src/net/protocol';
import { Match } from '../src/sim/match';
import type { FighterInput } from '../src/sim/types';

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
