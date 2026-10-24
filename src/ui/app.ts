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
import { icon, installIcons } from './icons';
import { logoFull, logoMark } from './logo';
import { SCREENS, type Screen } from './screens';
import { boxOpening } from './screens/boxes';
import { firstRun } from './screens/firstRun';
import { lobbyScreen } from './screens/lobby';
import { matchmaking, versus } from './screens/matchmaking';
import { resultsScreen } from './screens/results';
import { whatsNew } from './screens/settings';
import { crashScreen, iosHint, watchOnline } from './screens/system';

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
  'Метеорчик раскалывается от тапов. Чем больше тапов — тем ярче свет.',
  'Стоп-Тайм замораживает даже пули. Беги, пока часы стоят!',
  'Лев прыгает прямо через стены. Стены не в восторге.',
  'Шахтёр кидает кирки дугой — ящик тебя не спасёт.',
];

export class App implements Nav {
  r!: GameRenderer;
  showcase = new Showcase();
  ui = document.getElementById('ui')!;
  /** Слой под 3D-холстом: клякса и подиум под героем. */
  backdrop = document.getElementById('backdrop')!;
  layer = h('div.layer');
  private current: Screen | null = null;
  private currentName = '';
  battle: BattleScreen | null = null;
  /** Где рисовать 3D-героя меню (область экрана). */
  stage: HTMLElement | null = null;
  /** Активная комната с друзьями (если есть). */
  room: any = null;
  private bootEl = document.getElementById('boot')!;

  async boot() {
    installIcons();
    applyMotionSetting();
    const fill = document.getElementById('boot-fill')!;
    const pct = document.getElementById('boot-pct');
    const tip = document.getElementById('boot-tip')!;
    const ver = document.getElementById('boot-ver');
    if (ver) ver.textContent = 'версия ' + GAME_VERSION;
    const mark = document.getElementById('boot-mark');
    if (mark) mark.innerHTML = logoMark();
    let tipN = Math.floor(Math.random() * TIPS.length);
    tip.textContent = TIPS[tipN];
    const tipTimer = setInterval(() => {
      tip.style.opacity = '0';
      setTimeout(() => { tipN = (tipN + 1) % TIPS.length; tip.textContent = TIPS[tipN]; tip.style.opacity = '1'; }, 250);
    }, 3000);
    const progress = (k: number) => {
      fill.style.width = `${Math.round(k * 100)}%`;
      if (pct) pct.textContent = (k < 0.3 ? 'Готовим арену… ' : k < 0.95 ? 'Будим героев… ' : 'Почти готово… ') + Math.round(k * 100) + '%';
    };
    const pause = () => new Promise((res) => setTimeout(res, 30));
    progress(0.05);
    this.r = new GameRenderer(document.getElementById('game') as HTMLCanvasElement);
    // аккаунт: сверяемся с облаком, пока грузятся модели (вдруг играли на другом устройстве)
    const sync = this.startCloud();
    const s = store.data;
    audio.sfxVolume = s.settings.sfx; audio.musicVolume = s.settings.music; audio.vibration = s.settings.vibration;
    this.r.setQuality(s.settings.quality);
    await Promise.race([document.fonts?.ready, new Promise((res) => setTimeout(res, 2500))]);
    const logo = document.getElementById('boot-logo');
    if (logo) logo.innerHTML = logoFull();
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
    this.ui.appendChild(h('div.rotate',
      h('div.rot-art', h('div.phone', h('div.phone-mark', { html: logoMark() })), icon('refresh', 'b', 'rot-arrow')),
      h('div.r-title', 'Поверни телефон'),
      h('div.r-sub', 'Игра — только лёжа: так видно всю арену и обе руки на месте.'),
    ));
    this.installUnlock();
    watchOnline();
    startLoop((dt, now) => this.frame(dt, now));
    setTimeout(() => { this.bootEl.classList.add('hide'); setTimeout(() => this.bootEl.remove(), 300); }, 150);
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
      applyMotionSetting();
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
    if (s.lastVersion && s.lastVersion !== GAME_VERSION) whatsNew(this);
    if (s.lastVersion !== GAME_VERSION) { s.lastVersion = GAME_VERSION; store.commit(); }
    if (roomCode) this.open('room', { join: roomCode });
    else iosHint();
  }

  private showFirstRun(roomCode: string | null) {
    this.setScreen('first', firstRun(this, () => {
      store.data.lastVersion = GAME_VERSION;
      store.commit();
      this.toLobby();
      if (roomCode) this.open('room', { join: roomCode });
      else iosHint();
    }));
  }

  // ───────────── экраны ─────────────
  setScreen(name: string, scr: Screen) {
    try { this.current?.dispose?.(); } catch (e) { console.error(e); }
    clear(this.layer);
    clear(this.backdrop);
    this.current = scr;
    this.currentName = name;
    if (scr.back) for (const b of scr.back) this.backdrop.appendChild(b);
    scr.el.classList.add('enter');
    this.layer.appendChild(scr.el);
    setTimeout(() => scr.el.classList.remove('enter'), 400);
    this.stage = scr.stage ?? null;
    document.body.classList.toggle('menu-bg', !this.battle);
    scr.onShow?.();
  }

  portrait(heroId: string, skinId = 'default', team: 'blue' | 'red' | 'orange' = 'blue') {
    return renderPortrait(this.r.gl, heroId, skinId, team);
  }

  /** Крупный портрет (для полноэкранных наград). */
  bigPortrait(heroId: string, skinId = 'default') {
    return renderPortrait(this.r.gl, heroId, skinId, 'blue', 512);
  }

  toLobby() {
    music.play('lobby');
    this.setScreen('lobby', lobbyScreen(this));
  }

  open(name: string, arg?: any) {
    if (name === 'lobby') return this.toLobby();
    const make = SCREENS[name];
    if (!make) { toast('Этот раздел ещё в пути'); return; }
    sfx('whoosh');
    this.setScreen(name, make(this, arg));
  }

  back() { sfx('back'); this.toLobby(); }

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
    try { this.current?.dispose?.(); } catch (e) { console.error(e); }
    clear(this.layer);
    clear(this.backdrop);
    this.current = null;
    this.currentName = 'battle';
    this.stage = null;
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
        this.setScreen('gift', boxOpening(this, 'big', () => this.afterRoomOrLobby(), 'Подарок за обучение', gift, true));
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
    this.setScreen('results', resultsScreen(this, res, src, rewards, () => this.afterRoomOrLobby(), () => {
      // «Играть снова»: тот же режим (с друзьями — назад в комнату)
      if (this.room && this.room.alive) this.open('room', { back: true });
      else if (res.mode === 'training') this.toLobby();
      else this.playSolo(res.mode);
    }));
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
    gl.setScissorTest(false);
    gl.setViewport(0, 0, this.r.width, this.r.height);
    gl.clear();
    const st = this.stage;
    if (st && st.isConnected && !document.hidden) {
      const r = st.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        this.showcase.update(dt);
        // область в координатах WebGL (начало — снизу слева)
        const y = this.r.height - r.bottom;
        gl.setViewport(r.left, y, r.width, r.height);
        gl.setScissor(Math.max(0, r.left), Math.max(0, y), r.width, r.height);
        gl.setScissorTest(true);
        this.showcase.render(gl, r.width, r.height);
        gl.setScissorTest(false);
        gl.setViewport(0, 0, this.r.width, this.r.height);
      }
    }
    this.current?.frame?.(dt);
  }

  /** Показать на подиуме героя. ground — цвет кляксы (свет снизу в её тон). */
  showHero(heroId: string, skinId: string, mode: 'idle' | 'win' | 'lose' = 'idle', ground?: string) {
    this.showcase.set([{ heroId, skinId }], mode);
    this.showcase.yaw = 0;
    this.showcase.offsetX = 0;
    this.showcase.fit = 0.8;
    if (ground) this.showcase.setGround(ground);
  }

  /** Крутить героя пальцем; тап — радость. */
  bindSpin(el: HTMLElement) {
    let drag: { x: number; t: number; moved: number } | null = null;
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: performance.now(), moved: 0 }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag.moved += Math.abs(dx);
      this.showcase.yaw += dx * 0.012;
      this.showcase.yawVel = (dx * 0.012) / Math.max(0.008, (performance.now() - drag.t) / 1000);
      drag.x = e.clientX; drag.t = performance.now();
    });
    el.addEventListener('pointerup', () => { if (drag && drag.moved < 6) { this.showcase.cheer(); sfx('emote'); } drag = null; });
    el.addEventListener('pointercancel', () => { drag = null; });
  }

  skinsFor(heroId: string) { return skinsOf(heroId); }

  /** Общая ошибка «Что-то пошло не так» с кнопкой «Обновить». */
  crash() { crashScreen(); }
}

/** «Меньше анимаций»: атрибут на корне документа включает короткие проявления вместо сдвигов. */
export function applyMotionSetting() {
  document.documentElement.toggleAttribute('data-less-motion', !!store.data.settings.lessMotion);
}
