// Ввод: тач (два джойстика и кнопки), клавиатура + мышь, геймпад. На выходе — FighterInput для симуляции.
import type { FighterInput } from '../sim/types';

export type Device = 'touch' | 'desktop' | 'gamepad';

export interface AimState {
  kind: 'attack' | 'super';
  angle: number;
  /** 0…1 — насколько далеко оттянут джойстик (для броска). */
  power: number;
}

const DEAD = 0.18;
const TAP_TIME = 260; // мс
const TAP_DIST = 18; // px
const CANCEL_DIST = 22; // px

interface Stick {
  id: number;
  ox: number; oy: number;
  x: number; y: number;
  t0: number;
  aiming: boolean;
  kind: 'move' | 'attack' | 'super';
}

export class Input {
  device: Device;
  private keys = new Set<string>();
  private touches = new Map<number, Stick>();
  private mouse = { x: 0, y: 0, l: false, r: false, lAt: 0, rAt: 0 };
  private pending: { attack: 0 | 1 | 2; sup: 0 | 1 | 2; angle: number; emote: number; power: number } = { attack: 0, sup: 0, angle: 0, emote: -1, power: 1 };
  /** Угол, который будет при выстреле с ручным прицелом. */
  aim: AimState | null = null;
  move = { x: 0, y: 0 };
  seq = 0;
  enabled = true;
  /** Экранная позиция своего бойца (для прицела мышью). */
  playerScreen = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  /** Где на экране кнопки атаки и супера (их задаёт HUD). */
  zones = {
    attack: { x: 0, y: 0, r: 0 },
    super: { x: 0, y: 0, r: 0 },
  };
  onDevice: (d: Device) => void = () => {};
  onPause: () => void = () => {};
  onEmoteKey: () => void = () => {};
  /** Вызывается при смене визуального состояния джойстиков (для HUD). */
  sticks: { move: Stick | null; attack: Stick | null; super: Stick | null } = { move: null, attack: null, super: null };
  private gpPrev = { a: false, rb: false, lb: false, y: false, start: false, aiming: false, superAim: false };
  private disposers: (() => void)[] = [];

  constructor(private el: HTMLElement) {
    this.device = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window ? 'touch' : 'desktop';
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
      window.addEventListener(t, f as any, o);
      this.disposers.push(() => window.removeEventListener(t, f as any, o));
    };
    on('keydown', (e) => this.onKey(e, true));
    on('keyup', (e) => this.onKey(e, false));
    on('blur', () => { this.keys.clear(); this.touches.clear(); this.mouse.l = this.mouse.r = false; this.aim = null; });
    const tOpts = { passive: false } as AddEventListenerOptions;
    const eon = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      el.addEventListener(t, f as any, o);
      this.disposers.push(() => el.removeEventListener(t, f as any, o));
    };
    eon('touchstart', (e) => this.onTouch(e, 'start'), tOpts);
    eon('touchmove', (e) => this.onTouch(e, 'move'), tOpts);
    eon('touchend', (e) => this.onTouch(e, 'end'), tOpts);
    eon('touchcancel', (e) => this.onTouch(e, 'end'), tOpts);
    eon('mousedown', (e) => this.onMouse(e, 'down'));
    on('mouseup', (e) => this.onMouse(e, 'up'));
    on('mousemove', (e) => this.onMouse(e, 'move'));
    eon('contextmenu', (e) => e.preventDefault());
  }

  dispose() { this.disposers.forEach((d) => d()); }

  private setDevice(d: Device) {
    if (this.device !== d) { this.device = d; this.onDevice(d); }
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!this.enabled) return;
    const k = e.code;
    if (down && (k === 'Escape' || k === 'KeyP')) { this.onPause(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyT'].includes(k)) e.preventDefault();
    if (down) this.setDevice('desktop');
    if (down && !this.keys.has(k)) {
      if (k === 'Space') this.pending.attack = 2;
      if (k === 'KeyE') { this.aim = { kind: 'super', angle: this.mouseAngle(), power: 1 }; }
      if (k === 'KeyT') this.onEmoteKey();
    }
    if (!down && k === 'KeyE' && this.aim?.kind === 'super') {
      this.pending.sup = 1; this.pending.angle = this.mouseAngle(); this.pending.power = this.mousePower(); this.aim = null;
    }
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  private mouseAngle() {
    const p = this.playerScreen();
    return Math.atan2((this.mouse.y - p.y) * 1.2, this.mouse.x - p.x);
  }
  private mousePower() {
    const p = this.playerScreen();
    return Math.min(1, Math.hypot(this.mouse.x - p.x, this.mouse.y - p.y) / (window.innerHeight * 0.35));
  }

  private onMouse(e: MouseEvent, kind: 'down' | 'up' | 'move') {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (!this.enabled) return;
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;
    if (kind === 'down') {
      if ((e.target as HTMLElement)?.closest?.('button, .btn, .no-aim')) return;
      this.setDevice('desktop');
      if (e.button === 0) { this.mouse.l = true; this.aim = { kind: 'attack', angle: this.mouseAngle(), power: this.mousePower() }; }
      if (e.button === 2) { this.mouse.r = true; this.aim = { kind: 'super', angle: this.mouseAngle(), power: this.mousePower() }; }
    } else if (kind === 'up') {
      if (e.button === 0 && this.mouse.l) { this.mouse.l = false; this.pending.attack = 1; this.pending.angle = this.mouseAngle(); if (this.aim?.kind === 'attack') this.aim = null; }
      if (e.button === 2 && this.mouse.r) { this.mouse.r = false; this.pending.sup = 1; this.pending.angle = this.mouseAngle(); this.pending.power = this.mousePower(); if (this.aim?.kind === 'super') this.aim = null; }
    } else if (this.aim && this.device === 'desktop') {
      this.aim.angle = this.mouseAngle(); this.aim.power = this.mousePower();
    }
  }

  private inZone(x: number, y: number, z: { x: number; y: number; r: number }) {
    return z.r > 0 && Math.hypot(x - z.x, y - z.y) < z.r;
  }

  private onTouch(e: TouchEvent, kind: 'start' | 'move' | 'end') {
    if (!this.enabled) return;
    const target = e.target as HTMLElement;
    if (kind === 'start' && target?.closest?.('button, .btn, .no-aim')) return;
    e.preventDefault();
    this.setDevice('touch');
    const now = performance.now();
    for (const t of Array.from(e.changedTouches)) {
      if (kind === 'start') {
        const x = t.clientX, y = t.clientY;
        let k: Stick['kind'];
        if (this.inZone(x, y, this.zones.super)) k = 'super';
        else if (this.inZone(x, y, this.zones.attack) || x > window.innerWidth * 0.5) k = 'attack';
        else k = 'move';
        if (this.sticks[k]) continue;
        const z = k === 'move' ? null : this.zones[k];
        const s: Stick = { id: t.identifier, ox: z && this.inZone(x, y, z) ? z.x : x, oy: z && this.inZone(x, y, z) ? z.y : y, x, y, t0: now, aiming: false, kind: k };
        this.touches.set(t.identifier, s);
        this.sticks[k] = s;
      } else {
        const s = this.touches.get(t.identifier);
        if (!s) continue;
        s.x = t.clientX; s.y = t.clientY;
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
        if (kind === 'move') {
          if (s.kind !== 'move' && d > TAP_DIST) s.aiming = true;
          if (s.kind !== 'move' && s.aiming) this.aim = { kind: s.kind, angle: Math.atan2(dy * 1.2, dx), power: Math.min(1, d / 90) };
        } else {
          this.touches.delete(t.identifier);
          this.sticks[s.kind] = null;
          if (s.kind === 'move') continue;
          const quick = now - s.t0 < TAP_TIME && d < TAP_DIST;
          const which = s.kind === 'attack' ? 'attack' : 'sup';
          if (!s.aiming && (quick || d < TAP_DIST)) this.pending[which] = 2;
          else if (s.aiming && d > CANCEL_DIST) { this.pending[which] = 1; this.pending.angle = Math.atan2(dy * 1.2, dx); this.pending.power = Math.min(1, d / 90); }
          if (this.aim?.kind === s.kind) this.aim = null;
        }
      }
    }
  }

  /** Опрос геймпада (вызывать каждый кадр). */
  pollGamepad() {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = Array.from(pads).find((p) => p && p.connected);
    if (!gp) return;
    const ax = gp.axes;
    const lx = ax[0] ?? 0, ly = ax[1] ?? 0, rx = ax[2] ?? 0, ry = ax[3] ?? 0;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const any = Math.hypot(lx, ly) > 0.3 || Math.hypot(rx, ry) > 0.3 || gp.buttons.some((b) => b.pressed);
    if (any) this.setDevice('gamepad');
    if (this.device !== 'gamepad') return;
    this.move.x = Math.abs(lx) > DEAD ? lx : 0;
    this.move.y = Math.abs(ly) > DEAD ? ly : 0;
    const rLen = Math.hypot(rx, ry);
    const rAng = Math.atan2(ry, rx);
    const lb = btn(4) || btn(6), rb = btn(5) || btn(7), a = btn(0), y = btn(3), start = btn(9);
    // правый стик: прицел, отпустил — выстрел; RB — атака, LB — супер, A — автоатака
    if (rLen > 0.5) {
      this.aim = { kind: lb ? 'super' : 'attack', angle: rAng, power: Math.min(1, rLen) };
      this.gpPrev.aiming = true;
      this.gpPrev.superAim = lb;
    } else if (this.gpPrev.aiming) {
      this.gpPrev.aiming = false;
      if (this.aim) { if (this.gpPrev.superAim) this.pending.sup = 1; else this.pending.attack = 1; this.pending.angle = this.aim.angle; this.pending.power = this.aim.power; }
      this.aim = null;
    }
    if (rb && !this.gpPrev.rb && rLen <= 0.5) this.pending.attack = 2;
    if (lb && !this.gpPrev.lb && rLen <= 0.5) this.pending.sup = 2;
    if (a && !this.gpPrev.a) this.pending.attack = 2;
    if (y && !this.gpPrev.y) this.onEmoteKey();
    if (start && !this.gpPrev.start) this.onPause();
    Object.assign(this.gpPrev, { a, rb, lb, y, start });
  }

  emote(i: number) { this.pending.emote = i; }

  /** Ввод за тик симуляции. Одноразовые действия (выстрел) расходуются. */
  sample(): FighterInput {
    let mx = 0, my = 0;
    if (this.device === 'touch') {
      const s = this.sticks.move;
      if (s) {
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), R = 60;
        if (d / R > DEAD) { const k = Math.min(1, d / R); mx = (dx / d) * k; my = (dy / d) * k; }
      }
    } else if (this.device === 'gamepad') {
      mx = this.move.x; my = this.move.y;
    } else {
      const k = this.keys;
      mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (this.aim) { this.aim.angle = this.mouseAngle(); this.aim.power = this.mousePower(); }
    }
    if (!this.enabled) { mx = 0; my = 0; }
    const p = this.pending;
    const out: FighterInput = { mx, my, aim: p.angle, attack: p.attack, superAttack: p.sup, emote: p.emote, seq: ++this.seq, power: p.power };
    if (p.sup) p.power = 1;
    p.attack = 0; p.sup = 0; p.emote = -1;
    return out;
  }

  clear() {
    this.pending = { attack: 0, sup: 0, angle: 0, emote: -1, power: 1 };
    this.aim = null;
    this.touches.clear();
    this.sticks = { move: null, attack: null, super: null };
    this.keys.clear();
  }
}
