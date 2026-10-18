// Захват кристаллов 3×3: кристалл из шахты каждые 7 секунд, 10+ и больше соперника — отсчёт 15 секунд.
import type { BotGoal } from '../../bots/ai';
import { dist2 } from '../../core/math';
import { MODES } from '../../sim/rules';
import type { Fighter, MatchResult } from '../../sim/types';
import type { Match } from '../../sim/match';
import { homeOf, nearest, nearestEnemy, spawnTeams } from '../common';
import { emptyHud, type ModeHud, type ModeRules } from '../types';

const R = MODES.gemgrab;

export class GemGrab implements ModeRules {
  id = 'gemgrab' as const;
  result: MatchResult | null = null;
  private nextGemAt = 4;
  private countdownTeam = -1;
  private countdownEnds = 0;
  private lastAnnounce = '';

  setup(m: Match) {
    spawnTeams(m);
    const w = m.world;
    w.onPickup = (f, p) => {
      if (p.kind === 'gem') { f.gems++; f.stats.gems++; }
    };
    w.onDeath = (f) => {
      // погибший роняет все кристаллы
      for (let i = 0; i < f.gems; i++) w.dropPickup('gem', f.x, f.y, 1);
      f.gems = 0;
      f.respawnAt = w.time + R.respawn;
    };
  }

  teamGems(m: Match): [number, number] {
    const s: [number, number] = [0, 0];
    for (const f of m.world.fighters) if (f.alive && (f.team === 0 || f.team === 1)) s[f.team] += f.gems;
    return s;
  }

  tick(m: Match) {
    const w = m.world;
    if (this.result) return;
    // кристалл из шахты
    if (w.time >= this.nextGemAt) {
      this.nextGemAt += R.gemEvery;
      for (const mine of w.map.mines) {
        w.dropPickup('gem', mine.x, mine.y, 1);
        w.emit({ t: 'gem', x: mine.x, y: mine.y });
      }
    }
    // воскрешение на базе
    for (const f of w.fighters) {
      if (!f.alive && f.respawnAt > 0 && w.time >= f.respawnAt) {
        f.respawnAt = 0;
        const sp = f.team === 0 ? w.map.blueSpawns : w.map.redSpawns;
        const s = sp[Math.floor(w.rng.next() * sp.length)];
        w.respawn(f, s.x, s.y);
      }
    }
    // обратный отсчёт
    const [b, r] = this.teamGems(m);
    const leader = b >= R.gemsToWin && b > r ? 0 : r >= R.gemsToWin && r > b ? 1 : -1;
    if (leader !== this.countdownTeam) {
      if (leader >= 0) {
        this.countdownEnds = w.time + R.countdown;
        this.announce(m, leader === 0 ? 'СИНИЕ ведут!' : 'КРАСНЫЕ ведут!');
      } else if (this.countdownTeam >= 0) this.announce(m, 'Отсчёт сброшен!');
      this.countdownTeam = leader;
    }
    if (this.countdownTeam >= 0 && w.time >= this.countdownEnds) this.finish(m, this.countdownTeam);
    else if (w.time >= R.timeLimit) this.finish(m, b > r ? 0 : r > b ? 1 : null);
  }

  private announce(m: Match, text: string) {
    if (text === this.lastAnnounce) return;
    this.lastAnnounce = text;
    m.world.emit({ t: 'announce', text, big: false });
  }

  private finish(m: Match, winner: number | null) {
    const star = m.starPlayer(winner);
    const [b, r] = this.teamGems(m);
    this.result = { mode: 'gemgrab', winnerTeam: winner, starPlayerId: star.id, duration: m.world.time, reason: 'normal', score: { 0: b, 1: r } };
  }

  frozen() { return !!this.result; }

  botGoal(m: Match, f: Fighter): BotGoal | null {
    const w = m.world;
    if (w.time < f.infectedUntil) {
      const e = nearestEnemy(m, f);
      return e ? { x: e.x, y: e.y, urgency: 0.3 } : null;
    }
    const mine = w.map.mines[0] ?? { x: w.map.w / 2, y: w.map.h / 2 };
    const [b, r] = this.teamGems(m);
    const my = f.team === 0 ? b : r, their = f.team === 0 ? r : b;
    const home = homeOf(m, f);
    // носитель кристаллов отступает, когда команда ведёт
    if (f.gems >= 4 || (f.gems >= 2 && my >= R.gemsToWin - 1 && my > their)) {
      return { x: home.x, y: home.y, urgency: 0.6, careful: true };
    }
    // соперники ведут — надо отбивать кристаллы
    if (this.countdownTeam >= 0 && this.countdownTeam !== f.team) {
      const carrier = w.fighters.filter((o) => o.alive && o.team !== f.team && o.gems > 0).sort((a, c) => c.gems - a.gems)[0];
      if (carrier) return { x: carrier.x, y: carrier.y, urgency: 0.8 };
    }
    // рассыпанные кристаллы
    const gems = w.pickups.filter((p) => p.kind === 'gem');
    const g = nearest(gems, f);
    if (g && dist2(g.x, g.y, f.x, f.y) < 64) return { x: g.x, y: g.y, urgency: 0.5 };
    // держим шахту: снайпер чуть позади, танк впереди
    const def = f.heroId;
    const back = def === 'robo_sniper' ? 4.5 : def === 'robo_tank' ? 0.5 : 2.2;
    const dir = f.team === 0 ? 1 : -1;
    const side = ((f.id % 3) - 1) * 2.5;
    const p = w.map.nearestFree(mine.x + side, mine.y + dir * back) ?? mine;
    if (g) return { x: g.x, y: g.y, urgency: 0.4 };
    return { x: p.x, y: p.y, urgency: 0.3 };
  }

  hud(m: Match): ModeHud {
    const h = emptyHud();
    h.timer = Math.max(0, R.timeLimit - m.world.time);
    h.score = this.teamGems(m);
    h.countdownTeam = this.countdownTeam;
    h.countdown = this.countdownTeam >= 0 ? Math.max(0, this.countdownEnds - m.world.time) : 0;
    return h;
  }
}
