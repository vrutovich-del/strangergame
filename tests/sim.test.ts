import { describe, expect, it } from 'vitest';
import { buildLineup } from '../src/modes/lineup';
import { Match } from '../src/sim/match';
import type { MatchConfig } from '../src/sim/types';
import { MAPS, parseMap } from '../src/maps';

function botsOnly(cfg: MatchConfig): MatchConfig {
  return { ...cfg, players: cfg.players.map((p) => ({ ...p, isBot: true, owner: p.isBot ? '' : 'test' })) };
}

function run(cfg: MatchConfig, seconds: number) {
  const m = new Match(cfg);
  const steps = seconds * 30;
  for (let i = 0; i < steps && !m.result; i++) { m.step(new Map()); m.drainEvents(); }
  return m;
}

describe('карты', () => {
  it('все карты разбираются и имеют старты', () => {
    for (const def of MAPS) {
      const g = parseMap(def);
      expect(g.w).toBeGreaterThan(10);
      if (def.mode === 'gemgrab') { expect(g.mines.length).toBe(1); expect(g.blueSpawns.length).toBe(3); expect(g.redSpawns.length).toBe(3); }
      if (def.mode === 'knockout') { expect(g.blueSpawns.length).toBe(3); expect(g.redSpawns.length).toBe(3); }
      if (def.mode === 'showdown') { expect(g.blueSpawns.length + g.redSpawns.length).toBeGreaterThanOrEqual(10); expect(g.boxes.length).toBeGreaterThan(4); }
    }
  });
});

describe('правила режимов (боты против ботов)', () => {
  const human = { name: 'Тест', heroId: 'smile', skinId: 'default', level: 3, owner: 'test' };
  for (const mapId of ['gem1', 'gem2']) {
    it(`Захват кристаллов заканчивается (${mapId})`, () => {
      const cfg = botsOnly(buildLineup({ mode: 'gemgrab', humans: [human, { ...human, heroId: 'bacteria' }], difficulty: 'normal', seed: 7, mapId }));
      const m = run(cfg, 200);
      expect(m.result).not.toBeNull();
      expect(m.result!.duration).toBeLessThanOrEqual(151);
      const total = m.world.fighters.reduce((a, f) => a + f.stats.gems, 0);
      expect(total).toBeGreaterThan(0);
    });
  }
  for (const mapId of ['ko1', 'ko2']) {
    it(`Нокаут доходит до 2 побед (${mapId})`, () => {
      const cfg = botsOnly(buildLineup({ mode: 'knockout', humans: [human], difficulty: 'hard', seed: 3, mapId }));
      const m = run(cfg, 400);
      expect(m.result).not.toBeNull();
      const s = m.result!.score!;
      expect(Math.max(s[0], s[1])).toBe(2);
    });
  }
  for (const mapId of ['sd1', 'sd2']) {
    it(`Выживание определяет места (${mapId})`, () => {
      const cfg = botsOnly(buildLineup({ mode: 'showdown', humans: [human], difficulty: 'normal', seed: 11, mapId }));
      const m = run(cfg, 300);
      expect(m.result).not.toBeNull();
      expect(m.result!.teamPlace![0]).toBeGreaterThanOrEqual(1);
      expect(m.result!.teamPlace![0]).toBeLessThanOrEqual(10);
    });
  }
  it('Командное выживание с друзьями', () => {
    const cfg = botsOnly(buildLineup({ mode: 'showdown', humans: [human, human], difficulty: 'normal', seed: 5 }));
    expect(cfg.teamShowdown).toBe(true);
    expect(cfg.players.length).toBe(12);
    const m = run(cfg, 300);
    expect(m.result).not.toBeNull();
  });
});
