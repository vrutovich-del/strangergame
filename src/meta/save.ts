// Сохранение на устройстве (localStorage) с номером версии схемы и миграциями.
// Экспорт/импорт — коротким кодом, чтобы перенести прогресс на другое устройство.
import type { ModeId } from '../maps/types';
import { ECONOMY } from './economy';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'igra-strannostey-save';

export interface HeroProgress {
  level: number;
  trophies: number;
  best: number;
  skin: string;
  played: number;
  wins: number;
}

export interface QuestState {
  id: string;
  /** Для заданий с героем. */
  hero: string;
  target: number;
  progress: number;
  claimed: boolean;
}

export type Difficulty = 'auto' | 'easy' | 'normal' | 'hard';

export interface Settings {
  sfx: number;
  music: number;
  vibration: boolean;
  quality: 'auto' | 'low' | 'high';
  hints: boolean;
  difficulty: Difficulty;
}

export interface SaveData {
  v: number;
  nick: string;
  avatar: string;
  createdAt: number;
  tutorialDone: boolean;
  giftBoxGiven: boolean;
  coins: number;
  gems: number;
  bling: number;
  heroes: Record<string, HeroProgress>;
  /** Купленные скины: «герой:скин». */
  skins: string[];
  emotes: number[];
  bestTrophies: number;
  road: { claimed: number[] };
  pass: { season: number; xp: number; premium: boolean; free: number[]; prem: number[] };
  quests: { day: string; list: QuestState[] };
  login: { lastDay: string; next: number; claimedDay: string };
  shop: { day: string; gift: boolean; deal: boolean };
  firstWinDay: string;
  stats: { wins: Record<string, number>; games: Record<string, number>; kills: number; damage: number };
  settings: Settings;
  selectedHero: string;
  selectedMode: ModeId;
  lastVersion: string;
  /** Неоткрытые ящики (награды). */
  boxes: ('common' | 'big' | 'mega')[];
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    nick: '',
    avatar: '😀',
    createdAt: Date.now(),
    tutorialDone: false,
    giftBoxGiven: false,
    coins: ECONOMY.start.coins,
    gems: ECONOMY.start.gems,
    bling: ECONOMY.start.bling,
    heroes: {
      smile: { level: 1, trophies: 0, best: 0, skin: 'default', played: 0, wins: 0 },
      bacteria: { level: 1, trophies: 0, best: 0, skin: 'default', played: 0, wins: 0 },
    },
    skins: [],
    emotes: [0, 1, 2, 3],
    bestTrophies: 0,
    road: { claimed: [] },
    pass: { season: 0, xp: 0, premium: false, free: [], prem: [] },
    quests: { day: '', list: [] },
    login: { lastDay: '', next: 0, claimedDay: '' },
    shop: { day: '', gift: false, deal: false },
    firstWinDay: '',
    stats: { wins: {}, games: {}, kills: 0, damage: 0 },
    settings: { sfx: 0.8, music: 0.5, vibration: true, quality: 'auto', hints: true, difficulty: 'auto' },
    selectedHero: 'smile',
    selectedMode: 'gemgrab',
    lastVersion: '',
    boxes: [],
  };
}

/** Миграции: из версии N в N+1. Добавляйте новые в конец, старые не трогайте. */
export const MIGRATIONS: Record<number, (d: any) => any> = {
  // v0 → v1: самые первые сохранения без номера версии хранили валюту в объекте wallet
  0: (d) => {
    const w = d.wallet ?? {};
    const out = { ...d, v: 1, coins: d.coins ?? w.coins ?? 0, gems: d.gems ?? w.gems ?? 0, bling: d.bling ?? w.bling ?? 0 };
    delete out.wallet;
    return out;
  },
  // v1 → v2: появились неоткрытые ящики и настройка сложности роботов
  1: (d) => ({ ...d, v: 2, boxes: d.boxes ?? [], settings: { ...d.settings, difficulty: d.settings?.difficulty ?? 'auto' } }),
};

/** Привести любые сохранённые данные к текущей схеме. */
export function migrate(raw: any): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let d = { ...raw };
  let v = typeof d.v === 'number' ? d.v : 0;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) break;
    d = m(d);
    v = d.v;
  }
  // дополняем недостающие поля значениями по умолчанию
  const def = defaultSave();
  const merged: SaveData = { ...def, ...d, v: SAVE_VERSION };
  merged.heroes = { ...def.heroes, ...(d.heroes ?? {}) };
  for (const k of Object.keys(def.heroes)) merged.heroes[k] = { ...def.heroes[k], ...merged.heroes[k] };
  merged.settings = { ...def.settings, ...(d.settings ?? {}) };
  merged.stats = { ...def.stats, ...(d.stats ?? {}) };
  merged.pass = { ...def.pass, ...(d.pass ?? {}) };
  merged.login = { ...def.login, ...(d.login ?? {}) };
  merged.shop = { ...def.shop, ...(d.shop ?? {}) };
  merged.road = { ...def.road, ...(d.road ?? {}) };
  merged.quests = { ...def.quests, ...(d.quests ?? {}) };
  if (!Array.isArray(merged.emotes) || !merged.emotes.length) merged.emotes = def.emotes;
  return merged;
}

export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export function loadSave(storage: Storage | null = safeStorage()): SaveData {
  try {
    const s = storage?.getItem(SAVE_KEY);
    if (!s) return defaultSave();
    return migrate(JSON.parse(s));
  } catch {
    return defaultSave();
  }
}

export function writeSave(d: SaveData, storage: Storage | null = safeStorage()) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* память переполнена или запрещена */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

// ── экспорт / импорт кодом ──
function checksum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const toB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

export function exportCode(d: SaveData): string {
  const json = JSON.stringify(d);
  return 'IS1.' + toB64(json) + '.' + checksum(json);
}

export function importCode(code: string): SaveData | null {
  try {
    const clean = code.trim().replace(/\s+/g, '');
    const [tag, body, sum] = clean.split('.');
    if (tag !== 'IS1' || !body) return null;
    const json = fromB64(body);
    if (sum && checksum(json) !== sum) return null;
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}
