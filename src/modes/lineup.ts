// Состав матча: живые игроки + роботы, которые заполняют пустые места.
import { COMBAT_ROBOTS, ROBOT_NAMES } from '../bots/robots';
import { Rng } from '../core/rng';
import { mapsForMode } from '../maps';
import type { ModeId } from '../maps/types';
import type { Difficulty, MatchConfig, PlayerSlot } from '../sim/types';

export interface HumanEntry {
  name: string;
  heroId: string;
  skinId: string;
  level: number;
  owner: string;
}

export function buildLineup(o: { mode: ModeId; humans: HumanEntry[]; difficulty: Difficulty; seed: number; mapId?: string; tutorial?: boolean }): MatchConfig {
  const rng = new Rng(o.seed ^ 0x9e3779b9);
  const names = rng.shuffle(ROBOT_NAMES.slice());
  let nameI = 0;
  const avgLevel = Math.round(o.humans.reduce((a, h) => a + h.level, 0) / Math.max(1, o.humans.length)) || 1;
  const lvlShift = o.difficulty === 'easy' ? -1 : o.difficulty === 'hard' ? 1 : 0;
  const robotTypes = rng.shuffle(COMBAT_ROBOTS.slice());
  let typeI = 0;
  const robot = (team: number): PlayerSlot => ({
    name: names[nameI++ % names.length],
    heroId: robotTypes[typeI++ % robotTypes.length],
    skinId: 'default',
    level: Math.max(1, Math.min(9, avgLevel + lvlShift + (rng.chance(0.3) ? rng.int(-1, 0) : 0))),
    team,
    isBot: true,
    owner: '',
  });
  const human = (h: HumanEntry, team: number): PlayerSlot => ({ ...h, team, isBot: false });
  const players: PlayerSlot[] = [];
  let teamShowdown = false;
  if (o.mode === 'gemgrab' || o.mode === 'knockout') {
    o.humans.slice(0, 3).forEach((h) => players.push(human(h, 0)));
    while (players.length < 3) players.push(robot(0));
    typeI = rng.int(0, 2);
    for (let i = 0; i < 3; i++) players.push(robot(1));
  } else if (o.mode === 'showdown') {
    if (o.humans.length > 1) {
      teamShowdown = true;
      o.humans.slice(0, 3).forEach((h) => players.push(human(h, 0)));
      while (players.length < 3) players.push(robot(0));
      for (let t = 1; t <= 3; t++) for (let i = 0; i < 3; i++) players.push(robot(t));
    } else {
      players.push(human(o.humans[0], 0));
      for (let t = 1; t <= 9; t++) players.push(robot(t));
    }
  } else {
    players.push(human(o.humans[0], 0));
  }
  const maps = mapsForMode(o.mode);
  const mapId = o.mapId ?? maps[rng.int(0, maps.length - 1)].id;
  return { mode: o.mode, mapId, seed: o.seed, players, difficulty: o.difficulty, teamShowdown, tutorial: o.tutorial };
}
