// Выживание: каждый за себя (или командами, если играют друзья). Кубы силы и ядовитое облако с 0:40.
import type { BotGoal } from '../../bots/ai';
import { T } from '../../core/grid';
import { clamp, dist2 } from '../../core/math';
import { BATTLE, MODES } from '../../sim/rules';
import type { Fighter, MatchResult } from '../../sim/types';
import type { Match } from '../../sim/match';
import { levelMul } from '../../sim/world';
import { nearest, nearestEnemy, zoneGoal } from '../common';
import { emptyHud, type ModeHud, type ModeRules } from '../types';

const R = MODES.showdown;

export class Showdown implements ModeRules {
  id = 'showdown' as const;
  result: MatchResult | null = null;
  teamPlace: Record<number, number> = {};
  private teams: number[] = [];

  setup(m: Match) {
    const w = m.world;
    const spawns = [...w.map.blueSpawns, ...w.map.redSpawns];
    const cx = w.map.w / 2, cy = w.map.h / 2;
    this.teams = [...new Set(m.cfg.players.map((p) => p.team))];
    if (m.cfg.teamShowdown) {
      // команды по четвертям карты
      const quads: { x: number; y: number }[][] = [[], [], [], []];
      for (const s of spawns) quads[(s.x < cx ? 0 : 1) + (s.y < cy ? 0 : 2)].push(s);
      const order = w.rng.shuffle([3, 0, 1, 2].slice());
      const counters: Record<number, number> = {};
      for (const p of m.cfg.players) {
        const q = quads[order[this.teams.indexOf(p.team) % 4]];
        const i = (counters[p.team] = (counters[p.team] ?? -1) + 1);
        const s = q[i % q.length];
        w.addFighter(p, s.x, s.y);
      }
    } else {
      const sh = w.rng.shuffle(spawns.slice());
      m.cfg.players.forEach((p, i) => { const s = sh[i % sh.length]; w.addFighter(p, s.x, s.y); });
    }
    w.onPickup = (f, p) => {
      if (p.kind !== 'cube') return;
      f.cubes++;
      f.stats.cubes++;
      const add = f.baseHp * BATTLE.cubeBonus;
      f.maxHp += add; f.hp += add;
      f.dmgMul += levelMul(f.level) * BATTLE.cubeBonus;
    };
    w.onDeath = (f) => {
      const n = Math.max(1, f.cubes);
      for (let i = 0; i < n; i++) w.dropPickup('cube', f.x, f.y, 1);
      f.cubes = 0;
    };
  }

  aliveTeams(m: Match) {
    return this.teams.filter((t) => m.world.fighters.some((f) => f.alive && f.team === t));
  }

  tick(m: Match) {
    const w = m.world;
    if (this.result) return;
    const t = w.time;
    if (t > R.poisonStart) {
      const k = clamp((t - R.poisonStart) / R.poisonDuration, 0, 1) * R.poisonFinal;
      w.setZoneShrink(k, R.poisonDps * (1 + (t - R.poisonStart) / 40));
      if (Math.abs(t - R.poisonStart - w.dt) < w.dt) w.emit({ t: 'announce', text: 'Ядовитое облако приближается!', big: false });
    }
    const alive = this.aliveTeams(m);
    for (const team of this.teams) {
      if (this.teamPlace[team] === undefined && !alive.includes(team)) this.teamPlace[team] = alive.length + 1;
    }
    // команды, выбывшие одновременно, делят место
    if (alive.length <= 1) {
      if (alive.length === 1) this.teamPlace[alive[0]] = 1;
      this.finish(m, alive[0] ?? null);
      return;
    }
    // живые игроки выбыли — их матч закончен
    const humanTeams = new Set(w.fighters.filter((f) => !f.isBot || f.owner).map((f) => f.team));
    const humansOut = [...humanTeams].every((team) => this.teamPlace[team] !== undefined);
    if (humanTeams.size && humansOut) this.finish(m, null);
  }

  private finish(m: Match, winner: number | null) {
    const w = m.world;
    const star = winner !== null ? m.starPlayer(winner) : w.fighters.reduce((a, b) => (b.stats.kills > a.stats.kills ? b : a));
    this.result = { mode: 'showdown', winnerTeam: winner, teamPlace: { ...this.teamPlace }, starPlayerId: star.id, duration: w.time, reason: 'normal' };
  }

  frozen() { return !!this.result; }

  botGoal(m: Match, f: Fighter): BotGoal | null {
    const w = m.world;
    const z = zoneGoal(m, f);
    if (z) return z;
    // кубы рядом
    const cube = nearest(w.pickups.filter((p) => p.kind === 'cube'), f);
    if (cube && dist2(cube.x, cube.y, f.x, f.y) < 81) return { x: cube.x, y: cube.y, urgency: 0.6 };
    // ящики с кубами
    let best: { x: number; y: number } | null = null, bd = 144;
    for (const b of w.map.boxes) {
      if (w.map.get(b.x, b.y) !== T.Box) continue;
      const d = dist2(b.x + 0.5, b.y + 0.5, f.x, f.y);
      if (d < bd) { bd = d; best = { x: b.x + 0.5, y: b.y + 0.5 }; }
    }
    if (best) {
      const stand = w.map.nearestFree(best.x + (f.x - best.x) * 0.4, best.y + (f.y - best.y) * 0.4) ?? best;
      return { x: stand.x, y: stand.y, urgency: 0.4, shootAt: best };
    }
    const e = nearestEnemy(m, f);
    if (e && f.hp / f.maxHp > 0.55) return { x: e.x, y: e.y, urgency: 0.3 };
    const cx = w.map.w / 2, cy = w.map.h / 2;
    const p = w.map.nearestFree(cx + (f.x - cx) * 0.6, cy + (f.y - cy) * 0.6) ?? { x: cx, y: cy };
    return { x: p.x, y: p.y, urgency: 0.2 };
  }

  hud(m: Match): ModeHud {
    const h = emptyHud();
    const t = m.world.time;
    h.timer = t < R.poisonStart ? R.poisonStart - t : 0;
    h.alive = m.cfg.teamShowdown ? this.aliveTeams(m).length : m.world.fighters.filter((f) => f.alive).length;
    return h;
  }
}
