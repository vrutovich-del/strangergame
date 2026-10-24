// Экран боя: связывает источник состояния (локальный матч или сеть), ввод, 3D-сцену, HUD и звук.
import * as THREE from 'three';
import { audio, sfx, type SfxName } from '../audio/sfx';
import { music } from '../audio/music';
import { SIM_HZ } from '../config';
import { Input } from '../core/input';
import { getHero } from '../heroes/registry';
import { getSkin } from '../heroes/skins';
import type { ModeId } from '../maps/types';
import type { ModeHud } from '../modes/types';
import { BattleView } from '../render/battleView';
import type { GameRenderer } from '../render/renderer';
import type { Match } from '../sim/match';
import type { FighterInput, MatchConfig, MatchResult, SimEvent } from '../sim/types';
import type { World } from '../sim/world';
import { btn, confirmBox, h, modal } from './dom';
import { Hud } from './hud';
import { icon } from './icons';
import { soundRows } from './screens/settings';

/** Откуда берётся состояние боя: локальная симуляция, хост или клиент сети. */
export interface BattleSource {
  world: World;
  cfg: MatchConfig;
  localId: number;
  localTeam: number;
  mode: ModeId;
  /** Доля между тиками для плавной отрисовки. */
  alpha: number;
  /** Можно ли поставить игру на паузу (только одиночная игра). */
  canPause: boolean;
  update(dt: number, sample: () => FighterInput): SimEvent[];
  hud(): ModeHud;
  result(): MatchResult | null;
  /** Сообщение о сбое (например, хост вышел). */
  failure(): string;
  respawnIn(): number;
  /** Игрок вышел сам. */
  quit(): void;
  dispose(): void;
}

/** Локальный матч (один игрок с роботами или хост сетевой игры). */
export class LocalSource implements BattleSource {
  alpha = 0;
  canPause = true;
  paused = false;
  private acc = 0;
  private quitResult: MatchResult | null = null;
  /** Хост добавляет ввод друзей и рассылает снимки. */
  onTick: (() => void) | null = null;
  beforeTick: (() => void) | null = null;
  remoteInputs = new Map<number, FighterInput>();
  constructor(public match: Match, public localId: number) {}
  get world() { return this.match.world; }
  get cfg() { return this.match.cfg; }
  get localTeam() { return this.world.findById(this.localId)?.team ?? 0; }
  get mode() { return this.match.cfg.mode; }
  update(dt: number, sample: () => FighterInput) {
    if (this.paused) { this.alpha = 1; return []; }
    const step = 1 / SIM_HZ;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= step) {
      this.beforeTick?.();
      const local = sample();
      const inputs = new Map(this.remoteInputs);
      inputs.set(this.localId, local);
      this.match.step(inputs);
      this.onTick?.();
      this.acc -= step;
    }
    this.alpha = this.acc / step;
    return this.match.drainEvents();
  }
  hud() { return this.match.rules.hud(this.match); }
  result() { return this.quitResult ?? this.match.result; }
  failure() { return ''; }
  respawnIn() {
    const f = this.world.findById(this.localId);
    return f && !f.alive && f.respawnAt > 0 ? f.respawnAt - this.world.time : 0;
  }
  quit() {
    const m = this.match;
    const me = this.world.findById(this.localId)!;
    this.quitResult = { mode: m.cfg.mode, winnerTeam: m.cfg.mode === 'training' ? null : me.team === 0 ? 1 : 0, starPlayerId: m.starPlayer(null).id, duration: this.world.time, reason: 'quit', teamPlace: m.cfg.mode === 'showdown' ? { [me.team]: this.world.fighters.filter((f) => f.alive).length } : undefined };
  }
  dispose() {}
}

export class BattleScreen {
  view: BattleView;
  hud: Hud;
  input: Input;
  private root: HTMLElement;
  private ended = false;
  private endTimer = 0;
  private pauseEl: HTMLElement | null = null;

  constructor(
    private r: GameRenderer,
    private src: BattleSource,
    private opts: { onEnd: (res: MatchResult, src: BattleSource) => void; showHints: boolean; emotes: number[] },
  ) {
    const ui = document.getElementById('ui')!;
    this.root = h('div.battle');
    ui.appendChild(this.root);
    this.view = new BattleView(r, src.world.map, this.root);
    this.view.localId = src.localId;
    this.view.localTeam = src.localTeam;
    this.view.showdown = src.mode === 'showdown';
    this.input = new Input(this.root);
    this.input.playerScreen = () => {
      const f = src.world.findById(src.localId);
      if (!f) return { x: innerWidth / 2, y: innerHeight / 2 };
      const vec = new THREE.Vector3(f.x, 0.7, f.y).project(this.view.camera);
      return { x: (vec.x * 0.5 + 0.5) * innerWidth, y: (-vec.y * 0.5 + 0.5) * innerHeight };
    };
    this.hud = new Hud(this.root, this.input, src.mode, opts.showHints);
    this.hud.unlockedEmotes = opts.emotes;
    this.hud.onPause = () => this.togglePause();
    if (src.mode === 'training' && !src.cfg.tutorial) this.hud.onExit = () => this.leave();
    if (src.cfg.tutorial) this.hud.onSkip = () => this.leave();
    this.input.onPause = () => this.togglePause();
    this.view.snapCamera(src.world);
    music.play('battle');
  }

  private leave() {
    this.src.quit();
  }

  private togglePause() {
    if (this.ended) return;
    if (this.pauseEl) { this.pauseEl.remove(); this.pauseEl = null; if (this.src instanceof LocalSource && this.src.canPause) this.src.paused = false; return; }
    if (this.src instanceof LocalSource && this.src.canPause) this.src.paused = true;
    this.input.clear();
    const close = () => this.togglePause();
    const training = this.src.mode === 'training';
    const card = h('div.pause-card',
      h('div.m-head', icon('pause', 'a'), h('div.m-title', 'Пауза')),
      this.src.canPause ? null : h('div.pause-note', icon('timer'), 'Бой с друзьями не останавливается'),
      btn('Продолжить', close, 'lime lg pause-go'),
      h('div.pause-row',
        btn([icon('gear'), 'Настройки'], () => this.quickSettings(), 'paper'),
        btn([icon('exit'), 'Выйти'], () => confirmBox(training ? 'Выйти с Полигона?' : 'Выйти из боя?', training ? 'Вернёмся в меню.' : 'Бой засчитается как поражение.', 'Выйти', () => { this.togglePause(); this.leave(); },
          { no: 'Остаться', danger: !training, glyph: 'exit', yesCls: training ? 'sky' : 'red' }), 'paper danger-text'),
      ),
    );
    this.pauseEl = h('div.pause-back.no-aim', card);
    this.root.appendChild(this.pauseEl);
  }

  /** Быстрые настройки в паузе: звук, музыка, вибрация, графика. */
  private quickSettings() {
    modal(h('div.col.quick-set', { style: 'align-items:stretch' }, h('div.m-title', 'Настройки'), ...soundRows({ r: this.r })), { cls: 'wide', top: true });
  }

  private soundFor(events: SimEvent[]) {
    const w = this.src.world;
    const me = w.findById(this.src.localId);
    const att = (x: number, y: number) => (me ? Math.max(0.12, Math.min(1, 1.15 - Math.hypot(me.x - x, me.y - y) / 13)) : 0.6);
    for (const e of events) {
      switch (e.t) {
        case 'shot': {
          const vol = att(e.x, e.y);
          if (e.heroId === 'smile_helper') { sfx('shoot_smile', { pitch: 1.6, vol: vol * 0.35 }); break; }
          const f = w.findById(e.id);
          const pitch = f ? getSkin(f.heroId, f.skinId).sfxPitch ?? 1 : 1;
          let name: SfxName = 'shoot_robot';
          if (e.heroId === 'smile') name = e.sup ? 'helpers' : 'shoot_smile';
          else if (e.heroId === 'bacteria') name = 'shoot_germ';
          else if (e.heroId === 'robo_sniper') name = 'laser';
          else if (e.heroId === 'robo_tank') name = e.sup ? 'dash' : 'punch';
          else if (e.heroId === 'lion') name = e.sup ? 'roar' : 'claw';
          else if (e.heroId === 'stoptime') name = e.sup ? 'clock' : 'throw_ball';
          else if (e.heroId === 'miner') name = e.sup ? 'dash' : 'pickaxe';
          if (e.sup) sfx('super', { vol, pitch });
          sfx(name, { vol, pitch: e.sup && e.heroId === 'bacteria' ? pitch * 0.6 : pitch });
          if (e.id === this.src.localId && e.sup) audio.vibrate(40);
          break;
        }
        case 'hit':
          if (e.id === this.src.localId) { sfx('hurt'); audio.vibrate(25); } else sfx('hit', { vol: att(e.x, e.y) });
          break;
        case 'death': {
          const f = w.findById(e.id);
          const n: SfxName = f?.heroId === 'smile' ? 'deflate' : f?.heroId === 'bacteria' ? 'splat' : f?.heroId === 'lion' ? 'roar' : f?.heroId === 'stoptime' ? 'spring' : 'death';
          sfx(n, { vol: att(e.x, e.y), pitch: n === 'roar' ? 0.7 : 1 });
          if (e.id === this.src.localId) audio.vibrate([60, 40, 60]);
          break;
        }
        case 'tile': sfx('crate', { vol: att(e.tx, e.ty) }); break;
        case 'impact':
          if (e.kind === 'claw_hit') sfx('claw', { vol: att(e.x, e.y), pitch: 0.9 + Math.random() * 0.2 });
          else if (e.kind === 'lion_slam' || e.kind === 'miner_slam') { sfx('slam', { vol: att(e.x, e.y) }); if (this.near(e.x, e.y)) audio.vibrate(50); }
          else if (e.kind === 'pickaxe') sfx('clink', { vol: att(e.x, e.y) });
          break;
        case 'pickup': if (e.id === this.src.localId) sfx(e.kind === 'gem' ? 'gem' : 'cube'); else sfx(e.kind === 'gem' ? 'gem' : 'cube', { vol: att(e.x, e.y) * 0.5 }); break;
        case 'infect': sfx('infect', { vol: att(0, 0) }); break;
        case 'cure': sfx('sneeze', { vol: 0.8 }); break;
        case 'minion': if (!e.on) sfx('pop', { vol: att(e.x, e.y) }); break;
        case 'ready': if (e.id === this.src.localId) { sfx('super_ready'); audio.vibrate(20); } break;
        case 'announce': sfx('announce'); this.hud.showAnnounce(e.text); break;
        case 'spawn': if (e.id === this.src.localId && w.time > 1) sfx('respawn'); break;
        case 'emote': sfx('emote', { vol: 0.6 }); break;
        case 'timestop': sfx('timestop'); audio.vibrate([30, 30, 30]); break;
        case 'gem': sfx('tick', { vol: 0.3 }); break;
      }
    }
  }

  private near(x: number, y: number) {
    const me = this.src.world.findById(this.src.localId);
    return !!me && Math.hypot(me.x - x, me.y - y) < 2.5;
  }

  /** Кадр. Возвращает false, когда экран можно закрывать. */
  frame(dt: number) {
    const src = this.src;
    this.input.pollGamepad();
    const events = src.update(dt, () => this.input.sample());
    const w = src.world;
    // у друга в сетевой игре свой боец становится известен только с первым снимком от хоста
    if (this.view.localId !== src.localId) {
      this.view.localId = src.localId;
      this.view.localTeam = src.localTeam;
      this.view.snapCamera(w);
    }
    this.view.localTeam = src.localTeam;
    this.view.onEvents(events, w);
    this.soundFor(events);
    // наблюдаем за союзником, если выбиты
    const me = w.findById(src.localId);
    if (me && !me.alive) {
      const ally = w.fighters.find((f) => f.alive && f.team === me.team && f.id !== me.id);
      this.view.spectateId = ally?.id ?? 0;
    } else this.view.spectateId = 0;
    this.view.sync(w, src.alpha, dt);
    // прицел
    const aim = this.input.aim;
    if (aim && me?.alive) {
      const def = getHero(me.heroId);
      const ai = aim.kind === 'super' ? def.superAim : def.attackAim;
      if (aim.kind === 'super' && me.superCharge < 1) this.view.setAim(null, w);
      else this.view.setAim({ shape: ai.shape, range: ai.range, width: ai.width, angle: aim.angle, isSuper: aim.kind === 'super', dist: aim.power * ai.range }, w);
    } else this.view.setAim(null, w);
    const hud = src.hud();
    this.view.setMark(hud.markX >= 0 ? { x: hud.markX, y: hud.markY } : null);
    const ts = w.timeStopped ? w.timeStop! : null;
    this.hud.update(hud, {
      ammo: me?.ammo ?? 0, superCharge: me?.superCharge ?? 0, alive: !!me?.alive, respawnIn: src.respawnIn(),
      infected: !!me && w.time < me.infectedUntil, infectLeft: me ? me.infectedUntil - w.time : 0,
      hpFrac: me ? me.hp / me.maxHp : 1, cubes: me?.cubes ?? 0, heroColor: '#ffd23f',
      timeStop: ts ? ts.until - w.time : 0, timeStopMine: !!ts && !!me && w.effTeam(me) === ts.team,
    }, src.localTeam);
    this.view.render();
    // конец боя
    const fail = src.failure();
    const res = src.result();
    if ((res || fail) && !this.ended) {
      this.ended = true;
      this.input.enabled = false;
      this.input.clear();
      this.pauseEl?.remove();
      const won = res && res.winnerTeam === src.localTeam;
      let text = fail || 'Бой окончен';
      if (res && !fail) {
        if (res.mode === 'showdown') { const pl = res.teamPlace?.[src.localTeam] ?? 0; text = pl === 1 ? 'ПОБЕДА!' : `${pl}-е место`; }
        else if (res.mode === 'training') text = res.reason === 'quit' ? '' : 'Обучение пройдено!';
        else text = res.winnerTeam === null ? 'НИЧЬЯ' : won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
      }
      if (res?.reason === 'quit') text = '';
      this.hud.setBanner(text, won || text.startsWith('1-') || text === 'ПОБЕДА!' ? 'win' : 'lose');
      if (text) sfx(won || text === 'ПОБЕДА!' || text.startsWith('Обучение') ? 'win' : 'lose');
      music.stop();
      this.endTimer = res?.reason === 'quit' ? 0.05 : 2.6;
    }
    if (this.ended) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        const r = res ?? { mode: src.mode, winnerTeam: null, starPlayerId: src.localId, duration: w.time, reason: 'host_left' as const };
        this.opts.onEnd(r, src);
        return false;
      }
    }
    return true;
  }

  dispose() {
    this.view.dispose();
    this.hud.dispose();
    this.input.dispose();
    this.root.remove();
    this.src.dispose();
  }
}
