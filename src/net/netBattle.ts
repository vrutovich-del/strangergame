// Сетевой бой. Хост ведёт настоящую симуляцию (вместе с роботами) и рассылает снимки.
// Клиент показывает чужих бойцов с интерполяцией, а своё движение предсказывает сразу.
import { SIM_HZ } from '../config';
import { lerp, lerpAngle } from '../core/math';
import { getHero } from '../heroes/registry';
import { mapById, parseMap } from '../maps';
import { emptyHud, type ModeHud } from '../modes/types';
import { BATTLE } from '../sim/rules';
import type { Fighter, FighterInput, MatchConfig, MatchResult, Minion, Pickup, Projectile, SimEvent } from '../sim/types';
import { World } from '../sim/world';
import type { Match } from '../sim/match';
import { LocalSource, type BattleSource } from '../ui/battle';
import { decodeFighter, decodeInput, encodeInput, encodeStats, makeSnapshot, pickupKind, type NetMsg, type Snapshot } from './protocol';
import type { Room } from './room';

const SNAP_EVERY = 0.05; // 20 снимков в секунду

/** Сколько секунд реально прошло с прошлого кадра (цикл кадров обрезает dt до 0,1 с,
 *  а сетевому бою нужно идти вровень с настоящими часами, иначе снимки и ввод разъезжаются). */
function realClock() {
  let last = 0;
  return (fallback: number) => {
    const now = performance.now();
    const d = last ? (now - last) / 1000 : fallback;
    last = now;
    return Math.max(0, Math.min(0.5, d));
  };
}

/** Склеить два ввода в один тик: движение за два шага, действие — последнее. */
export function mergeInputs(a: FighterInput, b: FighterInput): FighterInput {
  const out: FighterInput = { ...b, mx: (a.mx + b.mx) / 2, my: (a.my + b.my) / 2, steps: (a.steps ?? 1) + (b.steps ?? 1) };
  if (!b.attack && !b.superAttack && (a.attack || a.superAttack)) { out.attack = a.attack; out.superAttack = a.superAttack; out.aim = a.aim; out.power = a.power; }
  if (b.emote < 0 && a.emote >= 0) out.emote = a.emote;
  return out;
}

/** Очередь ввода одного друга у хоста: ровно один ввод на тик, как у него на экране,
 *  и небольшой запас против пачек пакетов по Wi‑Fi. Тогда предсказание движения у друга совпадает с хостом. */
export class InputQueue {
  q: FighterInput[] = [];
  private primed = false;
  push(i: FighterInput) {
    this.q.push(i);
    // совсем отстали — старое движение выбрасываем, но выстрелы не теряем
    while (this.q.length > 45) {
      const old = this.q.shift()!, nx = this.q[0];
      this.q[0] = { ...mergeInputs(old, nx), mx: nx.mx, my: nx.my, steps: nx.steps };
    }
  }
  /** Ввод на этот тик или null (ввод опоздал — этот шаг друг сделает позже). */
  next(): FighterInput | null {
    if (!this.primed) { if (this.q.length < 2) return null; this.primed = true; }
    if (!this.q.length) { this.primed = false; return null; }
    let inp = this.q.shift()!;
    // очередь растёт (у хоста подтормаживало) — догоняем: два шага за тик
    if (this.q.length > 4) inp = mergeInputs(inp, this.q.shift()!);
    return inp;
  }
}

/** Хост: обычная симуляция + ввод друзей + рассылка снимков. */
export class HostSource extends LocalSource {
  canPause = false;
  private queues = new Map<string, InputQueue>();
  private acks = new Map<string, number>();
  private clock = realClock();
  private netEvents: SimEvent[] = [];
  private snapAcc = 0;
  private infoAt = -99;
  private ended = false;
  private offs: (() => void)[] = [];

  constructor(match: Match, localId: number, private room: Room) {
    super(match, localId);
    this.offs.push(room.on('msg', ({ from, msg }) => this.onMsg(from, msg)));
    this.offs.push(room.on('left', (id) => { match.replaceWithBot(id); this.queues.delete(id); }));
    this.onTick = () => this.afterTick();
    this.beforeTick = () => this.collectRemote();
  }

  private onMsg(from: string, msg: NetMsg) {
    if (msg.t === 'in' && Array.isArray(msg.d)) {
      let q = this.queues.get(from);
      if (!q) { q = new InputQueue(); this.queues.set(from, q); }
      q.push(decodeInput(msg.d));
    } else if (msg.t === 'ping') this.room.send({ t: 'pong', c: msg.c }, from);
  }

  /** Ввод друзей на этот тик: по одному из очереди, без потерь и без лишних шагов. */
  private collectRemote() {
    this.remoteInputs.clear();
    for (const [owner, q] of this.queues) {
      const f = this.match.fighterOf(owner);
      if (!f) continue;
      const inp = q.next();
      if (!inp) continue;
      this.acks.set(owner, inp.seq);
      this.remoteInputs.set(f.id, inp);
    }
  }

  update(dt: number, sample: () => FighterInput): SimEvent[] {
    const ev = super.update(this.clock(dt), sample);
    this.netEvents.push(...ev);
    if (this.netEvents.length > 300) this.netEvents.splice(0, this.netEvents.length - 300);
    return ev;
  }

  private afterTick() {
    const w = this.world;
    this.snapAcc += 1 / SIM_HZ;
    const res = this.match.result;
    if (res && !this.ended) {
      this.ended = true;
      this.sendSnap();
      this.room.send({ t: 'end', res, stats: encodeStats(w) });
      return;
    }
    if (this.snapAcc >= SNAP_EVERY) { this.snapAcc = 0; this.sendSnap(); }
  }

  private sendSnap() {
    const w = this.world;
    const hud = this.hud();
    const withInfo = w.time - this.infoAt > 2;
    if (withInfo) this.infoAt = w.time;
    for (const id of this.room.clientIds) {
      const s = makeSnapshot(w, this.acks.get(id) ?? 0, hud, this.netEvents, this.localTeam, withInfo, this.match.rules.frozen(this.match));
      this.room.send({ t: 'snap', s }, id);
    }
    this.netEvents = [];
  }

  quit() {
    super.quit();
    this.room.leave();
  }

  dispose() { this.offs.forEach((f) => f()); }
}

interface Info { heroId: string; skinId: string; name: string; level: number; team: number; owner: string; isBot: boolean; dummy: string }

/** Задержка показа чужих бойцов: столько секунд снимков держим про запас (подстраивается под Wi‑Fi). */
const INTERP_MIN = 0.09, INTERP_MAX = 0.35;

/** Клиент: копия мира по снимкам хоста. */
export class ClientSource implements BattleSource {
  world: World;
  localId = 0;
  localTeam = 0;
  alpha = 1;
  canPause = false;
  private buf: Snapshot[] = [];
  private offset: number | null = null;
  private renderTime = 0;
  private delay = 0.12;
  private jitter = 0.02;
  private lastArrive = 0;
  private clock = realClock();
  private infos = new Map<number, Info>();
  private queue: { tm: number; e: SimEvent }[] = [];
  private pending: FighterInput[] = [];
  private pred = { x: 0, y: 0 };
  private smooth = { x: 0, y: 0 };
  private predOn = false;
  private acc = 0;
  private hudState: ModeHud = emptyHud();
  private res: MatchResult | null = null;
  private fail = '';
  private offs: (() => void)[] = [];
  private pingAt = 0;
  ping = 0;
  private quitRes: MatchResult | null = null;

  constructor(private room: Room, public cfg: MatchConfig) {
    this.world = new World(parseMap(mapById(cfg.mapId)), cfg.seed);
    const hiddenIds = new Set<number>();
    (this.world as any).hidden = hiddenIds;
    this.world.isVisibleTo = (f: Fighter) => f.alive && !hiddenIds.has(f.id);
    this.offs.push(room.on('msg', ({ msg }) => this.onMsg(msg)));
    this.offs.push(room.on('closed', () => { if (!this.res) this.fail = 'Хост вышел — бой окончен.'; }));
  }

  get mode() { return this.cfg.mode; }

  private onMsg(msg: NetMsg) {
    if (msg.t === 'snap') this.onSnap(msg.s);
    else if (msg.t === 'end') {
      for (const st of msg.stats) {
        const f = this.world.findById(st[0]);
        if (f) Object.assign(f.stats, { damage: st[1], kills: st[2], deaths: st[3], gems: st[4], supers: st[5], cubes: st[6] });
      }
      // снимки доиграть не нужно — показываем итог
      this.res = msg.res;
      this.room.inGame = false;
    } else if (msg.t === 'pong') this.ping = performance.now() - msg.c;
  }

  private onSnap(s: Snapshot) {
    const now = performance.now() / 1000;
    const st = s.tm / 1000;
    // оценка разницы часов: самый быстрый пакет — лучшая оценка, плюс медленный дрейф
    const sample = st - now;
    if (this.offset === null || sample > this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * (this.offset - sample > 0.15 ? 0.2 : 0.02);
    // насколько неровно приходят снимки (Wi‑Fi любит пачки)
    if (this.lastArrive) this.jitter += (Math.abs(now - this.lastArrive - SNAP_EVERY) - this.jitter) * 0.1;
    this.lastArrive = now;
    if (s.fi) for (const a of s.fi) this.infos.set(a[0] as number, { heroId: a[1] as string, skinId: a[2] as string, name: a[3] as string, level: a[4] as number, team: a[5] as number, owner: a[6] as string, isBot: !!a[7], dummy: a[8] as string });
    if (!this.localId) {
      for (const [id, inf] of this.infos) if (inf.owner === this.room.myId) { this.localId = id; this.localTeam = inf.team; }
    }
    for (const e of s.ev) this.queue.push({ tm: st, e });
    this.buf.push(s);
    if (this.buf.length > 40) this.buf.shift();
    this.hudState = s.h;
    // сверка своего движения
    const mine = s.f.find((a) => a[0] === this.localId);
    if (mine) {
      const d = decodeFighter(mine);
      const before = { ...this.pred };
      this.pending = this.pending.filter((i) => i.seq > s.ack);
      if (!d.alive || d.forced || !this.predOn) {
        this.pred = { x: d.x, y: d.y };
        this.predOn = d.alive;
        this.smooth = { x: 0, y: 0 };
      } else {
        this.pred = { x: d.x, y: d.y };
        for (const i of this.pending) this.applyMove(i);
        const ex = before.x - this.pred.x, ey = before.y - this.pred.y;
        if (Math.hypot(ex, ey) < 1.5) { this.smooth.x += ex; this.smooth.y += ey; } else this.smooth = { x: 0, y: 0 };
      }
    }
  }

  private myHero() {
    const inf = this.infos.get(this.localId);
    return inf ? getHero(inf.heroId) : null;
  }

  private applyMove(i: FighterInput) {
    const def = this.myHero();
    if (!def) return;
    let mx = i.mx, my = i.my;
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    if (l > 0.1) this.world.map.moveCircle(this.pred, mx * def.stats.speed / SIM_HZ, my * def.stats.speed / SIM_HZ, def.stats.radius ?? BATTLE.fighterRadius);
  }

  update(dt: number, sample: () => FighterInput): SimEvent[] {
    const step = 1 / SIM_HZ;
    this.acc += this.clock(dt);
    while (this.acc >= step) {
      this.acc -= step;
      const inp = sample();
      this.room.send({ t: 'in', d: encodeInput(inp) });
      if (this.predOn) { this.applyMove(inp); this.pending.push(inp); if (this.pending.length > 90) this.pending.shift(); }
    }
    const k = Math.exp(-dt * 10);
    this.smooth.x *= k; this.smooth.y *= k;
    if (performance.now() - this.pingAt > 2000) { this.pingAt = performance.now(); this.room.send({ t: 'ping', c: performance.now() }); }
    const want = Math.max(INTERP_MIN, Math.min(INTERP_MAX, SNAP_EVERY + 0.03 + this.jitter * 2.5));
    this.delay += (want - this.delay) * Math.min(1, dt * (want > this.delay ? 4 : 0.5));
    if (this.offset !== null && this.buf.length) {
      // время показа идёт только вперёд и не убегает дальше свежего снимка
      const latest = this.buf[this.buf.length - 1].tm / 1000;
      const rt = Math.min(performance.now() / 1000 + this.offset - this.delay, latest + 0.1);
      this.renderTime = Math.max(this.renderTime, rt);
    }
    this.applyInterpolation();
    const out: SimEvent[] = [];
    while (this.queue.length && this.queue[0].tm <= this.renderTime + 0.02) out.push(this.queue.shift()!.e);
    for (const e of out) {
      if (e.t === 'tile') this.world.map.set(e.tx, e.ty, e.to);
      else if (e.t === 'timestop') this.world.timeStop = { team: e.team, until: this.world.time + e.dur, by: e.id };
    }
    return out;
  }

  private applyInterpolation() {
    const b = this.buf;
    if (!b.length) return;
    const t = this.renderTime;
    let s0 = b[0], s1 = b[b.length - 1];
    for (let i = 0; i < b.length - 1; i++) if (b[i].tm / 1000 <= t && b[i + 1].tm / 1000 >= t) { s0 = b[i]; s1 = b[i + 1]; break; }
    if (t > s1.tm / 1000) s0 = s1;
    const t0 = s0.tm / 1000, t1 = s1.tm / 1000;
    const a = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 1;
    const w = this.world;
    w.time = Math.max(w.time, t);
    const latest = b[b.length - 1];
    const lt = latest.tm / 1000;
    // бойцы
    const hidden = (w as any).hidden as Set<number>;
    hidden.clear();
    const prev0 = new Map(s0.f.map((x) => [x[0], x]));
    const seen = new Set<number>();
    for (const raw of s1.f) {
      const id = raw[0];
      seen.add(id);
      const inf = this.infos.get(id);
      if (!inf) continue;
      let f = w.findById(id);
      if (!f) { f = this.newFighter(id, inf); w.fighters.push(f); }
      const d1 = decodeFighter(raw);
      const d0 = prev0.has(id) ? decodeFighter(prev0.get(id)!) : d1;
      const isMe = id === this.localId;
      const dl = isMe ? decodeFighter(latest.f.find((x) => x[0] === id) ?? raw) : d1;
      // своё движение предсказываем; прыжок, рывок и оглушение показываем плавно по снимкам
      if (isMe && this.predOn && dl.alive && !dl.forced) {
        f.x = this.pred.x + this.smooth.x; f.y = this.pred.y + this.smooth.y;
      } else {
        const jump = Math.hypot(d1.x - d0.x, d1.y - d0.y) > 3;
        f.x = jump ? d1.x : lerp(d0.x, d1.x, a); f.y = jump ? d1.y : lerp(d0.y, d1.y, a);
      }
      f.px = f.x; f.py = f.y;
      const d = isMe ? dl : d1;
      const st = isMe ? lt : t1;
      f.facing = isMe ? d.facing : lerpAngle(d0.facing, d1.facing, a);
      f.hp = d.hp; f.maxHp = d.maxHp; f.ammo = d.ammo; f.superCharge = d.superCharge;
      const wasAlive = f.alive;
      f.alive = d.alive; f.moving = d.moving; f.inBush = d.inBush;
      if (d.hidden) hidden.add(id);
      f.gems = d.gems; f.cubes = d.cubes;
      f.infectedUntil = d.infectedFor > 0 ? st + d.infectedFor : 0; f.infectTeam = d.infectTeam;
      f.emote = d.emote; f.emoteUntil = d.emoteFor > 0 ? st + d.emoteFor : 0;
      f.shotAt = st - d.shotAge; f.superAt = st - d.superAge; f.hurtAt = st - d.hurtAge;
      f.deadAt = d.alive ? f.deadAt : st - d.deadAge;
      f.respawnAt = d.respawnIn > 0 ? st + d.respawnIn : 0;
      if (isMe && !wasAlive && d.alive) { this.pred = { x: d.x, y: d.y }; this.predOn = true; this.pending = []; }
      if (isMe && !d.alive) this.predOn = false;
    }
    if (w.fighters.some((f) => !seen.has(f.id))) w.fighters = w.fighters.filter((f) => seen.has(f.id));
    // снаряды
    const p0 = new Map(s0.p.map((x) => [x[0] as number, x]));
    const projs: Projectile[] = [];
    for (const raw of s1.p) {
      const id = raw[0] as number;
      const o = p0.get(id) ?? raw;
      const x = lerp((o[2] as number) / 100, (raw[2] as number) / 100, a), y = lerp((o[3] as number) / 100, (raw[3] as number) / 100, a);
      const old = w.projectiles.find((p) => p.id === id);
      const p: Projectile = old ?? {
        id, ownerId: raw[6] as number, heroId: '', team: raw[5] as number, kind: raw[1] as string, x, y, px: x, py: y, vx: 0, vy: 0,
        angle: (raw[4] as number) / 1000, radius: 0.2, damage: 0, travelled: 0, range: 0, pierce: false, hitIds: [], isSuper: false, superPerHit: 0, breaksCrates: false, effect: '', alive: true,
      };
      p.x = p.px = x; p.y = p.py = y;
      projs.push(p);
    }
    w.projectiles = projs;
    // помощники
    const m0 = new Map(s0.m.map((x) => [x[0], x]));
    const mins: Minion[] = [];
    for (const raw of s1.m) {
      const o = m0.get(raw[0]) ?? raw;
      const old = w.minions.find((m) => m.id === raw[0]);
      const x = lerp(o[1] / 100, raw[1] / 100, a), y = lerp(o[2] / 100, raw[2] / 100, a);
      const m: Minion = old ?? {
        id: raw[0], ownerId: raw[8], heroId: 'smile', kind: 'smile_helper', team: raw[7], x, y, px: x, py: y, facing: 0, hp: raw[4], maxHp: raw[5],
        bornAt: t1, expiresAt: t1 + raw[11] / 1000, targetId: 0, fireAt: 0, slot: raw[6], damage: 0, range: 0, alive: true, shotAt: -99, hurtAt: -99,
      };
      m.x = m.px = x; m.y = m.py = y; m.facing = lerpAngle(o[3] / 1000, raw[3] / 1000, a);
      m.hp = raw[4]; m.shotAt = t1 - raw[9] / 1000; m.hurtAt = t1 - raw[10] / 1000; m.expiresAt = t1 + raw[11] / 1000;
      mins.push(m);
    }
    w.minions = mins;
    // предметы
    const k0 = new Map(s0.k.map((x) => [x[0], x]));
    const picks: Pickup[] = [];
    for (const raw of s1.k) {
      const o = k0.get(raw[0]) ?? raw;
      const x = lerp(o[2] / 100, raw[2] / 100, a), y = lerp(o[3] / 100, raw[3] / 100, a);
      const old = w.pickups.find((p) => p.id === raw[0]);
      const p: Pickup = old ?? { id: raw[0], kind: pickupKind(raw[1]), x, y, px: x, py: y, vx: 0, vy: 0, bornAt: t1 - raw[4] / 1000, alive: true };
      p.x = p.px = x; p.y = p.py = y;
      picks.push(p);
    }
    w.pickups = picks;
    // зона
    const z = s1.z;
    w.zone = z.length ? { x0: z[0] / 100, y0: z[1] / 100, x1: z[2] / 100, y1: z[3] / 100, active: true, dps: 0 } : null;
  }

  private newFighter(id: number, inf: Info): Fighter {
    return {
      id, heroId: inf.heroId, skinId: inf.skinId, name: inf.name, level: inf.level, team: inf.team, infectTeam: -1, infectedUntil: 0, infectedBy: 0,
      isBot: inf.isBot, owner: inf.owner, dummy: (inf.dummy || undefined) as any, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, facing: 0, moving: false,
      radius: BATTLE.fighterRadius, speed: 0, hp: 1, maxHp: 1, baseHp: 1, dmgMul: 1, ammo: 3, attackReadyAt: 0, superCharge: 0,
      alive: true, deadAt: 0, respawnAt: 0, lastHurt: -99, lastShot: -99, revealUntil: 0, inBush: false, gems: 0, cubes: 0,
      dash: null, knock: null, leap: null, stunUntil: 0, emote: -1, emoteUntil: 0, shotAt: -99, superAt: -99, hurtAt: -99, spawnX: 0, spawnY: 0,
      stats: { damage: 0, kills: 0, deaths: 0, gems: 0, supers: 0, hits: 0, cubes: 0 },
    };
  }

  hud() { return this.hudState; }
  result() { return this.quitRes ?? this.res; }
  failure() { return this.fail; }
  respawnIn() {
    const f = this.world.findById(this.localId);
    return f && !f.alive && f.respawnAt > 0 ? f.respawnAt - this.world.time : 0;
  }
  quit() {
    const me = this.world.findById(this.localId);
    this.quitRes = { mode: this.cfg.mode, winnerTeam: me?.team === 0 ? 1 : 0, starPlayerId: this.localId, duration: this.world.time, reason: 'quit' };
    this.room.leave();
  }
  dispose() { this.offs.forEach((f) => f()); }
}
