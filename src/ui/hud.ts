// HUD боя: джойстики, кнопки атаки/супера, счёт режима, таймеры, надписи.
import type { Input } from '../core/input';
import type { ModeId } from '../maps/types';
import type { ModeHud } from '../modes/types';
import { EMOTE_LIST } from '../render/battleView';
import { btn, fmtTime, h } from './dom';

export interface HudSelf {
  ammo: number;
  superCharge: number;
  alive: boolean;
  respawnIn: number;
  infected: boolean;
  heroColor: string;
  /** Сколько ещё стоит остановленное время (0 — идёт) и остановила ли его своя команда. */
  timeStop?: number;
  timeStopMine?: boolean;
}

export class Hud {
  root: HTMLElement;
  private top: HTMLElement;
  private banner: HTMLElement;
  private announce: HTMLElement;
  private tip: HTMLElement;
  private dead: HTMLElement;
  private haze: HTMLElement;
  private timeFx: HTMLElement;
  private timeLabel: HTMLElement;
  private moveBase: HTMLElement;
  private moveKnob: HTMLElement;
  private atk: HTMLElement;
  private atkKnob: HTMLElement;
  private sup: HTMLElement;
  private supKnob: HTMLElement;
  private supFill: HTMLElement;
  private ammoBar: HTMLElement;
  private hint: HTMLElement;
  private emotePanel: HTMLElement | null = null;
  private countdown: HTMLElement;
  private lastTop = '';
  private announceTimer = 0;
  unlockedEmotes: number[] = [0, 1, 2, 3];
  onPause: () => void = () => {};
  onExit: (() => void) | null = null;

  constructor(parent: HTMLElement, private input: Input, private mode: ModeId, showHints: boolean) {
    this.root = h('div.hud');
    this.top = h('div.hud-top');
    this.banner = h('div.hud-banner');
    this.announce = h('div.hud-announce');
    this.countdown = h('div.hud-countdown');
    this.tip = h('div.hud-tip');
    this.dead = h('div.hud-dead');
    this.haze = h('div.haze');
    this.timeFx = h('div.timestop-fx');
    this.timeLabel = h('div.hud-timestop');
    this.moveBase = h('div.stick.stick-move', this.moveKnob = h('div.knob'));
    this.atk = h('div.stick.stick-attack', this.atkKnob = h('div.knob', h('span.ico', '✊')));
    this.supFill = h('div.sup-fill');
    this.sup = h('div.stick.stick-super', this.supFill, this.supKnob = h('div.knob', h('span.ico', '★')));
    this.ammoBar = h('div.hud-ammo', h('i'), h('i'), h('i'));
    const pause = btn('Ⅱ', () => this.onPause(), 'btn-icon', { class: 'hud-pause no-aim' });
    const emote = btn('😀', () => this.toggleEmotes(), 'btn-icon', { class: 'hud-emote no-aim' });
    this.hint = h('div.hud-hint', 'WASD — бег · Мышь — прицел · ЛКМ — атака · ПКМ или E — супер · Пробел — автоатака · T — эмоция · Esc — пауза');
    this.hint.style.display = showHints && input.device === 'desktop' ? '' : 'none';
    this.root.append(this.haze, this.timeFx, this.timeLabel, this.top, this.countdown, this.announce, this.banner, this.tip, this.dead, this.moveBase, this.atk, this.sup, this.ammoBar, pause, emote, this.hint);
    if (mode === 'training') {
      const exit = btn('Выйти', () => this.onExit?.(), 'btn-red', { class: 'hud-exit no-aim' });
      this.root.appendChild(exit);
    }
    parent.appendChild(this.root);
    input.onEmoteKey = () => this.toggleEmotes();
    input.onDevice = (d) => {
      this.root.dataset.device = d;
      this.hint.style.display = showHints && d === 'desktop' ? '' : 'none';
      this.layout();
    };
    this.root.dataset.device = input.device;
    requestAnimationFrame(() => this.layout());
    window.addEventListener('resize', this.layout);
  }

  layout = () => {
    const z = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * 0.75 };
    };
    this.input.zones.attack = z(this.atk);
    this.input.zones.super = z(this.sup);
  };

  private toggleEmotes() {
    if (this.emotePanel) { this.emotePanel.remove(); this.emotePanel = null; return; }
    this.emotePanel = h('div.emote-panel.no-aim', ...this.unlockedEmotes.map((i) => btn(EMOTE_LIST[i], () => {
      this.input.emote(i);
      this.emotePanel?.remove(); this.emotePanel = null;
    }, 'btn-emote')));
    this.root.appendChild(this.emotePanel);
  }

  showAnnounce(text: string) {
    this.announce.textContent = text;
    this.announce.classList.remove('show');
    void this.announce.offsetWidth;
    this.announce.classList.add('show');
    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => this.announce.classList.remove('show'), 2200);
  }

  setBanner(text: string, cls = '') {
    this.banner.textContent = text;
    this.banner.className = 'hud-banner' + (text ? ' show ' + cls : '');
  }

  update(hud: ModeHud, me: HudSelf, localTeam: number) {
    // джойстики (тач)
    const st = this.input.sticks;
    const place = (base: HTMLElement, knob: HTMLElement, s: typeof st.move, fixed: boolean) => {
      if (s) {
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), R = 60;
        const k = d > R ? R / d : 1;
        if (!fixed) { base.style.left = `${s.ox}px`; base.style.top = `${s.oy}px`; base.classList.add('active'); }
        knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        base.classList.toggle('aiming', s.aiming);
      } else {
        knob.style.transform = '';
        base.classList.remove('active', 'aiming');
      }
    };
    place(this.moveBase, this.moveKnob, st.move, false);
    place(this.atk, this.atkKnob, st.attack, true);
    place(this.sup, this.supKnob, st.super, true);
    // супер заполняется по кругу
    const sc = Math.max(0, Math.min(1, me.superCharge));
    this.supFill.style.background = `conic-gradient(#ffd23f ${sc * 360}deg, rgba(0,0,0,0.35) 0deg)`;
    this.sup.classList.toggle('ready', sc >= 1);
    // патроны (дублируем крупно у кнопки атаки)
    const cells = this.ammoBar.children;
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.min(1, me.ammo - i));
      (cells[i] as HTMLElement).style.setProperty('--k', String(k));
      cells[i].classList.toggle('full', k >= 1);
    }
    this.atk.classList.toggle('empty', me.ammo < 1);
    this.haze.classList.toggle('show', me.infected);
    // остановленное время: сиреневая рамка и обратный отсчёт
    const ts = me.timeStop ?? 0;
    this.timeFx.classList.toggle('show', ts > 0);
    this.timeLabel.classList.toggle('show', ts > 0);
    if (ts > 0) {
      const txt = `⏱ ${me.timeStopMine ? 'Время стоит!' : 'Ты замер!'} ${Math.ceil(ts)}`;
      if (this.timeLabel.textContent !== txt) this.timeLabel.textContent = txt;
    }
    // смерть
    if (!me.alive) {
      this.dead.style.display = '';
      this.dead.textContent = me.respawnIn > 0 ? `Воскрешение через ${Math.ceil(me.respawnIn)}…` : this.mode === 'knockout' ? 'Ты выбит! Смотрим за командой…' : 'Ты выбит!';
    } else this.dead.style.display = 'none';
    // счёт режима
    const enemyTeam = localTeam === 0 ? 1 : 0;
    let html = '';
    if (this.mode === 'gemgrab') {
      const mine = hud.score[localTeam] ?? 0, theirs = hud.score[enemyTeam] ?? 0;
      html = `<div class="score blue"><span class="mgem"></span>${mine}</div><div class="timer">${fmtTime(hud.timer)}</div><div class="score red"><span class="mgem"></span>${theirs}</div>`;
      if (hud.countdown > 0) {
        this.countdown.textContent = String(Math.ceil(hud.countdown));
        this.countdown.className = 'hud-countdown show ' + (hud.countdownTeam === localTeam ? 'good' : 'bad');
      } else this.countdown.className = 'hud-countdown';
    } else if (this.mode === 'knockout') {
      const pips = (n: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, 2 - n));
      const aliveB = Math.floor(hud.alive / 10), aliveR = hud.alive % 10;
      const myAlive = localTeam === 0 ? aliveB : aliveR, thAlive = localTeam === 0 ? aliveR : aliveB;
      html = `<div class="score blue">${pips(hud.score[localTeam])}<small>${'🙂'.repeat(myAlive)}</small></div><div class="timer">${hud.timer > 0 ? fmtTime(hud.timer) : '☠️'}<small>Раунд ${hud.round}</small></div><div class="score red"><small>${'🤖'.repeat(thAlive)}</small>${pips(hud.score[enemyTeam])}</div>`;
      this.setBanner(hud.banner, 'round');
    } else if (this.mode === 'showdown') {
      html = `<div class="timer alive">👥 ${hud.alive}</div>${hud.timer > 0 ? `<div class="timer small">☠️ через ${fmtTime(hud.timer)}</div>` : '<div class="timer small poison">☠️ Облако!</div>'}`;
    } else if (hud.tip) {
      html = '';
    } else {
      html = `<div class="timer dps">Урон/сек: <b>${hud.dps}</b></div><div class="timer small">Всего: ${hud.total}</div>`;
    }
    if (html !== this.lastTop) { this.top.innerHTML = html; this.lastTop = html; }
    // обучение
    if (hud.tip) { this.tip.textContent = hud.tip; this.tip.className = 'hud-tip show step' + hud.round; } else this.tip.className = 'hud-tip';
  }

  dispose() {
    window.removeEventListener('resize', this.layout);
    this.root.remove();
  }
}
