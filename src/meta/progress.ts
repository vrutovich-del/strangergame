// Логика мета-игры: награды за бой, прокачка, покупки, ящики, пропуск, задания, вход, дорога трофеев.
// Все функции работают с данными сохранения и не знают об интерфейсе.
import { Rng } from '../core/rng';
import { getHero } from '../heroes/registry';
import { allSkins, getSkin } from '../heroes/skins';
import type { ModeId } from '../maps/types';
import type { MatchResult } from '../sim/types';
import { DAILY_DEALS, ECONOMY, passRewards, QUESTS, TROPHY_ROAD, type BoxKind, type Currency, type Reward } from './economy';
import type { SaveData } from './save';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

export function totalTrophies(s: SaveData) {
  return Object.values(s.heroes).reduce((a, h) => a + h.trophies, 0);
}

export function heroProgress(s: SaveData, heroId: string) {
  if (!s.heroes[heroId]) s.heroes[heroId] = { level: 1, trophies: 0, best: 0, skin: 'default', played: 0, wins: 0 };
  return s.heroes[heroId];
}

// ───────────── валюта ─────────────
export function canAfford(s: SaveData, c: Currency, amount: number) { return s[c] >= amount; }
export function spend(s: SaveData, c: Currency, amount: number) {
  if (!canAfford(s, c, amount)) return false;
  s[c] -= amount;
  return true;
}

export const ownsSkin = (s: SaveData, heroId: string, skinId: string) => skinId === 'default' || s.skins.includes(`${heroId}:${skinId}`);

/** Выдать награду. Возвращает то, что реально выдано (скин-дубликат превращается в кристаллы). */
export function grant(s: SaveData, r: Reward, rng = new Rng(Date.now() & 0xffffff)): Reward[] {
  switch (r.kind) {
    case 'coins': s.coins += r.amount; return [r];
    case 'gems': s.gems += r.amount; return [r];
    case 'bling': s.bling += r.amount; return [r];
    case 'emote': if (!s.emotes.includes(r.id)) s.emotes.push(r.id); return [r];
    case 'skin': {
      if (ownsSkin(s, r.heroId, r.skinId)) {
        const sk = getSkin(r.heroId, r.skinId);
        const g = { kind: 'gems' as const, amount: Math.max(30, Math.round((sk.price || 100) * 0.6)) };
        s.gems += g.amount;
        return [g];
      }
      s.skins.push(`${r.heroId}:${r.skinId}`);
      return [r];
    }
    case 'box': return openBox(s, r.box, rng);
    case 'hero': return [r];
  }
}

/** Подарочный ящик новичку: гарантированный набор. */
export function starterGift(s: SaveData): Reward[] {
  return ECONOMY.starterGift.flatMap((r) => grant(s, r));
}

// ───────────── прокачка ─────────────
export function upgradeCost(level: number): number | null {
  if (level >= ECONOMY.maxLevel) return null;
  return ECONOMY.upgradeCost[level - 1];
}

export function upgradeHero(s: SaveData, heroId: string): boolean {
  const h = heroProgress(s, heroId);
  const cost = upgradeCost(h.level);
  if (cost === null || !spend(s, 'coins', cost)) return false;
  h.level++;
  return true;
}

/** Характеристики героя на уровне (для карточки и сравнения при прокачке). */
export function heroStatsAt(heroId: string, level: number) {
  const d = getHero(heroId);
  const k = 1 + 0.08 * (level - 1);
  return { hp: Math.round(d.stats.hp * k), damage: Math.round(d.stats.damage * k), superDamage: Math.round(d.stats.superDamage * k) };
}

// ───────────── скины и эмоции ─────────────
export function buySkin(s: SaveData, heroId: string, skinId: string): boolean {
  const sk = getSkin(heroId, skinId);
  if (sk.exclusive || ownsSkin(s, heroId, skinId)) return false;
  if (!spend(s, sk.currency, sk.price)) return false;
  s.skins.push(`${heroId}:${skinId}`);
  return true;
}

export function buyEmote(s: SaveData, id: number): boolean {
  const price = ECONOMY.emotes[id];
  if (price === undefined || s.emotes.includes(id)) return false;
  if (!spend(s, 'bling', price)) return false;
  s.emotes.push(id);
  return true;
}

// ───────────── ящики ─────────────
export function openBox(s: SaveData, kind: BoxKind, rng: Rng): Reward[] {
  const t = ECONOMY.boxes[kind];
  const out: Reward[] = [];
  const coins = rng.int(t.coins[0], t.coins[1]);
  out.push({ kind: 'coins', amount: coins });
  if (rng.chance(t.gems.chance)) out.push({ kind: 'gems', amount: rng.int(t.gems.min, t.gems.max) });
  if (rng.chance(t.bling.chance)) out.push({ kind: 'bling', amount: rng.int(t.bling.min, t.bling.max) });
  if (rng.chance(t.skin)) {
    const pool = allSkins().filter((k) => k.id !== 'default' && !k.exclusive && k.currency === 'gems' && !ownsSkin(s, k.heroId, k.id));
    if (pool.length) { const k = rng.pick(pool); out.push({ kind: 'skin', heroId: k.heroId, skinId: k.id }); }
  }
  const given: Reward[] = [];
  for (const r of out) given.push(...grant(s, r, rng));
  return given;
}

export function buyBox(s: SaveData, kind: BoxKind, rng: Rng): Reward[] | null {
  const p = ECONOMY.boxes[kind].price;
  if (!spend(s, p.currency, p.amount)) return null;
  return openBox(s, kind, rng);
}

/** Таблица шансов для кнопки «i». */
export function boxOdds(kind: BoxKind): string[] {
  const t = ECONOMY.boxes[kind];
  const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;
  return [
    `Монеты: 100% (${t.coins[0]}–${t.coins[1]})`,
    `Кристаллы: ${pc(t.gems.chance)} (${t.gems.min}–${t.gems.max})`,
    `Блинги: ${pc(t.bling.chance)} (${t.bling.min}–${t.bling.max})`,
    `Скин: ${pc(t.skin)}`,
  ];
}

// ───────────── боевой пропуск ─────────────
export function seasonInfo(now = Date.now()) {
  const len = ECONOMY.pass.seasonDays * 86400000;
  const n = Math.max(0, Math.floor((now - ECONOMY.pass.epoch) / len));
  return { season: n + 1, endsAt: ECONOMY.pass.epoch + (n + 1) * len };
}

export function ensureSeason(s: SaveData, now = Date.now()) {
  const { season } = seasonInfo(now);
  if (s.pass.season !== season) s.pass = { season, xp: 0, premium: false, free: [], prem: [] };
}

export const passTier = (xp: number) => Math.min(ECONOMY.pass.tiers, Math.floor(xp / ECONOMY.pass.xpPerTier));

export function claimPass(s: SaveData, tier: number, premium: boolean, rng = new Rng(Date.now() & 0xffffff)): Reward[] | null {
  if (tier < 1 || tier > passTier(s.pass.xp)) return null;
  if (premium && !s.pass.premium) return null;
  const list = premium ? s.pass.prem : s.pass.free;
  if (list.includes(tier)) return null;
  list.push(tier);
  const rw = passRewards(s.pass.season)[premium ? 'premium' : 'free'][tier - 1];
  return grant(s, rw, rng);
}

export function buyPremiumPass(s: SaveData) {
  if (s.pass.premium) return false;
  if (!spend(s, 'gems', ECONOMY.pass.premiumPrice)) return false;
  s.pass.premium = true;
  return true;
}

// ───────────── дорога трофеев ─────────────
export function claimRoad(s: SaveData, at: number, rng = new Rng(Date.now() & 0xffffff)): Reward[] | null {
  const m = TROPHY_ROAD.find((x) => x.at === at);
  if (!m || m.reward.kind === 'future' || s.road.claimed.includes(at) || s.bestTrophies < at) return null;
  s.road.claimed.push(at);
  return grant(s, m.reward as Reward, rng);
}

// ───────────── задания, вход, магазин (ежедневное) ─────────────
export function ensureDaily(s: SaveData, now = new Date()) {
  const today = dayKey(now);
  if (s.quests.day !== today) {
    const rng = new Rng(dayNum(today) * 7919 + s.createdAt % 1000);
    const pool = rng.shuffle(QUESTS.slice()).slice(0, 3);
    const heroes = Object.keys(s.heroes);
    s.quests = {
      day: today,
      list: pool.map((q) => ({ id: q.id, hero: q.hero ? rng.pick(heroes) : '', target: rng.pick(q.amounts), progress: 0, claimed: false })),
    };
  }
  if (s.shop.day !== today) s.shop = { day: today, gift: false, deal: false };
  ensureSeason(s, now.getTime());
}

export function loginAvailable(s: SaveData, now = new Date()) { return s.login.claimedDay !== dayKey(now); }

export function claimLogin(s: SaveData, now = new Date(), rng = new Rng(Date.now() & 0xffffff)): Reward[] | null {
  const today = dayKey(now);
  if (s.login.claimedDay === today) return null;
  // если пропустил больше дня — календарь начинается заново
  if (s.login.claimedDay && dayNum(today) - dayNum(s.login.claimedDay) > 1) s.login.next = 0;
  const r = ECONOMY.login[s.login.next % ECONOMY.login.length];
  s.login.next = (s.login.next + 1) % ECONOMY.login.length;
  s.login.claimedDay = today;
  s.login.lastDay = today;
  return grant(s, r, rng);
}

export function dailyDeal(now = new Date()) {
  return DAILY_DEALS[dayNum(dayKey(now)) % DAILY_DEALS.length];
}

export function questText(q: { id: string; hero: string; target: number }) {
  const t = QUESTS.find((x) => x.id === q.id)!;
  const heroName = q.hero ? { smile: 'Смайлом', bacteria: 'Бактерией' }[q.hero] ?? getHero(q.hero).name : '';
  return t.text(q.target, heroName);
}

export function claimQuest(s: SaveData, i: number, rng = new Rng(Date.now() & 0xffffff)): Reward[] | null {
  const q = s.quests.list[i];
  if (!q || q.claimed || q.progress < q.target) return null;
  q.claimed = true;
  s.pass.xp += ECONOMY.questReward.xp;
  const t = QUESTS.find((x) => x.id === q.id)!;
  return grant(s, t.reward, rng);
}

// ───────────── итоги боя ─────────────
export interface BattleStats { damage: number; kills: number; gems: number; supers: number; cubes: number }

export interface BattleContext {
  mode: ModeId;
  heroId: string;
  result: MatchResult;
  myTeam: number;
  teamShowdown: boolean;
  stats: BattleStats;
  isStar: boolean;
  now?: Date;
}

export interface BattleRewards {
  trophies: number;
  coins: number;
  xp: number;
  bling: number;
  /** true — победа, false — поражение, null — ничья/нет итога. */
  won: boolean | null;
  place: number;
  questsDone: number[];
  tierBefore: number;
  tierAfter: number;
  trophiesBefore: number;
}

/** Посчитать награды за бой (без изменения сохранения). */
export function computeRewards(s: SaveData, c: BattleContext): Omit<BattleRewards, 'questsDone' | 'tierBefore' | 'tierAfter' | 'trophiesBefore'> {
  const E = ECONOMY;
  const hero = heroProgress(s, c.heroId);
  const r = c.result;
  let trophies = 0, coins = 0, xp = 0, bling = 0, place = 0;
  let won: boolean | null = null;
  if (c.mode === 'training') return { trophies: 0, coins: 0, xp: 0, bling: 0, won: null, place: 0 };
  if (r.reason === 'host_left') {
    // хост вышел: за победу не награждаем, трофеи не отнимаем
    return { trophies: 0, coins: E.team.hostLeft.coins, xp: E.team.hostLeft.xp, bling: 0, won: null, place: 0 };
  }
  if (c.mode === 'showdown') {
    place = r.teamPlace?.[c.myTeam] ?? 10;
    const tab = c.teamShowdown ? E.teamShowdown : E.showdown;
    const i = Math.max(0, Math.min(tab.trophies.length - 1, place - 1));
    trophies = tab.trophies[i]; coins = tab.coins[i]; xp = tab.xp[i];
    won = place === 1 ? true : trophies < 0 ? false : null;
  } else {
    won = r.winnerTeam === null ? null : r.winnerTeam === c.myTeam;
    const row = won === null ? E.team.draw : won ? E.team.win : E.team.loss;
    trophies = row.trophies; coins = row.coins; xp = row.xp;
  }
  if (r.reason === 'quit') { coins = 0; xp = 0; trophies = Math.min(0, trophies); }
  if (trophies < 0 && hero.trophies < E.noLossBelow) trophies = 0;
  if (trophies < 0) trophies = Math.max(trophies, -hero.trophies);
  if (c.isStar && r.reason !== 'quit') coins += E.starPlayerCoins;
  const today = dayKey(c.now ?? new Date());
  if (won && s.firstWinDay !== today) bling = E.firstWinBling;
  return { trophies, coins, xp, bling, won, place };
}

/** Начислить награды и прогресс заданий. */
export function applyBattle(s: SaveData, c: BattleContext): BattleRewards {
  ensureDaily(s, c.now ?? new Date());
  const base = computeRewards(s, c);
  const hero = heroProgress(s, c.heroId);
  const trophiesBefore = totalTrophies(s);
  const tierBefore = passTier(s.pass.xp);
  hero.trophies = Math.max(0, hero.trophies + base.trophies);
  hero.best = Math.max(hero.best, hero.trophies);
  s.coins += base.coins;
  s.bling += base.bling;
  s.pass.xp += base.xp;
  if (base.bling > 0) s.firstWinDay = dayKey(c.now ?? new Date());
  s.bestTrophies = Math.max(s.bestTrophies, totalTrophies(s));
  if (c.mode !== 'training' && c.result.reason !== 'quit') {
    hero.played++;
    s.stats.games[c.mode] = (s.stats.games[c.mode] ?? 0) + 1;
    if (base.won) { hero.wins++; s.stats.wins[c.mode] = (s.stats.wins[c.mode] ?? 0) + 1; }
  }
  s.stats.kills += c.stats.kills;
  s.stats.damage += Math.round(c.stats.damage);
  // задания
  const questsDone: number[] = [];
  if (c.mode !== 'training' && c.result.reason !== 'quit') {
    s.quests.list.forEach((q, i) => {
      if (q.claimed || q.progress >= q.target) return;
      const before = q.progress;
      switch (q.id) {
        case 'win': if (base.won) q.progress++; break;
        case 'damage': if (q.hero === c.heroId) q.progress += Math.round(c.stats.damage); break;
        case 'gems': if (c.mode === 'gemgrab') q.progress += c.stats.gems; break;
        case 'kills': q.progress += c.stats.kills; break;
        case 'supers': q.progress += c.stats.supers; break;
        case 'play_showdown': if (c.mode === 'showdown') q.progress++; break;
        case 'play_knockout': if (c.mode === 'knockout') q.progress++; break;
        case 'cubes': if (c.mode === 'showdown') q.progress += c.stats.cubes; break;
        case 'top4': if (c.mode === 'showdown' && base.place > 0 && base.place <= 4) q.progress++; break;
      }
      q.progress = Math.min(q.target, q.progress);
      if (before < q.target && q.progress >= q.target) questsDone.push(i);
    });
  }
  return { ...base, questsDone, tierBefore, tierAfter: passTier(s.pass.xp), trophiesBefore };
}

/** Сложность роботов: из настроек или по трофеям героя. */
export function difficultyFor(s: SaveData, heroId: string): 'easy' | 'normal' | 'hard' {
  if (s.settings.difficulty !== 'auto') return s.settings.difficulty;
  const t = heroProgress(s, heroId).trophies;
  if (t < 15) return 'easy';
  if (t < 350) return 'normal';
  return 'hard';
}

/** Где есть что забрать (красные точки на кнопках). */
export function notifications(s: SaveData, now = new Date()) {
  ensureDaily(s, now);
  const tier = passTier(s.pass.xp);
  let pass = false;
  for (let t = 1; t <= tier; t++) if (!s.pass.free.includes(t) || (s.pass.premium && !s.pass.prem.includes(t))) pass = true;
  return {
    road: TROPHY_ROAD.some((m) => m.reward.kind !== 'future' && s.bestTrophies >= m.at && !s.road.claimed.includes(m.at)),
    pass,
    quests: s.quests.list.some((q) => !q.claimed && q.progress >= q.target) || loginAvailable(s, now),
    shop: !s.shop.gift,
    heroes: Object.entries(s.heroes).some(([, h]) => { const c = upgradeCost(h.level); return c !== null && s.coins >= c; }),
    boxes: s.boxes.length > 0,
  };
}

/** Описание награды для интерфейса. */
export function rewardLabel(r: Reward | { kind: 'future'; text: string }): { icon: string; text: string } {
  switch (r.kind) {
    case 'coins': return { icon: '🪙', text: `${r.amount}` };
    case 'gems': return { icon: '💎', text: `${r.amount}` };
    case 'bling': return { icon: '✨', text: `${r.amount}` };
    case 'box': return { icon: '📦', text: ECONOMY.boxes[r.box].name };
    case 'skin': return { icon: '👕', text: getSkin(r.heroId, r.skinId).name };
    case 'emote': return { icon: '😀', text: 'Эмоция' };
    case 'hero': return { icon: '🦸', text: 'Новый герой' };
    case 'future': return { icon: '❓', text: r.text };
  }
}
