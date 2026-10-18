// Типы симуляции боя. Симуляция ничего не знает о Three.js и DOM.
import type { ModeId } from '../maps/types';

/** Ввод бойца за один тик. Его шлют клиенты по сети и выдают боты. */
export interface FighterInput {
  /** Движение, −1…1 по каждой оси (x вправо, y вниз по карте). */
  mx: number;
  my: number;
  /** Угол ручного прицела (радианы, 0 = вправо, π/2 = вниз по карте). */
  aim: number;
  /** 0 — не стрелять, 1 — выстрел в сторону aim, 2 — выстрел с автоприцелом. */
  attack: 0 | 1 | 2;
  /** 0 — нет, 1 — супер в сторону aim, 2 — супер с автоприцелом. */
  superAttack: 0 | 1 | 2;
  /** Номер эмоции или −1. */
  emote: number;
  /** Порядковый номер ввода (для предсказания движения в сети). */
  seq: number;
}

export const emptyInput = (): FighterInput => ({ mx: 0, my: 0, aim: 0, attack: 0, superAttack: 0, emote: -1, seq: 0 });

export type AimShape = 'line' | 'cone' | 'melee' | 'dash' | 'beam' | 'throw';
/** Как рисовать прицел. */
export interface AimInfo {
  shape: AimShape;
  range: number;
  /** Ширина линии (плитки) или угол конуса (радианы). */
  width: number;
}

export interface HeroStats {
  hp: number;
  /** Скорость, плиток в секунду (нормальная ≈ 2,4). */
  speed: number;
  /** Перезарядка одного патрона, секунд. */
  reload: number;
  /** Сколько супера даёт одно попадание обычной атакой (0…1). */
  superPerHit: number;
  /** Пауза после атаки, когда нельзя стрелять снова (секунд). */
  attackCooldown: number;
  /** Урон одного снаряда обычной атаки (для карточки и баланса). */
  damage: number;
  /** Урон супера (для карточки). */
  superDamage: number;
  radius?: number;
}

/** Описание героя (или робота) для симуляции. Рендер описан отдельно в view.ts героя. */
export interface HeroDef {
  id: string;
  name: string;
  /** Роль одной строкой: «Стрелок средней дальности». */
  role: string;
  description: string;
  /** Можно ли выбрать игроку. Роботы — только для ботов. */
  playable: boolean;
  /** Порядок в списке героев. */
  order: number;
  /** Цвет темы в интерфейсе. */
  color: string;
  stats: HeroStats;
  attackName: string;
  attackDesc: string;
  superName: string;
  superDesc: string;
  attackAim: AimInfo;
  superAim: AimInfo;
  /** Подсказки для ИИ: желаемая дистанция боя. */
  ai: { range: number; style: 'ranged' | 'melee' | 'sniper' | 'shotgun' };
  attack(w: WorldApi, f: Fighter, angle: number): void;
  superAttack(w: WorldApi, f: Fighter, angle: number): void;
  onProjectileHit?(w: WorldApi, p: Projectile, target: Fighter | Minion | null): void;
  updateMinion?(w: WorldApi, m: Minion): void;
}

export interface FighterStats {
  damage: number;
  kills: number;
  deaths: number;
  gems: number;
  supers: number;
  hits: number;
}

export interface Fighter {
  id: number;
  heroId: string;
  skinId: string;
  name: string;
  level: number;
  /** Родная команда. */
  team: number;
  /** Пока заражён — воюет за эту команду. */
  infectTeam: number;
  infectedUntil: number;
  infectedBy: number;
  isBot: boolean;
  /** Сетевой ID живого игрока (или 'local'). */
  owner: string;
  /** Робот-мишень на полигоне: 'static' | 'move' | 'shoot'. */
  dummy?: 'static' | 'move' | 'shoot';
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  facing: number;
  moving: boolean;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  baseHp: number;
  dmgMul: number;
  ammo: number;
  attackReadyAt: number;
  superCharge: number;
  alive: boolean;
  deadAt: number;
  respawnAt: number;
  lastHurt: number;
  lastShot: number;
  revealUntil: number;
  inBush: boolean;
  gems: number;
  cubes: number;
  dash: null | { vx: number; vy: number; until: number; hit: number[]; damage: number; knock: number };
  knock: null | { vx: number; vy: number; until: number };
  emote: number;
  emoteUntil: number;
  /** Моменты событий для анимаций. */
  shotAt: number;
  superAt: number;
  hurtAt: number;
  spawnX: number;
  spawnY: number;
  stats: FighterStats;
}

export interface Projectile {
  id: number;
  ownerId: number;
  heroId: string;
  team: number;
  /** Вид снаряда для рендера. */
  kind: string;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  travelled: number;
  range: number;
  pierce: boolean;
  hitIds: number[];
  isSuper: boolean;
  superPerHit: number;
  breaksCrates: boolean;
  effect: string;
  alive: boolean;
}

export interface Minion {
  id: number;
  ownerId: number;
  heroId: string;
  kind: string;
  team: number;
  x: number;
  y: number;
  px: number;
  py: number;
  facing: number;
  hp: number;
  maxHp: number;
  bornAt: number;
  expiresAt: number;
  targetId: number;
  fireAt: number;
  slot: number;
  damage: number;
  range: number;
  alive: boolean;
  shotAt: number;
  hurtAt: number;
}

export interface Pickup {
  id: number;
  kind: 'gem' | 'cube';
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  bornAt: number;
  alive: boolean;
}

/** Безопасная зона (всё снаружи — ядовитое облако). */
export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  active: boolean;
  dps: number;
}

export type SimEvent =
  | { t: 'shot'; id: number; heroId: string; sup: boolean; x: number; y: number; a: number }
  | { t: 'hit'; id: number; by: number; amount: number; x: number; y: number; sup: boolean }
  | { t: 'death'; id: number; by: number; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'impact'; x: number; y: number; kind: string }
  | { t: 'tile'; tx: number; ty: number; to: number }
  | { t: 'pickup'; id: number; kind: 'gem' | 'cube'; x: number; y: number }
  | { t: 'infect'; id: number; by: number }
  | { t: 'cure'; id: number }
  | { t: 'minion'; id: number; on: boolean; x: number; y: number }
  | { t: 'emote'; id: number; e: number }
  | { t: 'gem'; x: number; y: number }
  | { t: 'ready'; id: number }
  | { t: 'dash'; id: number }
  | { t: 'beam'; x: number; y: number; x2: number; y2: number; team: number }
  | { t: 'announce'; text: string; big: boolean }
  | { t: 'mhit'; id: number; amount: number; x: number; y: number };

export interface ShotOptions {
  angle: number;
  speed: number;
  range: number;
  damage: number;
  radius?: number;
  kind: string;
  pierce?: boolean;
  isSuper?: boolean;
  /** Сколько супера даёт попадание (0 — не заряжает). */
  superPerHit?: number;
  breaksCrates?: boolean;
  effect?: string;
  /** Смещение точки вылета вперёд (плитки). */
  offset?: number;
  /** Смещение вбок (плитки). */
  side?: number;
}

/** То, что герои могут делать с миром (их атаки и суперы). */
export interface WorldApi {
  time: number;
  dt: number;
  rng: { next(): number; range(a: number, b: number): number };
  fighters: Fighter[];
  minions: Minion[];
  map: import('../core/grid').GridMap;
  effTeam(f: Fighter): number;
  isVisibleTo(f: Fighter, team: number): boolean;
  spawnProjectile(owner: Fighter | Minion, o: ShotOptions): Projectile;
  spawnMinion(owner: Fighter, kind: string, x: number, y: number, hp: number, life: number, damage: number, range: number, slot: number): Minion;
  schedule(delay: number, fn: () => void): void;
  damage(target: Fighter | Minion, amount: number, byId: number, sup: boolean, superPerHit: number): void;
  damageTile(tx: number, ty: number, amount: number, sup: boolean): void;
  infect(target: Fighter, by: Fighter, duration: number): void;
  emit(e: SimEvent): void;
  findById(id: number): Fighter | undefined;
  minionById(id: number): Minion | undefined;
  enemiesOf(team: number): Fighter[];
}

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Участник матча. */
export interface PlayerSlot {
  name: string;
  heroId: string;
  skinId: string;
  level: number;
  team: number;
  isBot: boolean;
  /** 'local' для своего игрока, ID пира для друга, '' для бота. */
  owner: string;
  dummy?: 'static' | 'move' | 'shoot';
}

export interface MatchConfig {
  mode: ModeId;
  mapId: string;
  seed: number;
  players: PlayerSlot[];
  difficulty: Difficulty;
  /** Командное выживание (с друзьями). */
  teamShowdown?: boolean;
  tutorial?: boolean;
}

export interface MatchResult {
  mode: ModeId;
  /** Команда-победитель (null — ничья). */
  winnerTeam: number | null;
  /** Место каждой команды в Выживании (команда → место). */
  teamPlace?: Record<number, number>;
  starPlayerId: number;
  duration: number;
  reason: 'normal' | 'host_left' | 'quit';
  /** Счёт (кристаллы по командам или раунды). */
  score?: Record<number, number>;
}
