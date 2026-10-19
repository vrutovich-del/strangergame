import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ECONOMY, passRewards } from '../src/meta/economy';
import {
  applyBattle, boxOdds, buyBox, buyPremiumPass, buySkin, claimLogin, claimPass, claimQuest, claimRoad, computeRewards,
  dayKey, ensureDaily, ensureSeason, heroStatsAt, openBox, ownsSkin, passTier, seasonInfo, totalTrophies, upgradeCost, upgradeHero,
  type BattleContext,
} from '../src/meta/progress';
import { defaultSave, exportCode, importCode, loadSave, migrate, SAVE_KEY, SAVE_VERSION, writeSave } from '../src/meta/save';
import type { MatchResult } from '../src/sim/types';

const NOW = new Date(2026, 9, 18, 12, 0, 0);

function ctx(over: Partial<BattleContext> & { result: MatchResult }): BattleContext {
  return { mode: 'gemgrab', heroId: 'smile', myTeam: 0, teamShowdown: false, stats: { damage: 5000, kills: 2, gems: 4, supers: 1, cubes: 0 }, isStar: false, now: NOW, ...over };
}
const win: MatchResult = { mode: 'gemgrab', winnerTeam: 0, starPlayerId: 1, duration: 100, reason: 'normal' };
const loss: MatchResult = { ...win, winnerTeam: 1 };

describe('уровни и урон', () => {
  it('каждый уровень даёт +8% HP и урона', () => {
    const l1 = heroStatsAt('smile', 1), l9 = heroStatsAt('smile', 9);
    expect(l1.hp).toBe(3200);
    expect(l1.damage).toBe(360);
    expect(l9.hp).toBe(Math.round(3200 * 1.64));
    expect(l9.damage).toBe(Math.round(360 * 1.64));
    expect(heroStatsAt('bacteria', 1).hp).toBe(3800);
  });
  it('цены прокачки как в задании, максимум — 9 уровень', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((l) => upgradeCost(l))).toEqual([20, 35, 75, 140, 290, 480, 800, 1250]);
    expect(upgradeCost(9)).toBeNull();
  });
  it('прокачка тратит монеты и не уходит в минус', () => {
    const s = defaultSave();
    s.coins = 50;
    expect(upgradeHero(s, 'smile')).toBe(true);
    expect(s.heroes.smile.level).toBe(2);
    expect(s.coins).toBe(30);
    expect(upgradeHero(s, 'smile')).toBe(false); // нужно 35
    expect(s.coins).toBe(30);
  });
});

describe('начисление валют за бой', () => {
  it('стартовый набор нового игрока', () => {
    const s = defaultSave();
    expect([s.coins, s.gems, s.bling]).toEqual([100, 30, 0]);
    expect(s.heroes.smile.level).toBe(1);
    expect(s.heroes.bacteria.level).toBe(1);
    expect(totalTrophies(s)).toBe(0);
  });
  it('победа: +8 трофеев, +20 монет, блинги за первую победу дня — один раз', () => {
    const s = defaultSave();
    ensureDaily(s, NOW);
    const r1 = applyBattle(s, ctx({ result: win }));
    expect(r1.trophies).toBe(8);
    expect(r1.coins).toBe(20);
    expect(r1.bling).toBe(ECONOMY.firstWinBling);
    expect(s.coins).toBe(120);
    expect(s.heroes.smile.trophies).toBe(8);
    const r2 = applyBattle(s, ctx({ result: win }));
    expect(r2.bling).toBe(0);
    expect(s.pass.xp).toBe(60);
  });
  it('поражение до 50 трофеев не отнимает трофеи, после — минус 4', () => {
    const s = defaultSave();
    ensureDaily(s, NOW);
    s.heroes.smile.trophies = 20;
    expect(applyBattle(s, ctx({ result: loss })).trophies).toBe(0);
    expect(s.coins).toBe(108);
    s.heroes.smile.trophies = 60;
    expect(applyBattle(s, ctx({ result: loss })).trophies).toBe(-4);
    expect(s.heroes.smile.trophies).toBe(56);
  });
  it('хост вышел: трофеи не меняются, за победу не награждаем', () => {
    const s = defaultSave();
    s.heroes.smile.trophies = 100;
    const r = computeRewards(s, ctx({ result: { ...win, reason: 'host_left' } }));
    expect(r.trophies).toBe(0);
    expect(r.won).toBeNull();
  });
  it('выживание: награда по месту', () => {
    const s = defaultSave();
    s.heroes.smile.trophies = 200;
    const sd = (place: number) => computeRewards(s, ctx({ mode: 'showdown', result: { mode: 'showdown', winnerTeam: null, teamPlace: { 0: place }, starPlayerId: 1, duration: 60, reason: 'normal' } }));
    expect(sd(1).trophies).toBe(10);
    expect(sd(10).trophies).toBe(-6);
    expect(sd(1).won).toBe(true);
  });
  it('выход из боя засчитывается как поражение без монет', () => {
    const s = defaultSave();
    s.heroes.smile.trophies = 100;
    const r = computeRewards(s, ctx({ result: { ...loss, reason: 'quit' } }));
    expect(r.coins).toBe(0);
    expect(r.trophies).toBe(-4);
  });
  it('рекорд трофеев и дорога трофеев', () => {
    const s = defaultSave();
    s.heroes.smile.trophies = 30;
    s.bestTrophies = 30;
    expect(claimRoad(s, 10)).not.toBeNull();
    expect(s.coins).toBe(150);
    expect(claimRoad(s, 10)).toBeNull(); // уже забрали
    expect(claimRoad(s, 50)).toBeNull(); // ещё не дошли
  });
});

describe('ящики', () => {
  it('таблица шансов берётся из конфига и видна игроку', () => {
    const odds = boxOdds('mega');
    expect(odds.some((x) => x.includes('12%'))).toBe(true);
    expect(odds[0]).toContain(`${ECONOMY.boxes.mega.coins[0]}–${ECONOMY.boxes.mega.coins[1]}`);
  });
  it('монеты всегда в пределах таблицы, скин выпадает только новый', () => {
    const rng = new Rng(42);
    for (const kind of ['common', 'big', 'mega'] as const) {
      for (let i = 0; i < 300; i++) {
        const s = defaultSave();
        const got = openBox(s, kind, rng);
        const coins = got.find((r) => r.kind === 'coins');
        expect(coins && coins.kind === 'coins' && coins.amount >= ECONOMY.boxes[kind].coins[0] && coins.amount <= ECONOMY.boxes[kind].coins[1]).toBe(true);
        for (const r of got) if (r.kind === 'skin') expect(ownsSkin(s, r.heroId, r.skinId)).toBe(true);
      }
    }
  });
  it('частота скинов в мега-ящике близка к таблице', () => {
    const rng = new Rng(7);
    let skins = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) if (openBox(defaultSave(), 'mega', rng).some((r) => r.kind === 'skin')) skins++;
    expect(skins / N).toBeGreaterThan(0.08);
    expect(skins / N).toBeLessThan(0.16);
  });
  it('покупка ящика списывает цену', () => {
    const s = defaultSave();
    s.coins = 100;
    expect(buyBox(s, 'common', new Rng(1))).not.toBeNull();
    expect(s.coins).toBeGreaterThanOrEqual(20); // 100 − 100 + монеты из ящика
    s.gems = 10;
    expect(buyBox(s, 'big', new Rng(1))).toBeNull();
  });
});

describe('скины, пропуск, задания, вход', () => {
  it('покупка скина за кристаллы и блинги, эксклюзив не продаётся', () => {
    const s = defaultSave();
    s.gems = 100; s.bling = 300;
    expect(buySkin(s, 'smile', 'angry')).toBe(true);
    expect(s.gems).toBe(71);
    expect(buySkin(s, 'smile', 'angry')).toBe(false);
    expect(buySkin(s, 'smile', 'mint')).toBe(true);
    expect(s.bling).toBe(50);
    expect(buySkin(s, 'smile', 'gold')).toBe(false);
  });
  it('пропуск: 30 уровней, премиум за 169 кристаллов, финал — эксклюзивный скин', () => {
    const s = defaultSave();
    ensureSeason(s, NOW.getTime());
    expect(passTier(0)).toBe(0);
    expect(passTier(ECONOMY.pass.xpPerTier * 31)).toBe(30);
    expect(claimPass(s, 1, false)).toBeNull();
    s.pass.xp = ECONOMY.pass.xpPerTier * 30;
    expect(claimPass(s, 1, false)).not.toBeNull();
    expect(claimPass(s, 1, false)).toBeNull();
    expect(claimPass(s, 30, true)).toBeNull(); // нужен премиум
    s.gems = 200;
    expect(buyPremiumPass(s)).toBe(true);
    expect(s.gems).toBe(31);
    claimPass(s, 30, true);
    const last = passRewards(s.pass.season).premium[29];
    expect(last.kind).toBe('skin');
    if (last.kind === 'skin') expect(ownsSkin(s, last.heroId, last.skinId)).toBe(true);
  });
  it('сезон длится 4 недели и сбрасывает пропуск', () => {
    const a = seasonInfo(Date.UTC(2026, 9, 10));
    const b = seasonInfo(Date.UTC(2026, 10, 10));
    expect(b.season).toBe(a.season + 1);
    const s = defaultSave();
    ensureSeason(s, Date.UTC(2026, 9, 10));
    s.pass.xp = 5000; s.pass.premium = true;
    ensureSeason(s, Date.UTC(2026, 10, 10));
    expect(s.pass.xp).toBe(0);
    expect(s.pass.premium).toBe(false);
  });
  it('3 задания в день, прогресс от боёв и награда', () => {
    const s = defaultSave();
    ensureDaily(s, NOW);
    expect(s.quests.list.length).toBe(3);
    expect(s.quests.day).toBe(dayKey(NOW));
    s.quests.list[0] = { id: 'win', hero: '', target: 2, progress: 0, claimed: false };
    applyBattle(s, ctx({ result: win }));
    applyBattle(s, ctx({ result: win }));
    expect(s.quests.list[0].progress).toBe(2);
    const xp = s.pass.xp;
    expect(claimQuest(s, 0)).not.toBeNull();
    expect(s.pass.xp).toBe(xp + ECONOMY.questReward.xp);
    // на следующий день — новые задания
    ensureDaily(s, new Date(2026, 9, 19, 9));
    expect(s.quests.list.every((q) => q.progress === 0)).toBe(true);
  });
  it('награды за вход по дням, раз в день', () => {
    const s = defaultSave();
    expect(claimLogin(s, NOW)).not.toBeNull();
    expect(s.coins).toBe(150);
    expect(claimLogin(s, NOW)).toBeNull();
    expect(claimLogin(s, new Date(2026, 9, 19, 10))).not.toBeNull();
    expect(s.gems).toBe(35);
    expect(s.login.next).toBe(2);
  });
});

describe('сохранение и миграции', () => {
  it('старое сохранение без версии переводится в текущую схему', () => {
    const old = { nick: 'Вася', wallet: { coins: 555, gems: 7, bling: 3 }, heroes: { smile: { level: 4, trophies: 77 } } };
    const d = migrate(old);
    expect(d.v).toBe(SAVE_VERSION);
    expect(d.coins).toBe(555);
    expect(d.gems).toBe(7);
    expect(d.heroes.smile.level).toBe(4);
    expect(d.heroes.smile.skin).toBe('default');
    expect(d.heroes.bacteria.level).toBe(1);
    expect((d as any).wallet).toBeUndefined();
    expect(d.boxes).toEqual([]);
    expect(d.settings.difficulty).toBe('auto');
  });
  it('версия 1 → 2', () => {
    const d = migrate({ v: 1, nick: 'Петя', coins: 10, settings: { sfx: 0.2 } });
    expect(d.v).toBe(2);
    expect(d.settings.sfx).toBe(0.2);
    expect(d.settings.difficulty).toBe('auto');
  });
  it('мусор вместо сохранения — начинаем заново', () => {
    expect(migrate(null).coins).toBe(100);
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    mem.set(SAVE_KEY, '{не json');
    expect(loadSave(st).coins).toBe(100);
  });
  it('сохранение переживает перезагрузку', () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const s = defaultSave();
    s.nick = 'Ёжик'; s.coins = 999; s.skins.push('smile:angry');
    writeSave(s, st);
    const back = loadSave(st);
    expect(back.nick).toBe('Ёжик');
    expect(back.coins).toBe(999);
    expect(back.skins).toContain('smile:angry');
  });
  it('экспорт и импорт кодом (с русским ником)', () => {
    const s = defaultSave();
    s.nick = 'Странный Чих'; s.gems = 321; s.heroes.bacteria.level = 7;
    const code = exportCode(s);
    expect(code.startsWith('IS1.')).toBe(true);
    const back = importCode('  ' + code + '\n');
    expect(back?.nick).toBe('Странный Чих');
    expect(back?.gems).toBe(321);
    expect(back?.heroes.bacteria.level).toBe(7);
    // испорченный код не принимается
    expect(importCode(code.slice(0, -3) + 'zzz')).toBeNull();
    expect(importCode('привет')).toBeNull();
  });
});
