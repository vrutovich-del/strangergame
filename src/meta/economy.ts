// Вся экономика игры в одном месте: цены, награды, таблицы ящиков, дорога трофеев, пропуск, задания.
// Никаких реальных платежей: всё покупается за игровую валюту, которая зарабатывается в игре.
import type { Rarity } from '../heroes/rarity';
import type { ModeId } from '../maps/types';

export type Currency = 'coins' | 'gems' | 'bling';
export type BoxKind = 'common' | 'big' | 'mega';

/** Редкость Старр-дропа (обычных дропов не бывает). */
export type DropRarity = Exclude<Rarity, 'common'>;

/** Награда: что-то одно из списка. */
export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'bling'; amount: number }
  | { kind: 'box'; box: BoxKind }
  | { kind: 'skin'; heroId: string; skinId: string }
  | { kind: 'emote'; id: number }
  | { kind: 'hero'; heroId: string };

export const ECONOMY = {
  start: { coins: 100, gems: 30, bling: 0 },
  maxLevel: 9,
  /** Цена перехода с уровня i+1 на i+2: 1→2 = 20, …, 8→9 = 1250. */
  upgradeCost: [20, 35, 75, 140, 290, 480, 800, 1250],
  /** Командные режимы. До 50 трофеев у героя трофеи за поражение не отнимаются. */
  team: {
    win: { trophies: 8, coins: 20, xp: 30 },
    loss: { trophies: -4, coins: 8, xp: 15 },
    draw: { trophies: 0, coins: 12, xp: 20 },
    hostLeft: { trophies: 0, coins: 8, xp: 12 },
  },
  noLossBelow: 50,
  /** Выживание: награды по месту (1-е … 10-е). */
  showdown: {
    trophies: [10, 8, 7, 6, 4, 2, 0, -2, -4, -6],
    coins: [20, 18, 16, 14, 12, 10, 9, 8, 7, 6],
    xp: [40, 35, 30, 26, 22, 18, 15, 12, 10, 8],
  },
  /** Выживание командой (4 команды). */
  teamShowdown: {
    trophies: [10, 5, 0, -4],
    coins: [20, 15, 10, 7],
    xp: [40, 30, 20, 14],
  },
  starPlayerCoins: 5,
  firstWinBling: 20,
  /** Боевой пропуск. */
  pass: { tiers: 30, xpPerTier: 300, premiumPrice: 169, seasonDays: 28, epoch: Date.UTC(2026, 9, 5) },
  /** Ящики: цена и таблица шансов (её видит игрок по кнопке «i»). */
  boxes: {
    common: {
      name: 'Обычный ящик', price: { currency: 'coins' as Currency, amount: 100 }, color: '#3fa9ff',
      coins: [20, 40], bling: { chance: 0.3, min: 5, max: 15 }, gems: { chance: 0.1, min: 2, max: 5 }, skin: 0.01, hero: 0.01,
    },
    big: {
      name: 'Большой ящик', price: { currency: 'gems' as Currency, amount: 30 }, color: '#b45cff',
      coins: [60, 120], bling: { chance: 0.5, min: 15, max: 40 }, gems: { chance: 0.25, min: 5, max: 10 }, skin: 0.04, hero: 0.03,
    },
    mega: {
      name: 'Мега-ящик', price: { currency: 'gems' as Currency, amount: 80 }, color: '#ff4fa3',
      coins: [150, 300], bling: { chance: 0.8, min: 40, max: 90 }, gems: { chance: 0.5, min: 10, max: 25 }, skin: 0.12, hero: 0.07,
    },
  },
  /** Герои: чем реже герой, тем меньше шанс, что выпадет именно он. Повтор превращается в кристаллы. */
  heroes: {
    weight: { common: 1, rare: 1, superrare: 0.7, epic: 0.45, mythic: 0.25, legendary: 0.12 } as Record<Rarity, number>,
    duplicateGems: { common: 20, rare: 40, superrare: 60, epic: 100, mythic: 150, legendary: 250 } as Record<Rarity, number>,
    /** Цена героя: его можно купить сразу за любую валюту — монеты, кристаллы или блинги. Чем реже, тем дороже. */
    price: {
      common: { coins: 400, gems: 20, bling: 150 },
      rare: { coins: 800, gems: 40, bling: 300 },
      superrare: { coins: 1500, gems: 75, bling: 550 },
      epic: { coins: 2500, gems: 125, bling: 900 },
      mythic: { coins: 4000, gems: 199, bling: 1400 },
      legendary: { coins: 6000, gems: 299, bling: 2100 },
    } as Record<Rarity, Record<Currency, number>>,
  },
  /**
   * Старр-дроп: выдаётся за каждую победу. Редкость определяется сразу, а при открытии дроп «повышается»
   * по ступенькам до неё. Внутри — одна награда по весам. Героя дроп даёт не реже своей редкости:
   * из Редкого — только редкого героя, из Эпического — до эпического и т.д.
   */
  starrDrop: {
    odds: { rare: 0.5, superrare: 0.28, epic: 0.15, mythic: 0.05, legendary: 0.02 } as Record<DropRarity, number>,
    loot: {
      rare: [{ w: 48, kind: 'coins', min: 25, max: 50 }, { w: 30, kind: 'bling', min: 10, max: 20 }, { w: 18, kind: 'gems', min: 2, max: 4 }, { w: 4, kind: 'hero' }],
      superrare: [{ w: 42, kind: 'coins', min: 60, max: 100 }, { w: 26, kind: 'bling', min: 25, max: 45 }, { w: 17, kind: 'gems', min: 5, max: 8 }, { w: 7, kind: 'box', box: 'common' }, { w: 8, kind: 'hero' }],
      epic: [{ w: 28, kind: 'coins', min: 120, max: 200 }, { w: 20, kind: 'bling', min: 50, max: 90 }, { w: 16, kind: 'gems', min: 10, max: 15 }, { w: 12, kind: 'box', box: 'big' }, { w: 12, kind: 'skin' }, { w: 12, kind: 'hero' }],
      mythic: [{ w: 16, kind: 'coins', min: 250, max: 400 }, { w: 14, kind: 'bling', min: 100, max: 160 }, { w: 16, kind: 'gems', min: 20, max: 30 }, { w: 14, kind: 'box', box: 'mega' }, { w: 18, kind: 'skin' }, { w: 22, kind: 'hero' }],
      legendary: [{ w: 14, kind: 'gems', min: 40, max: 60 }, { w: 14, kind: 'box', box: 'mega' }, { w: 27, kind: 'skin' }, { w: 45, kind: 'hero' }],
    } as Record<DropRarity, DropLoot[]>,
    /** Если подходящего героя или скина нет (всё уже есть) — кристаллы. */
    fallbackGems: { rare: 4, superrare: 8, epic: 15, mythic: 30, legendary: 60 } as Record<DropRarity, number>,
  },
  /** Магазин кристаллов: выглядит как донат, но всё за игровую валюту или бесплатно. */
  gemShop: [
    { id: 'gift', title: 'Подарок дня', gems: 5, price: null as null | { currency: Currency; amount: number }, daily: true, art: 1 },
    { id: 'handful', title: 'Горсть', gems: 10, price: { currency: 'coins' as Currency, amount: 250 }, daily: false, art: 1 },
    { id: 'bag', title: 'Мешок', gems: 30, price: { currency: 'coins' as Currency, amount: 650 }, daily: false, art: 3 },
    { id: 'chest', title: 'Сундук', gems: 80, price: { currency: 'coins' as Currency, amount: 1600 }, daily: false, art: 5 },
  ],
  /** Обмен блингов на монеты (когда всё куплено). */
  /** Эмоции-значки за блинги. Первые четыре — бесплатные. */
  emotes: [0, 0, 0, 0, 40, 40, 60, 60, 60, 80, 80, 100],
  /** Награды за вход 7 дней подряд. */
  login: [
    { kind: 'coins', amount: 50 }, { kind: 'gems', amount: 5 }, { kind: 'box', box: 'common' }, { kind: 'bling', amount: 30 },
    { kind: 'coins', amount: 100 }, { kind: 'gems', amount: 10 }, { kind: 'box', box: 'big' },
  ] as Reward[],
  /** Подарок новичку после обучения. */
  starterGift: [{ kind: 'coins', amount: 150 }, { kind: 'gems', amount: 20 }, { kind: 'bling', amount: 30 }] as Reward[],
  /** Задания: 3 в день, обновляются в полночь. */
  questReward: { xp: 100 },
};

/** Одна строка таблицы Старр-дропа. */
export type DropLoot =
  | { w: number; kind: 'coins' | 'gems' | 'bling'; min: number; max: number }
  | { w: number; kind: 'box'; box: BoxKind }
  | { w: number; kind: 'skin' | 'hero' };

/** Дорога трофеев (по общему числу трофеев). */
export const TROPHY_ROAD: { at: number; reward: Reward | { kind: 'future'; text: string } }[] = [
  { at: 10, reward: { kind: 'coins', amount: 50 } },
  { at: 25, reward: { kind: 'box', box: 'common' } },
  { at: 40, reward: { kind: 'hero', heroId: 'bacteria' } },
  { at: 50, reward: { kind: 'gems', amount: 20 } },
  { at: 75, reward: { kind: 'bling', amount: 60 } },
  { at: 100, reward: { kind: 'box', box: 'big' } },
  { at: 150, reward: { kind: 'coins', amount: 150 } },
  { at: 200, reward: { kind: 'gems', amount: 30 } },
  { at: 250, reward: { kind: 'hero', heroId: 'miner' } },
  { at: 300, reward: { kind: 'skin', heroId: 'bacteria', skinId: 'rainbow' } },
  { at: 400, reward: { kind: 'box', box: 'mega' } },
  { at: 500, reward: { kind: 'gems', amount: 50 } },
  { at: 600, reward: { kind: 'hero', heroId: 'lion' } },
  { at: 750, reward: { kind: 'coins', amount: 300 } },
  { at: 900, reward: { kind: 'bling', amount: 150 } },
  { at: 1000, reward: { kind: 'box', box: 'mega' } },
  { at: 1100, reward: { kind: 'hero', heroId: 'stoptime' } },
  { at: 1250, reward: { kind: 'gems', amount: 80 } },
  { at: 1500, reward: { kind: 'box', box: 'mega' } },
];

/** Спортивные скины пропуска: каждый сезон баскетбол, футбол и бейсбол достаются разным героям по кругу. */
const PASS_SPORT_HEROES = ['smile', 'bacteria', 'lion', 'stoptime', 'miner'];
export function passSportSkins(season: number): { basketball: Reward; football: Reward; baseball: Reward } {
  const H = PASS_SPORT_HEROES, n = Math.max(0, season - 1);
  return {
    basketball: { kind: 'skin', heroId: H[n % H.length], skinId: 'basketball' },
    football: { kind: 'skin', heroId: H[(n + 1) % H.length], skinId: 'football' },
    baseball: { kind: 'skin', heroId: H[(n + 2) % H.length], skinId: 'baseball' },
  };
}

/** Награды боевого пропуска по уровням (бесплатная и премиум линии). */
export function passRewards(season: number): { free: Reward[]; premium: Reward[] } {
  const free: Reward[] = [], premium: Reward[] = [];
  const sport = passSportSkins(season);
  for (let t = 1; t <= ECONOMY.pass.tiers; t++) {
    // бесплатная линия: на 15 уровне — спортивный скин
    if (t === 15) free.push(sport.football);
    else if (t % 10 === 0) free.push({ kind: 'box', box: 'big' });
    else if (t % 5 === 0) free.push({ kind: 'gems', amount: 10 });
    else if (t % 3 === 0) free.push({ kind: 'bling', amount: 20 });
    else if (t % 4 === 0) free.push({ kind: 'box', box: 'common' });
    else free.push({ kind: 'coins', amount: 30 + t * 2 });
    // премиум линия: на 8 и 22 уровнях — спортивные скины, в конце — эксклюзив
    if (t === ECONOMY.pass.tiers) premium.push(season % 2 === 1 ? { kind: 'skin', heroId: 'smile', skinId: 'gold' } : { kind: 'skin', heroId: 'bacteria', skinId: 'neon' });
    else if (t === 8) premium.push(sport.basketball);
    else if (t === 22) premium.push(sport.baseball);
    else if (t % 10 === 0) premium.push({ kind: 'box', box: 'mega' });
    else if (t % 5 === 0) premium.push({ kind: 'gems', amount: 25 });
    else if (t % 2 === 0) premium.push({ kind: 'bling', amount: 30 });
    else premium.push({ kind: 'coins', amount: 60 + t * 3 });
  }
  return { free, premium };
}

/** Шаблоны ежедневных заданий. */
export interface QuestTemplate {
  id: string;
  text: (n: number, hero: string) => string;
  amounts: number[];
  hero?: boolean;
  mode?: ModeId;
  reward: Reward;
}
export const QUESTS: QuestTemplate[] = [
  { id: 'win', text: (n) => `Победи ${n} раза`, amounts: [2, 3, 4], reward: { kind: 'coins', amount: 40 } },
  { id: 'damage', text: (n, h) => `Нанеси ${n.toLocaleString('ru-RU')} урона ${h}`, amounts: [8000, 10000, 15000], hero: true, reward: { kind: 'coins', amount: 30 } },
  { id: 'gems', text: (n) => `Собери ${n} кристаллов в Захвате`, amounts: [10, 15, 20], mode: 'gemgrab', reward: { kind: 'gems', amount: 3 } },
  { id: 'kills', text: (n) => `Выбей ${n} роботов`, amounts: [5, 8, 12], reward: { kind: 'coins', amount: 30 } },
  { id: 'supers', text: (n) => `Используй супер ${n} раз`, amounts: [4, 6, 8], reward: { kind: 'bling', amount: 15 } },
  { id: 'play_showdown', text: (n) => `Сыграй ${n} раза в Выживание`, amounts: [2, 3], mode: 'showdown', reward: { kind: 'coins', amount: 30 } },
  { id: 'play_knockout', text: (n) => `Сыграй ${n} раза в Нокаут`, amounts: [2, 3], mode: 'knockout', reward: { kind: 'coins', amount: 30 } },
  { id: 'cubes', text: (n) => `Собери ${n} кубов силы`, amounts: [5, 8], mode: 'showdown', reward: { kind: 'gems', amount: 3 } },
  { id: 'top4', text: (n) => `Займи место в четвёрке лучших ${n} раза`, amounts: [1, 2], mode: 'showdown', reward: { kind: 'bling', amount: 15 } },
];

/** Ежедневная акция в магазине (меняется каждый день). */
export const DAILY_DEALS: { id: string; title: string; reward: Reward; price: { currency: Currency; amount: number }; old?: number }[] = [
  { id: 'coins200', title: '200 монет', reward: { kind: 'coins', amount: 200 }, price: { currency: 'gems', amount: 15 }, old: 25 },
  { id: 'big', title: 'Большой ящик', reward: { kind: 'box', box: 'big' }, price: { currency: 'gems', amount: 20 }, old: 30 },
  { id: 'bling100', title: '100 блингов', reward: { kind: 'bling', amount: 100 }, price: { currency: 'coins', amount: 300 }, old: 450 },
  { id: 'mega', title: 'Мега-ящик', reward: { kind: 'box', box: 'mega' }, price: { currency: 'gems', amount: 60 }, old: 80 },
  { id: 'common2', title: 'Обычный ящик', reward: { kind: 'box', box: 'common' }, price: { currency: 'coins', amount: 60 }, old: 100 },
  { id: 'gems15', title: '15 кристаллов', reward: { kind: 'gems', amount: 15 }, price: { currency: 'coins', amount: 300 }, old: 375 },
];

/** Аватары-значки «icon:глиф:фон». Ещё можно поставить портрет любого открытого героя («hero:id»). */
export const AVATARS = [
  'icon:e_happy:#ffd23a', 'icon:e_cool:#44c4ff', 'icon:robot:#8d5bff', 'icon:meteor:#2b1f5a', 'icon:infect:#c6ff3a', 'icon:coin:#fffaf0',
  'icon:shard:#5ef0c8', 'icon:trophy:#44c4ff', 'icon:bling:#ff6fb5', 'icon:cube:#2b1f5a', 'icon:super:#14121f', 'icon:e_fire:#ffd23a',
  'icon:e_party:#c6ff3a', 'icon:star:#ff8a2a', 'icon:gem:#2b1f5a', 'icon:e_strong:#ff6fb5',
];
/** Старые аватары-эмодзи (до 1.4.0) — в том же порядке, что и новые значки. */
export const LEGACY_AVATARS = ['😀', '😎', '🤖', '👾', '🦠', '🐱', '🐶', '🦊', '🐸', '🐼', '🦄', '🐲', '⚽', '🚀', '👑', '🍕'];

/** Эмоции-стикеры в бою: глиф и подпись. Номер эмоции — её место в списке (так она хранится в сохранении). */
export const EMOTES: { icon: string; name: string }[] = [
  { icon: 'e_happy', name: 'Привет!' }, { icon: 'e_like', name: 'Класс!' }, { icon: 'e_sad', name: 'Эх…' }, { icon: 'e_angry', name: 'Грр!' },
  { icon: 'e_cool', name: 'Круто' }, { icon: 'e_lol', name: 'Хи-хи' }, { icon: 'e_party', name: 'Ура!' }, { icon: 'e_robot', name: 'Бип-буп' },
  { icon: 'e_fire', name: 'Огонь' }, { icon: 'e_strong', name: 'Силач' }, { icon: 'e_germ', name: 'Чих!' }, { icon: 'e_star', name: 'Звезда' },
];
