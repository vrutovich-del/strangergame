// Общие помощники режимов.
import type { P2 } from '../core/grid';
import { dist2 } from '../core/math';
import type { Fighter } from '../sim/types';
import type { Match } from '../sim/match';

/** Расставить команды 3×3 по стартовым точкам. */
export function spawnTeams(m: Match) {
  const map = m.world.map;
  const blue = m.cfg.players.filter((p) => p.team === 0);
  const red = m.cfg.players.filter((p) => p.team === 1);
  blue.forEach((p, i) => { const s = map.blueSpawns[i % map.blueSpawns.length]; m.world.addFighter(p, s.x, s.y); });
  red.forEach((p, i) => { const s = map.redSpawns[i % map.redSpawns.length]; m.world.addFighter(p, s.x, s.y); });
}

export function teamAlive(m: Match, team: number) {
  return m.world.fighters.filter((f) => f.alive && f.team === team).length;
}

/** Точка возле своей базы. */
export function homeOf(m: Match, f: Fighter): P2 {
  const sp = f.team === 0 ? m.world.map.blueSpawns : m.world.map.redSpawns;
  if (!sp.length) return { x: f.spawnX, y: f.spawnY };
  const cx = sp.reduce((a, s) => a + s.x, 0) / sp.length, cy = sp.reduce((a, s) => a + s.y, 0) / sp.length;
  return { x: cx, y: cy + (f.team === 0 ? -1.5 : 1.5) };
}

export function nearest<T extends P2>(list: T[], p: P2): T | null {
  let best: T | null = null, bd = Infinity;
  for (const o of list) { const d = dist2(o.x, o.y, p.x, p.y); if (d < bd) { bd = d; best = o; } }
  return best;
}

/** Ближайший противник (для цели «охота»). */
export function nearestEnemy(m: Match, f: Fighter): Fighter | null {
  const team = m.world.effTeam(f);
  return nearest(m.world.fighters.filter((o) => o.alive && m.world.effTeam(o) !== team && !o.dummy), f);
}

/** Держаться внутри безопасной зоны. */
export function zoneGoal(m: Match, f: Fighter) {
  const z = m.world.zone;
  if (!z || !z.active) return null;
  const margin = 1.6;
  if (f.x < z.x0 + margin || f.x > z.x1 - margin || f.y < z.y0 + margin || f.y > z.y1 - margin) {
    const cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2;
    const p = m.world.map.nearestFree(cx + (f.x - cx) * 0.3, cy + (f.y - cy) * 0.3) ?? { x: cx, y: cy };
    const outside = f.x < z.x0 || f.x > z.x1 || f.y < z.y0 || f.y > z.y1;
    return { x: p.x, y: p.y, urgency: outside ? 1 : 0.7 };
  }
  return null;
}
