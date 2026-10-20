import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ECONOMY } from '../src/meta/economy';
import {
  applyBattle, claimRoad, earnsDrop, grant, openBox, openNextDrop, openStarrDrop, ownsHero, rollDropRarity, rollHero,
  type BattleContext,
} from '../src/meta/progress';
import { defaultSave, migrate, SAVE_VERSION } from '../src/meta/save';
import type { MatchResult } from '../src/sim/types';

const NOW = new Date(2026, 9, 20, 12, 0, 0);
const win: MatchResult = { mode: 'gemgrab', winnerTeam: 0, starPlayerId: 1, duration: 100, reason: 'normal' };
const loss: MatchResult = { ...win, winnerTeam: 1 };
function ctx(over: Partial<BattleContext> & { result: MatchResult }): BattleContext {
  return { mode: 'gemgrab', heroId: 'smile', myTeam: 0, teamShowdown: false, stats: { damage: 1000, kills: 1, gems: 2, supers: 0, cubes: 0 }, isStar: false, now: NOW, ...over };
}
const sd = (place: number): MatchResult => ({ mode: 'showdown', winnerTeam: null, teamPlace: { 0: place }, starPlayerId: 1, duration: 60, reason: 'normal' });

describe('герои открываются по одному', () => {
  it('новый игрок: только Смайл', () => {
    const s = defaultSave();
    expect(ownsHero(s, 'smile')).toBe(true);
    expect(ownsHero(s, 'bacteria')).toBe(false);
    expect(ownsHero(s, 'lion')).toBe(false);
  });
  it('герой-награда открывает героя, повтор превращается в кристаллы', () => {
    const s = defaultSave();
    expect(grant(s, { kind: 'hero', heroId: 'lion' })).toEqual([{ kind: 'hero', heroId: 'lion' }]);
    expect(ownsHero(s, 'lion')).toBe(true);
    expect(s.heroes.lion.level).toBe(1);
    const gems = s.gems;
    const again = grant(s, { kind: 'hero', heroId: 'lion' });
    expect(again[0].kind).toBe('gems');
    expect(s.gems).toBe(gems + ECONOMY.heroes.duplicateGems.epic);
  });
  it('Бактерия — на Дороге трофеев, Лев — на 600 трофеях', () => {
    const s = defaultSave();
    s.bestTrophies = 600;
    expect(claimRoad(s, 40)).toEqual([{ kind: 'hero', heroId: 'bacteria' }]);
    expect(ownsHero(s, 'bacteria')).toBe(true);
    expect(claimRoad(s, 600)).toEqual([{ kind: 'hero', heroId: 'lion' }]);
    expect(ownsHero(s, 'lion')).toBe(true);
  });
  it('редкий герой выпадает чаще эпического', () => {
    const rng = new Rng(3);
    const n = { bacteria: 0, lion: 0 } as Record<string, number>;
    for (let i = 0; i < 4000; i++) n[rollHero(defaultSave(), rng)!]++;
    expect(n.bacteria).toBeGreaterThan(n.lion * 1.5);
    expect(n.lion).toBeGreaterThan(0);
  });
  it('уже открытые не выпадают, а когда открыты все — null', () => {
    const s = defaultSave();
    grant(s, { kind: 'hero', heroId: 'bacteria' });
    expect(rollHero(s, new Rng(1))).toBe('lion');
    grant(s, { kind: 'hero', heroId: 'lion' });
    expect(rollHero(s, new Rng(1))).toBeNull();
  });
  it('из ящиков выпадают только новые герои', () => {
    const rng = new Rng(11);
    let heroes = 0;
    for (let i = 0; i < 2000; i++) {
      const s = defaultSave();
      grant(s, { kind: 'hero', heroId: 'bacteria' });
      for (const r of openBox(s, 'mega', rng)) if (r.kind === 'hero') { heroes++; expect(r.heroId).toBe('lion'); }
    }
    expect(heroes / 2000).toBeGreaterThan(0.04);
    expect(heroes / 2000).toBeLessThan(0.1);
  });
  it('скины из ящика — только для открытых героев', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 500; i++) {
      const s = defaultSave();
      for (const r of openBox(s, 'mega', rng)) if (r.kind === 'skin') expect(r.heroId).toBe('smile');
    }
  });
});

describe('Старр-дропы', () => {
  it('за победу — дроп, за поражение — нет', () => {
    const s = defaultSave();
    const r = applyBattle(s, ctx({ result: win }), new Rng(1));
    expect(r.drop).not.toBeNull();
    expect(s.drops).toHaveLength(1);
    expect(applyBattle(s, ctx({ result: loss }), new Rng(1)).drop).toBeNull();
    expect(s.drops).toHaveLength(1);
  });
  it('Выживание: 1–3 место в одиночку, 1 место командой; выход и полигон — без дропа', () => {
    expect(earnsDrop(ctx({ mode: 'showdown', result: sd(3) }), null, 3)).toBe(true);
    expect(earnsDrop(ctx({ mode: 'showdown', result: sd(4) }), null, 4)).toBe(false);
    expect(earnsDrop(ctx({ mode: 'showdown', teamShowdown: true, result: sd(2) }), null, 2)).toBe(false);
    expect(earnsDrop(ctx({ mode: 'showdown', teamShowdown: true, result: sd(1) }), true, 1)).toBe(true);
    expect(earnsDrop(ctx({ result: { ...win, reason: 'quit' } }), true, 0)).toBe(false);
    expect(earnsDrop(ctx({ mode: 'training', result: { ...win, mode: 'training' } }), true, 0)).toBe(false);
  });
  it('редкость дропа — по таблице шансов', () => {
    const rng = new Rng(9);
    const n: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) { const r = rollDropRarity(rng); n[r] = (n[r] ?? 0) + 1; }
    for (const [r, p] of Object.entries(ECONOMY.starrDrop.odds)) expect(Math.abs((n[r] ?? 0) / N - p)).toBeLessThan(0.015);
  });
  it('из Редкого дропа никогда не выпадает эпический Лев', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 3000; i++) {
      const s = defaultSave();
      const { item } = openStarrDrop(s, 'rare', rng);
      if (item.kind === 'hero') expect(item.heroId).toBe('bacteria');
      expect(ownsHero(s, 'lion')).toBe(false);
    }
  });
  it('в дропе бывает герой, блинги, кристаллы и монеты', () => {
    const rng = new Rng(8);
    const kinds = new Set<string>();
    for (let i = 0; i < 2000; i++) kinds.add(openStarrDrop(defaultSave(), 'epic', rng).item.kind);
    for (const k of ['hero', 'bling', 'gems', 'coins', 'box', 'skin']) expect(kinds).toContain(k);
  });
  it('Легендарный дроп часто даёт нового героя', () => {
    const rng = new Rng(12);
    let heroes = 0;
    for (let i = 0; i < 1000; i++) if (openStarrDrop(defaultSave(), 'legendary', rng).item.kind === 'hero') heroes++;
    expect(heroes / 1000).toBeGreaterThan(0.38);
  });
  it('всё уже есть — вместо героя и скина кристаллы', () => {
    const rng = new Rng(2);
    const s = defaultSave();
    grant(s, { kind: 'hero', heroId: 'bacteria' });
    grant(s, { kind: 'hero', heroId: 'lion' });
    s.skins = ['smile:angry', 'smile:cosmo', 'smile:mint', 'bacteria:king', 'bacteria:rainbow', 'bacteria:fire', 'lion:snow', 'lion:shadow'];
    for (let i = 0; i < 300; i++) {
      const { item } = openStarrDrop(s, 'legendary', rng);
      expect(item.kind === 'hero' || item.kind === 'skin').toBe(false);
    }
  });
  it('открываются по очереди и пропадают из списка', () => {
    const s = defaultSave();
    s.drops = ['rare', 'epic'];
    expect(openNextDrop(s, new Rng(1))?.rarity).toBe('rare');
    expect(openNextDrop(s, new Rng(1))?.rarity).toBe('epic');
    expect(openNextDrop(s, new Rng(1))).toBeNull();
  });
});

describe('миграция на версию 3', () => {
  it('кто уже играл Бактерией — она остаётся, не игранные герои закрываются', () => {
    const d = migrate({ v: 2, nick: 'Аня', heroes: { smile: { level: 2, trophies: 30 }, bacteria: { level: 1, trophies: 12, played: 3 } }, selectedHero: 'bacteria' });
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.owned).toContain('smile');
    expect(d.owned).toContain('bacteria');
    expect(d.selectedHero).toBe('bacteria');
    const fresh = migrate({ v: 2, nick: 'Боря', heroes: { smile: { level: 1 }, bacteria: { level: 1, trophies: 0, played: 0 } }, selectedHero: 'bacteria' });
    expect(fresh.owned).toEqual(['smile']);
    expect(fresh.selectedHero).toBe('smile');
  });
  it('купленный скин сохраняет героя', () => {
    const d = migrate({ v: 2, heroes: {}, skins: ['bacteria:king'] });
    expect(d.owned).toContain('bacteria');
  });
});
