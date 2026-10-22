// Матч: мир + правила режима + мозги роботов. Один и тот же код работает в одиночной игре и у хоста.
import { BotBrain } from '../bots/ai';
import { mapById, parseMap } from '../maps';
import { createMode } from '../modes';
import type { ModeRules } from '../modes/types';
import type { Fighter, FighterInput, MatchConfig, MatchResult, SimEvent } from './types';
import { emptyInput } from './types';
import { World } from './world';

export class Match {
  world: World;
  rules: ModeRules;
  brains = new Map<number, BotBrain>();
  /** События с прошлого чтения (для рендера, звука и сети). */
  private eventLog: SimEvent[] = [];
  result: MatchResult | null = null;

  constructor(public cfg: MatchConfig) {
    const map = parseMap(mapById(cfg.mapId));
    this.world = new World(map, cfg.seed);
    this.rules = createMode(cfg.mode);
    this.rules.setup(this);
    for (const f of this.world.fighters) if (f.isBot && !this.brains.has(f.id)) this.brains.set(f.id, new BotBrain(f, cfg.difficulty, cfg.seed));
    this.eventLog.push(...this.world.events);
    this.world.events = [];
  }

  get time() { return this.world.time; }

  fighterOf(owner: string): Fighter | undefined {
    return this.world.fighters.find((f) => f.owner === owner);
  }

  /** Живой игрок отключился — его место занимает робот. */
  replaceWithBot(owner: string) {
    const f = this.fighterOf(owner);
    if (!f || f.isBot) return;
    f.isBot = true;
    f.owner = '';
    f.name = f.name + ' 🤖';
    this.brains.set(f.id, new BotBrain(f, this.cfg.difficulty, this.cfg.seed));
  }

  step(humanInputs: Map<number, FighterInput>) {
    if (this.result) return;
    const w = this.world;
    const inputs = new Map<number, FighterInput>();
    const frozen = this.rules.frozen(this);
    if (!frozen) {
      for (const [id, inp] of humanInputs) inputs.set(id, inp);
      for (const [id, brain] of this.brains) {
        const f = brain.f;
        if (!f.isBot) continue;
        inputs.set(id, brain.update(w, this.rules.botGoal(this, f)));
      }
    } else {
      for (const f of w.fighters) inputs.set(f.id, emptyInput());
    }
    w.events = [];
    w.step(inputs);
    this.rules.tick(this);
    this.eventLog.push(...w.events);
    if (this.eventLog.length > 600) this.eventLog.splice(0, this.eventLog.length - 600);
    if (this.rules.result && !this.result) this.result = this.rules.result;
  }

  drainEvents(): SimEvent[] {
    const e = this.eventLog;
    this.eventLog = [];
    return e;
  }

  /** Звёздный игрок: больше всех сделал для победы. */
  starPlayer(winnerTeam: number | null): Fighter {
    const fs = this.world.fighters.filter((f) => !f.dummy);
    const pool = winnerTeam === null ? fs : fs.filter((f) => f.team === winnerTeam);
    const list = pool.length ? pool : fs;
    const score = (f: Fighter) => f.stats.kills * 3 + f.stats.damage / 1000 + f.stats.gems * 1.5 - f.stats.deaths * 0.5;
    return list.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
}
