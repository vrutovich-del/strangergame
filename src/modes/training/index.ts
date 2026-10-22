// Тренировочный полигон: роботы-мишени трёх видов, счётчик урона в секунду, без наград и без таймера.
// Здесь же короткое обучение для новичка: двигайся → стреляй → супер.
import { BotBrain, type BotGoal } from '../../bots/ai';
import { dist2 } from '../../core/math';
import { MODES } from '../../sim/rules';
import type { Fighter, MatchResult, PlayerSlot } from '../../sim/types';
import type { Match } from '../../sim/match';
import { emptyHud, type ModeHud, type ModeRules } from '../types';

const DUMMIES: { kind: 'static' | 'move' | 'shoot'; x: number; y: number }[] = [
  { kind: 'static', x: 7.5, y: 2.5 },
  { kind: 'static', x: 17.5, y: 2.5 },
  { kind: 'move', x: 8.5, y: 5.5 },
  { kind: 'move', x: 16.5, y: 5.5 },
  { kind: 'shoot', x: 3.5, y: 7.5 },
  { kind: 'shoot', x: 21.5, y: 7.5 },
];
const DUMMY_NAMES = { static: 'Мишень', move: 'Бегунок', shoot: 'Стрелок' };

export class Training implements ModeRules {
  id = 'training' as const;
  result: MatchResult | null = null;
  private hits: { t: number; a: number }[] = [];
  private total = 0;
  private player: Fighter | null = null;
  private step = 0;
  private stepAt = 0;
  private tutorial = false;
  private mark = { x: 12.5, y: 5.5 };

  setup(m: Match) {
    const w = m.world;
    const p = m.cfg.players[0];
    const s = w.map.blueSpawns[0];
    this.player = w.addFighter(p, s.x, s.y);
    this.tutorial = !!m.cfg.tutorial;
    if (!this.tutorial) for (const d of DUMMIES) this.addDummy(m, d.kind, d.x, d.y);
    w.onDeath = (f) => { if (f.dummy) f.respawnAt = w.time + MODES.training.respawn; else f.respawnAt = w.time + 1.5; };
  }

  private addDummy(m: Match, kind: 'static' | 'move' | 'shoot', x: number, y: number, hp?: number) {
    const slot: PlayerSlot = { name: DUMMY_NAMES[kind], heroId: 'robo_dummy', skinId: 'default', level: 1, team: 1, isBot: true, owner: '', dummy: kind };
    const f = m.world.addFighter(slot, x, y);
    if (kind !== 'static') { f.maxHp = f.hp = f.baseHp = 3500; }
    if (hp) { f.maxHp = f.hp = f.baseHp = hp; }
    m.brains.set(f.id, new BotBrain(f, m.cfg.difficulty, m.cfg.seed));
    return f;
  }

  tick(m: Match) {
    const w = m.world;
    const me = this.player!;
    for (const e of w.events) {
      if (e.t === 'hit' && e.by === me.id) { this.hits.push({ t: w.time, a: e.amount }); this.total += e.amount; }
      if (e.t === 'mhit') { /* урон помощникам не считаем */ }
    }
    while (this.hits.length && w.time - this.hits[0].t > 3) this.hits.shift();
    for (const f of w.fighters) {
      if (!f.alive && f.respawnAt > 0 && w.time >= f.respawnAt) {
        f.respawnAt = 0;
        if (f.dummy && this.tutorial) continue;
        w.respawn(f, f.spawnX, f.spawnY);
      }
    }
    if (this.tutorial) this.tutorialTick(m);
  }

  private tutorialTick(m: Match) {
    const w = m.world, me = this.player!;
    if (this.step === 0 && dist2(me.x, me.y, this.mark.x, this.mark.y) < 1.2) {
      this.step = 1; this.stepAt = w.time;
      this.addDummy(m, 'static', 12.5, 2.5, 1800);
      w.emit({ t: 'announce', text: 'Отлично!', big: false });
    } else if (this.step === 1 && w.fighters.some((f) => f.dummy && !f.alive)) {
      this.step = 2; this.stepAt = w.time;
      me.superCharge = 1;
      w.emit({ t: 'ready', id: me.id });
      this.addDummy(m, 'static', 9.5, 2.5, 3000);
      this.addDummy(m, 'static', 15.5, 2.5, 3000);
    } else if (this.step === 2 && me.stats.supers > 0) {
      this.step = 3; this.stepAt = w.time;
      w.emit({ t: 'announce', text: 'Ты готов к бою!', big: true });
    } else if (this.step === 3 && w.time - this.stepAt > 3) {
      this.result = { mode: 'training', winnerTeam: 0, starPlayerId: me.id, duration: w.time, reason: 'normal' };
    }
  }

  frozen() { return !!this.result; }

  botGoal(_m: Match, _f: Fighter): BotGoal | null { return null; }

  hud(m: Match): ModeHud {
    const h = emptyHud();
    const span = this.hits.length ? Math.max(1, Math.min(3, m.world.time - this.hits[0].t)) : 1;
    h.dps = Math.round(this.hits.reduce((a, b) => a + b.a, 0) / span);
    h.total = this.total;
    if (this.tutorial) {
      h.tip = ['Двигайся! Дойди до звезды', 'Стреляй! Сбей робота-мишень', 'Супер заряжен! Жми жёлтую кнопку', 'Ты готов к бою!'][this.step];
      if (this.step === 0) { h.markX = this.mark.x; h.markY = this.mark.y; }
      h.round = this.step + 1;
    }
    return h;
  }
}
