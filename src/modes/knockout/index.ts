// Нокаут: 3×3, без воскрешений в раунде, до 2 побед. С 0:45 раунда облако надвигается с краёв.
import type { BotGoal } from '../../bots/ai';
import { clamp } from '../../core/math';
import { MODES } from '../../sim/rules';
import type { Fighter, MatchResult } from '../../sim/types';
import type { Match } from '../../sim/match';
import { nearestEnemy, spawnTeams, teamAlive, zoneGoal } from '../common';
import { emptyHud, type ModeHud, type ModeRules } from '../types';

const R = MODES.knockout;

export class Knockout implements ModeRules {
  id = 'knockout' as const;
  result: MatchResult | null = null;
  round = 1;
  wins: [number, number] = [0, 0];
  private phase: 'intro' | 'play' | 'roundEnd' = 'intro';
  private roundStart = 0;
  private pauseUntil = 0;
  private banner = '';

  setup(m: Match) {
    spawnTeams(m);
    this.banner = 'Раунд 1';
    this.pauseUntil = 1.5;
  }

  frozen() { return !!this.result || this.phase !== 'play'; }

  tick(m: Match) {
    const w = m.world;
    if (this.result) return;
    if (this.phase === 'intro') {
      if (w.time >= this.pauseUntil) { this.phase = 'play'; this.roundStart = w.time; this.banner = ''; }
      return;
    }
    if (this.phase === 'roundEnd') {
      if (w.time >= this.pauseUntil) {
        this.resetRound(m);
        this.phase = 'intro';
        this.pauseUntil = w.time + 1.5;
        this.banner = 'Раунд ' + this.round;
      }
      return;
    }
    const t = w.time - this.roundStart;
    if (t > R.poisonStart) {
      const k = clamp((t - R.poisonStart) / R.poisonDuration, 0, 1);
      w.setZoneShrink(k, R.poisonDps * (1 + k));
    }
    const b = teamAlive(m, 0), r = teamAlive(m, 1);
    if (b > 0 && r > 0) return;
    const winner: number = b > 0 ? 0 : r > 0 ? 1 : -1;
    if (winner === 0 || winner === 1) this.wins[winner]++;
    if ((winner === 0 || winner === 1) && this.wins[winner] >= R.winsNeeded) {
      const star = m.starPlayer(winner);
      this.result = { mode: 'knockout', winnerTeam: winner, starPlayerId: star.id, duration: w.time, reason: 'normal', score: { 0: this.wins[0], 1: this.wins[1] } };
      return;
    }
    this.banner = winner < 0 ? 'Ничья в раунде!' : winner === 0 ? 'Раунд за СИНИМИ!' : 'Раунд за КРАСНЫМИ!';
    w.emit({ t: 'announce', text: this.banner, big: true });
    this.phase = 'roundEnd';
    this.pauseUntil = w.time + R.roundPause;
  }

  private resetRound(m: Match) {
    const w = m.world;
    this.round++;
    w.zone = null;
    w.projectiles = [];
    w.minions = [];
    w.pickups = [];
    const counters = [0, 0];
    for (const f of w.fighters) {
      const sp = f.team === 0 ? w.map.blueSpawns : w.map.redSpawns;
      const s = sp[counters[f.team]++ % sp.length];
      w.respawn(f, s.x, s.y);
    }
  }

  botGoal(m: Match, f: Fighter): BotGoal | null {
    const z = zoneGoal(m, f);
    if (z) return z;
    const e = nearestEnemy(m, f);
    const w = m.world;
    if (!e) return { x: w.map.w / 2, y: w.map.h / 2, urgency: 0.2 };
    // наступаем к середине, потом к врагу; раненые держатся позади
    const cx = w.map.w / 2, cy = w.map.h / 2;
    const k = f.hp / f.maxHp > 0.5 ? 0.7 : 0.3;
    return { x: cx + (e.x - cx) * k, y: cy + (e.y - cy) * k, urgency: 0.3 };
  }

  hud(m: Match): ModeHud {
    const h = emptyHud();
    h.score = [...this.wins] as [number, number];
    h.round = this.round;
    h.banner = this.phase !== 'play' ? this.banner : '';
    const t = this.phase === 'play' ? m.world.time - this.roundStart : 0;
    h.timer = t < R.poisonStart ? R.poisonStart - t : 0;
    h.alive = teamAlive(m, 0) * 10 + teamAlive(m, 1);
    return h;
  }
}
