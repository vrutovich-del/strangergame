// Сетевые сообщения и сжатые снимки состояния боя. Хост рассылает снимки, клиенты шлют ввод.
import type { ModeId } from '../maps/types';
import type { ModeHud } from '../modes/types';
import type { FighterInput, MatchConfig, MatchResult, SimEvent } from '../sim/types';
import type { World } from '../sim/world';

export const PROTOCOL_VERSION = 1;

export interface RoomPlayer {
  id: string;
  nick: string;
  hero: string;
  skin: string;
  level: number;
  ready: boolean;
  host: boolean;
}

export type LobbyMsg =
  | { t: 'hello'; v: number; nick: string; hero: string; skin: string; level: number }
  | { t: 'me'; hero: string; skin: string; level: number; ready: boolean }
  | { t: 'roster'; players: RoomPlayer[]; mode: ModeId }
  | { t: 'start'; cfg: MatchConfig }
  | { t: 'full' }
  | { t: 'old' }
  | { t: 'emote'; e: number };

export type GameMsg =
  | { t: 'in'; d: number[] }
  | { t: 'snap'; s: Snapshot }
  | { t: 'end'; res: MatchResult; stats: number[][] }
  | { t: 'ping'; c: number }
  | { t: 'pong'; c: number };

export type NetMsg = LobbyMsg | GameMsg;

// ───────────── ввод ─────────────
export function encodeInput(i: FighterInput): number[] {
  return [i.seq, Math.round(i.mx * 100), Math.round(i.my * 100), Math.round(i.aim * 1000), i.attack, i.superAttack, i.emote];
}
export function decodeInput(d: number[]): FighterInput {
  const c = (v: number) => Math.max(-1, Math.min(1, (v | 0) / 100));
  return {
    seq: d[0] | 0, mx: c(d[1]), my: c(d[2]), aim: (d[3] | 0) / 1000,
    attack: (d[4] === 1 || d[4] === 2 ? d[4] : 0) as 0 | 1 | 2, superAttack: (d[5] === 1 || d[5] === 2 ? d[5] : 0) as 0 | 1 | 2,
    emote: Number.isInteger(d[6]) && d[6] >= -1 && d[6] < 32 ? d[6] : -1,
  };
}

// ───────────── снимки ─────────────
const F_ALIVE = 1, F_MOVING = 2, F_BUSH = 4, F_HIDDEN = 8, F_DASH = 16;
const PK = ['gem', 'cube'] as const;

export interface Snapshot {
  /** Время хоста (мс). */
  tm: number;
  /** Последний обработанный номер ввода этого клиента. */
  ack: number;
  /** Бойцы: id, x, y, facing, hp, maxHp, ammo, super, флаги, кристаллы, кубы, заражение(мс), команда заражения,
   *  эмоция, эмоция(мс), выстрел(мс назад), супер(мс назад), урон(мс назад), смерть(мс назад), воскрешение(мс). */
  f: number[][];
  /** Снаряды: id, вид, x, y, угол, команда, хозяин. */
  p: (number | string)[][];
  /** Помощники: id, x, y, facing, hp, maxHp, слот, команда, хозяин, выстрел(мс назад), урон(мс назад), осталось(мс). */
  m: number[][];
  /** Предметы: id, вид, x, y, возраст(мс). */
  k: number[][];
  /** Зона [x0, y0, x1, y1] или пусто. */
  z: number[];
  h: ModeHud;
  /** События с прошлого снимка. */
  ev: SimEvent[];
  /** Описание бойцов (присылается при изменениях). */
  fi?: (string | number)[][];
}

const r2 = (v: number) => Math.round(v * 100);
const ms = (age: number) => Math.max(0, Math.min(600000, Math.round(age * 1000)));

/** Снять снимок мира для клиента. viewTeam — команда игроков (для видимости в кустах). */
export function makeSnapshot(w: World, ack: number, hud: ModeHud, events: SimEvent[], viewTeam: number, withInfo: boolean): Snapshot {
  const t = w.time;
  const f = w.fighters.map((x) => [
    x.id, r2(x.x), r2(x.y), Math.round(x.facing * 1000), Math.round(x.hp), Math.round(x.maxHp), r2(x.ammo), r2(x.superCharge),
    (x.alive ? F_ALIVE : 0) | (x.moving ? F_MOVING : 0) | (x.inBush ? F_BUSH : 0) | (x.alive && !w.isVisibleTo(x, viewTeam) ? F_HIDDEN : 0) | (x.dash || x.knock ? F_DASH : 0),
    x.gems, x.cubes, ms(Math.max(0, x.infectedUntil - t)), x.infectTeam, x.emote, ms(Math.max(0, x.emoteUntil - t)),
    ms(t - x.shotAt), ms(t - x.superAt), ms(t - x.hurtAt), ms(t - x.deadAt), ms(Math.max(0, x.respawnAt - t)),
  ]);
  const p = w.projectiles.map((x) => [x.id, x.kind, r2(x.x), r2(x.y), Math.round(x.angle * 1000), x.team, x.ownerId]);
  const m = w.minions.map((x) => [x.id, r2(x.x), r2(x.y), Math.round(x.facing * 1000), Math.round(x.hp), Math.round(x.maxHp), x.slot, x.team, x.ownerId, ms(t - x.shotAt), ms(t - x.hurtAt), ms(x.expiresAt - t)]);
  const k = w.pickups.map((x) => [x.id, PK.indexOf(x.kind), r2(x.x), r2(x.y), ms(t - x.bornAt)]);
  const z = w.zone && w.zone.active ? [r2(w.zone.x0), r2(w.zone.y0), r2(w.zone.x1), r2(w.zone.y1)] : [];
  const snap: Snapshot = { tm: Math.round(t * 1000), ack, f, p, m, k, z, h: hud, ev: events };
  if (withInfo) snap.fi = w.fighters.map((x) => [x.id, x.heroId, x.skinId, x.name, x.level, x.team, x.owner, x.isBot ? 1 : 0, x.dummy ?? '']);
  return snap;
}

export interface DecodedFighter {
  id: number; x: number; y: number; facing: number; hp: number; maxHp: number; ammo: number; superCharge: number;
  alive: boolean; moving: boolean; inBush: boolean; hidden: boolean; forced: boolean; gems: number; cubes: number;
  infectedFor: number; infectTeam: number; emote: number; emoteFor: number; shotAge: number; superAge: number; hurtAge: number; deadAge: number; respawnIn: number;
}

export function decodeFighter(a: number[]): DecodedFighter {
  return {
    id: a[0], x: a[1] / 100, y: a[2] / 100, facing: a[3] / 1000, hp: a[4], maxHp: a[5], ammo: a[6] / 100, superCharge: a[7] / 100,
    alive: !!(a[8] & F_ALIVE), moving: !!(a[8] & F_MOVING), inBush: !!(a[8] & F_BUSH), hidden: !!(a[8] & F_HIDDEN), forced: !!(a[8] & F_DASH),
    gems: a[9], cubes: a[10], infectedFor: a[11] / 1000, infectTeam: a[12], emote: a[13], emoteFor: a[14] / 1000,
    shotAge: a[15] / 1000, superAge: a[16] / 1000, hurtAge: a[17] / 1000, deadAge: a[18] / 1000, respawnIn: a[19] / 1000,
  };
}

export const pickupKind = (i: number) => PK[i] ?? 'gem';

/** Статистика бойцов для экрана результата (отправляется в конце боя). */
export function encodeStats(w: World): number[][] {
  return w.fighters.map((f) => [f.id, Math.round(f.stats.damage), f.stats.kills, f.stats.deaths, f.stats.gems, f.stats.supers, f.stats.cubes]);
}

/** Сериализация в строку и обратно (PeerJS шлёт JSON, но так удобнее проверять в тестах). */
export const pack = (m: NetMsg) => JSON.stringify(m);
export const unpack = (s: string): NetMsg | null => {
  try {
    const m = JSON.parse(s);
    return m && typeof m === 'object' && typeof m.t === 'string' ? m : null;
  } catch { return null; }
};
