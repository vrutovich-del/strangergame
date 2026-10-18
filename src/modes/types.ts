import type { BotGoal } from '../bots/ai';
import type { ModeId } from '../maps/types';
import type { Fighter, MatchResult } from '../sim/types';
import type { Match } from '../sim/match';

/** Состояние режима для HUD (оно же уходит по сети клиентам). */
export interface ModeHud {
  /** Секунд до конца (или прошло), −1 — без таймера. */
  timer: number;
  /** Кристаллы или победы раундов: [синие, красные]. */
  score: [number, number];
  /** Обратный отсчёт до победы в Захвате кристаллов. */
  countdown: number;
  countdownTeam: number;
  /** Сколько бойцов (команд) ещё в игре — для Выживания. */
  alive: number;
  round: number;
  /** Крупная надпись в центре экрана. */
  banner: string;
  /** Урон в секунду и всего (полигон). */
  dps: number;
  total: number;
  /** Подсказка обучения и точка-цель. */
  tip: string;
  markX: number;
  markY: number;
}

export const emptyHud = (): ModeHud => ({
  timer: -1, score: [0, 0], countdown: 0, countdownTeam: -1, alive: 0, round: 0, banner: '', dps: 0, total: 0, tip: '', markX: -1, markY: -1,
});

export interface ModeRules {
  id: ModeId;
  /** Расставить бойцов, повесить обработчики. */
  setup(m: Match): void;
  /** Вызывается после каждого тика мира. */
  tick(m: Match): void;
  /** Цель для робота. */
  botGoal(m: Match, f: Fighter): BotGoal | null;
  hud(m: Match): ModeHud;
  /** Можно ли сейчас управлять бойцами (между раундами — нет). */
  frozen(m: Match): boolean;
  result: MatchResult | null;
}
