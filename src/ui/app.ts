// Приложение: загрузка, первый запуск, лобби, экраны меню, запуск боёв, результаты.
import { audio, sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { GAME_VERSION } from '../config';
import { startLoop } from '../core/loop';
import { randomSeed } from '../core/rng';
import { playableHeroes } from '../heroes/registry';
import { skinsOf } from '../heroes/skins';
import type { ModeId } from '../maps/types';
import { applyBattle, difficultyFor, ensureDaily, heroProgress, ownsHero, ownsSkin, progressScore, starterGift, type BattleRewards } from '../meta/progress';
import { migrate } from '../meta/save';
import { store } from '../meta/store';
import { cloud } from '../net/cloud';
import { buildLineup, type HumanEntry } from '../modes/lineup';
import { prewarm } from '../render/models';
import { GameRenderer } from '../render/renderer';
import { renderPortrait, Showcase } from '../render/showcase';
import { simplifierReady } from '../render/simplify';
import { Match } from '../sim/match';
import type { MatchConfig, MatchResult } from '../sim/types';
import { BattleScreen, LocalSource, type BattleSource } from './battle';
import type { Nav } from './common';
import { clear, h, toast } from './dom';
import { SCREENS, type Screen } from './screens';
import { boxOpening } from './screens/boxes';
import { firstRun } from './screens/firstRun';
import { lobbyScreen } from './screens/lobby';
import { matchmaking, versus } from './screens/matchmaking';
import { resultsScreen } from './screens/results';
import { whatsNew } from './screens/settings';

const TIPS = [
  'Смайл улыбается даже во сне.',
  'Бактерия моет руки… ой, у неё нет рук для этого!',
  'Роботы-напарники всегда синие. Не стреляй по ним — всё равно не получится.',
  'Спрячься в кусте — враги не увидят тебя, пока не подойдут вплотную.',
  'Заражённый робот 5 секунд воюет за тебя. Потом чихает.',
  'Жёлтая кнопка светится? Жми супер!',
  'Кристаллы роняет каждый, кого выбили. Подбирай!',
  'Ядовитое облако не любит, когда в нём стоят.',
  'Робо-Танк медленный, но обнимается очень больно.',
];

export class App implements Nav {
  r!: GameRenderer;
  showcase = new Showcase();
  ui = document.getElementById('ui')!;
  layer = h('div.layer');
  private current: Screen | null = null;
  private currentName = '';
  battle: BattleScreen | null = null;
  showcaseOn = false;
  /** Активная комната с друзьями (если есть). */
  room: any = null;
  private bootEl = document.getElementById('boot')!;

  async boot() {
    const fill = document.getElementById('boot-fill')!;
    const tip = document.getElementById('boot-tip')!;
    tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    const tipTimer = setInterval(() => (tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]), 2600);
    const progress = (k: number) => (fill.style.width = `${Math.round(k * 100)}%`);
    const pause = () => new Promise((res) => setTimeout(res, 30));
    progress(0.05);
    this.r = new GameRenderer(document.getElementById('game') as HTMLCanvasElement);
    // аккаунт: сверяемся с облаком, пока грузятся модели (вдруг играли на другом устройстве)
    const sync = this.startCloud();
    const s = store.data;
    audio.sfxVolume = s.settings.sfx; audio.musicVolume = s.settings.music; audio.vibration = s.settings.vibration;
    this.r.setQuality(s.settings.quality);
    await Promise.race([document.fonts?.ready, new Promise((res) => setTimeout(res, 2500))]);
    await simplifierReady;
    progress(0.15);
    // модели героев и роботов готовим заранее (бой не будет подтормаживать)
    const list: { heroId: string; skinId: string; team: 'blue' | 'red' | 'orange' }[] = [];
    for (const hd of playableHeroes()) {
      list.push({ heroId: hd.id, skinId: heroProgress(s, hd.id).skin, team: 'blue' });
    }
    for (const id of ['robo_blaster', 'robo_tank', 'robo_sniper']) { list.push({ heroId: id, skinId: 'default', team: 'blue' }); list.push({ heroId: id, skinId: 'default', team: 'red' }); }
    list.push({ heroId: 'robo_dummy', skinId: 'default', team: 'orange' });
    for (let i = 0; i < list.length; i++) {
      prewarm([list[i]]);
      progress(0.15 + (0.7 * (i + 1)) / list.length);
      await pause();
    }
    for (const hd of playableHeroes()) this.portrait(hd.id, heroProgress(s, hd.id).skin);
    await Promise.race([sync, new Promise((res) => setTimeout(res, 4000))]);
    progress(1);
    clearInterval(tipTimer);
    ensureDaily(store.data);
    store.commit();
    this.ui.appendChild(this.layer);
    this.ui.appendChild(h('div.rotate', h('div.phone'), 'Поверни телефон боком!'));
    this.installUnlock();
    startLoop((dt, now) => this.frame(dt, now));
    setTimeout(() => { this.bootEl.classList.add('hide'); setTimeout(() => this.bootEl.remove(), 500); }, 150);
    this.afterBoot();
  }

  /** Облачное сохранение: сверка при запуске, отправка после изменений и перед закрытием игры. */
  private startCloud() {
    store.subscribe(() => cloud.schedulePush());
    const flush = () => cloud.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('online', () => { if (cloud.status === 'error') cloud.schedulePush(500); });
    const score = (data: string) => { try { return progressScore(migrate(JSON.parse(data))); } catch { return -1; } };
    return cloud.attach(() => store.data, (data) => {
      store.replace(migrate(JSON.parse(data)));
      // если сверка закончилась уже в меню — перерисуем его
      if (this.currentName === 'lobby') this.toLobby();
    }, score);
  }

  private installUnlock() {
    const unlock = () => {
      audio.unlock();
      music.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** На телефонах просим полный экран и альбомную ориентацию (где браузер разрешает). */
  requestFullscreen() {
    const d = document.documentElement as any;
    if (document.fullscreenElement || !matchMedia('(pointer: coarse)').matches) return;
    try {
      const p = d.requestFullscreen?.({ navigationUI: 'hide' });
      p?.then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
    } catch { /* не поддерживается */ }
  }

  private afterBoot() {
    const s = store.data;
    const hash = new URLSearchParams(location.hash.slice(1));
    const roomCode = hash.get('room');
    if (!s.nick || !s.tutorialDone) {
      this.showFirstRun(roomCode);
      return;
    }
    this.toLobby();
    if (s.lastVersion && s.lastVersion !== GAME_VERSION) whatsNew();
    if (s.lastVersion !== GAME_VERSION) { s.lastVersion = GAME_VERSION; store.commit(); }
    if (roomCode) this.open('room', { join: roomCode });
  }

  private showFirstRun(roomCode: string | null) {
    this.setScreen('first', firstRun(this, () => {
      store.data.lastVersion = GAME_VERSION;
      store.commit();
      this.toLobby();
      if (roomCode) this.open('room', { join: roomCode });
    }));
  }

  // ───────────── экраны ─────────────
  private setScreen(name: string, scr: Screen) {
    this.current?.dispose?.();
    clear(this.layer);
    this.current = scr;
    this.currentName = name;
    this.layer.appendChild(scr.el);
    this.showcaseOn = !!scr.showcase;
    document.body.classList.toggle('menu-bg', !this.battle);
    scr.onShow?.();
  }

  portrait(heroId: string, skinId = 'default', team: 'blue' | 'red' | 'orange' = 'blue') {
    return renderPortrait(this.r.gl, heroId, skinId, team);
  }

  toLobby() {
    music.play('lobby');
    this.setScreen('lobby', lobbyScreen(this));
  }

  open(name: string, arg?: any) {
    if (name === 'lobby') return this.toLobby();
    const make = SCREENS[name];
    if (!make) { toast('Экран не найден'); return; }
    sfx('whoosh');
    this.setScreen(name, make(this, arg));
  }

  back() { this.toLobby(); }

  /** Какой экран сейчас открыт. */
  get screenName() { return this.currentName; }

  refresh() {
    if (this.currentName === 'lobby') this.toLobby();
  }

  // ───────────── бой ─────────────
  selectedLoadout() {
    const s = store.data;
    const heroId = ownsHero(s, s.selectedHero) ? s.selectedHero : 'smile';
    const hp = heroProgress(s, heroId);
    const skinId = ownsSkin(s, heroId, hp.skin) ? hp.skin : 'default';
    return { heroId, skinId, level: hp.level };
  }

  /** Одиночный бой с роботами. */
  playSolo(mode: ModeId) {
    const s = store.data;
    const lo = this.selectedLoadout();
    this.requestFullscreen();
    const human: HumanEntry = { name: s.nick || 'Игрок', heroId: lo.heroId, skinId: lo.skinId, level: lo.level, owner: 'local' };
    const cfg = buildLineup({ mode, humans: [human], difficulty: difficultyFor(s, lo.heroId), seed: randomSeed() });
    this.showcaseOn = false;
    this.setScreen('mm', matchmaking(this, cfg, () => {
      this.setScreen('vs', versus(this, cfg, 'local', () => this.startLocal(cfg)));
    }));
  }

  /** Полигон: любой герой на максимальном уровне и любой скин. */
  playTraining(heroId: string, skinId: string, tutorial = false) {
    this.requestFullscreen();
    const s = store.data;
    const cfg = buildLineup({ mode: 'training', humans: [{ name: s.nick || 'Игрок', heroId, skinId, level: tutorial ? 1 : 9, owner: 'local' }], difficulty: 'normal', seed: randomSeed(), tutorial });
    this.startLocal(cfg);
  }

  startLocal(cfg: MatchConfig) {
    const match = new Match(cfg);
    const me = match.fighterOf('local')!;
    this.startBattle(new LocalSource(match, me.id));
  }

  startBattle(src: BattleSource) {
    this.current?.dispose?.();
    clear(this.layer);
    this.current = null;
    this.currentName = 'battle';
    this.showcaseOn = false;
    document.body.classList.remove('menu-bg');
    const s = store.data;
    this.battle = new BattleScreen(this.r, src, {
      onEnd: (res, source) => this.onBattleEnd(res, source),
      showHints: s.settings.hints,
      emotes: s.emotes,
    });
  }

  private onBattleEnd(res: MatchResult, src: BattleSource) {
    const s = store.data;
    const w = src.world;
    const me = w.findById(src.localId);
    this.battle?.dispose();
    this.battle = null;
    document.body.classList.add('menu-bg');
    // полигон: наград нет; после первого обучения — подарочный ящик
    if (res.mode === 'training') {
      const first = !s.tutorialDone;
      s.tutorialDone = true;
      if (first && !s.giftBoxGiven) {
        s.giftBoxGiven = true;
        const gift = starterGift(s);
        store.commit();
        this.setScreen('gift', boxOpening(this, 'big', () => this.afterRoomOrLobby(), 'Подарок за обучение!', gift));
        return;
      }
      store.commit();
      this.afterRoomOrLobby();
      return;
    }
    const stats = me ? { damage: me.stats.damage, kills: me.stats.kills, gems: me.stats.gems, supers: me.stats.supers, cubes: me.stats.cubes } : { damage: 0, kills: 0, gems: 0, supers: 0, cubes: 0 };
    let rewards: BattleRewards | null = null;
    if (me) {
      rewards = applyBattle(s, {
        mode: res.mode, heroId: me.heroId, result: res, myTeam: src.localTeam, teamShowdown: !!src.cfg.teamShowdown,
        stats, isStar: res.starPlayerId === me.id,
      });
      store.commit();
    }
    if (res.reason === 'quit') { this.afterRoomOrLobby(); return; }
    this.setScreen('results', resultsScreen(this, res, src, rewards, () => this.afterRoomOrLobby()));
  }

  private afterRoomOrLobby() {
    if (this.room && this.room.alive) this.open('room', { back: true });
    else this.toLobby();
  }

  // ───────────── кадр ─────────────
  private frame(dt: number, now: number) {
    this.r.track(dt, now);
    if (this.battle) {
      this.battle.frame(dt);
      return;
    }
    const gl = this.r.gl;
    if (this.showcaseOn) {
      this.showcase.update(dt);
      gl.setViewport(0, 0, this.r.width, this.r.height);
      this.showcase.render(gl, this.r.width, this.r.height);
    } else {
      gl.clear();
    }
    this.current?.frame?.(dt);
  }

  /** Показать на подиуме выбранного героя. */
  showHero(heroId: string, skinId: string, mode: 'idle' | 'win' | 'lose' = 'idle') {
    this.showcase.set([{ heroId, skinId }], mode);
  }

  skinsFor(heroId: string) { return skinsOf(heroId); }
}
