// HUD боя: джойстики, кнопки атаки и супера, верх экрана для каждого режима, события и обучение.
// Читается краем глаза: пауза и эмоции — вне зоны больших пальцев, свой/союзник/враг — цвет + форма.
import type { Input } from '../core/input';
import type { ModeId } from '../maps/types';
import { EMOTES } from '../meta/economy';
import type { ModeHud } from '../modes/types';
import { btn, fmtTime, h } from './dom';
import { icon, iconHtml, sideShapeHtml } from './icons';

export interface HudSelf {
  ammo: number;
  superCharge: number;
  alive: boolean;
  respawnIn: number;
  infected: boolean;
  /** Сколько ещё длится заражение (секунд). */
  infectLeft?: number;
  /** Здоровье от 0 до 1 — для виньетки «мало здоровья». */
  hpFrac?: number;
  cubes?: number;
  heroColor: string;
  /** Сколько ещё стоит остановленное время (0 — идёт) и остановила ли его своя команда. */
  timeStop?: number;
  timeStopMine?: boolean;
}

/** Шаги обучения: что показать и куда смотреть. */
const TUTORIAL = [
  { title: 'Двигайся', touch: 'Коснись слева и веди пальцем — герой побежит туда же. Дойди до звезды.', desk: 'WASD или стрелки — бег. Дойди до звезды.', spot: 'move' },
  { title: 'Стреляй', touch: 'Тап — выстрел в ближайшего врага. Оттяни кнопку — целься сам.', desk: 'Наведи мышь и нажми ЛКМ — выстрел. Сбей робота-мишень.', spot: 'attack' },
  { title: 'Супер!', touch: 'Кольцо заполнилось. Жми жёлтую кнопку — это твой особый удар.', desk: 'Кольцо заполнилось. ПКМ или E — супер, твой особый удар.', spot: 'super' },
  { title: 'Ты готов к бою!', touch: 'Отлично! Сейчас откроем подарок за обучение.', desk: 'Отлично! Сейчас откроем подарок за обучение.', spot: '' },
] as const;

export class Hud {
  root: HTMLElement;
  private top: HTMLElement;
  private banner: HTMLElement;
  private announce: HTMLElement;
  private lead: HTMLElement;
  private dead: HTMLElement;
  private haze: HTMLElement;
  private lowHp: HTMLElement;
  private timeFx: HTMLElement;
  private statusChip: HTMLElement;
  private moveBase: HTMLElement;
  private moveKnob: HTMLElement;
  private atk: HTMLElement;
  private atkKnob: HTMLElement;
  private sup: HTMLElement;
  private supKnob: HTMLElement;
  private ammoBar: HTMLElement;
  private hint: HTMLElement;
  private tut: HTMLElement | null = null;
  private tutStep = -1;
  private emotePanel: HTMLElement | null = null;
  private lastTop = '';
  private lastLead = '';
  private lastStatus = '';
  private lastDead = '';
  private announceTimer = 0;
  private wasReady = false;
  unlockedEmotes: number[] = [0, 1, 2, 3];
  onPause: () => void = () => {};
  onExit: (() => void) | null = null;
  /** Обучение: «Пропустить». */
  onSkip: (() => void) | null = null;

  constructor(parent: HTMLElement, private input: Input, private mode: ModeId, showHints: boolean) {
    this.root = h('div.hud');
    this.top = h('div.hud-top');
    this.banner = h('div.hud-banner');
    this.announce = h('div.hud-announce');
    this.lead = h('div.hud-lead');
    this.dead = h('div.hud-dead');
    this.haze = h('div.haze');
    this.lowHp = h('div.lowhp');
    this.timeFx = h('div.timestop-fx');
    this.statusChip = h('div.hud-status');
    this.moveBase = h('div.stick.stick-move', this.moveKnob = h('div.knob'));
    this.atk = h('div.stick.stick-attack', this.atkKnob = h('div.knob', icon('attack')));
    this.sup = h('div.stick.stick-super', this.supKnob = h('div.knob', icon('super')));
    this.ammoBar = h('div.hud-ammo', h('i'), h('i'), h('i'));
    const pause = btn(icon('pause'), () => this.onPause(), 'hud-pause no-aim', { 'aria-label': 'Пауза' });
    const emote = btn(icon('emote'), () => this.toggleEmotes(), 'hud-emote no-aim', { 'aria-label': 'Эмоции' });
    this.hint = h('div.hud-hint', 'WASD — бег · Мышь — прицел · ЛКМ — атака · ПКМ или E — супер · Пробел — автоатака · T — эмоция · Esc — пауза');
    this.hint.style.display = showHints && input.device === 'desktop' ? '' : 'none';
    this.root.append(this.haze, this.lowHp, this.timeFx, this.top, this.lead, this.statusChip, this.announce, this.banner, this.dead,
      this.moveBase, h('div.atk-col', this.ammoBar, this.atk), this.sup, pause, emote, this.hint);
    parent.appendChild(this.root);
    input.onEmoteKey = () => this.toggleEmotes();
    input.onDevice = (d) => {
      this.root.dataset.device = d;
      this.hint.style.display = showHints && d === 'desktop' ? '' : 'none';
      this.layout();
      if (this.tut) this.paintTutorial(this.tutStep, true);
    };
    this.root.dataset.device = input.device;
    requestAnimationFrame(() => this.layout());
    window.addEventListener('resize', this.layout);
    // «В БОЙ!» в начале
    setTimeout(() => this.showAnnounce('В БОЙ!', 'go'), 200);
  }

  layout = () => {
    const z = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * 0.75 };
    };
    this.input.zones.attack = z(this.atk);
    this.input.zones.super = z(this.sup);
  };

  /** Кнопка «Выйти» на Полигоне: ставит её в верхнюю группу. */
  private exitBtn() { return btn([icon('exit'), 'Выйти'], () => this.onExit?.(), 'sky xs hud-exit no-aim'); }

  private toggleEmotes() {
    if (this.emotePanel) { this.emotePanel.remove(); this.emotePanel = null; return; }
    this.emotePanel = h('div.emote-panel.no-aim', ...this.unlockedEmotes.map((i) => {
      const e = EMOTES[i];
      if (!e) return null;
      const b = h('button.emote-btn', { 'aria-label': e.name }, icon(e.icon));
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.input.emote(i); this.emotePanel?.remove(); this.emotePanel = null; });
      return b;
    }));
    this.root.appendChild(this.emotePanel);
  }

  /** Объявление по центру: «Кристаллы у синих!», «Раунд 2!», «Облако сжимается!». */
  showAnnounce(text: string, cls = '') {
    this.announce.textContent = text;
    this.announce.className = 'hud-announce ' + cls;
    void this.announce.offsetWidth;
    this.announce.classList.add('show');
    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => this.announce.classList.remove('show'), 2200);
  }

  /** Крупная надпись: «ПОБЕДА!», «ПОРАЖЕНИЕ», «Раунд 2». */
  setBanner(text: string, cls = '') {
    if (this.banner.dataset.t === text + cls) return;
    this.banner.dataset.t = text + cls;
    this.banner.replaceChildren(h('span', text));
    this.banner.className = 'hud-banner' + (text ? ' show ' + cls : '');
  }

  /** Обучение: окно вокруг нужного места, палец, подсказка и «Пропустить». */
  private paintTutorial(step: number, force = false) {
    if (step === this.tutStep && !force) return;
    this.tutStep = step;
    this.tut?.remove();
    const t = TUTORIAL[Math.max(0, Math.min(TUTORIAL.length - 1, step - 1))];
    const touch = this.input.device === 'touch';
    const target = !touch || !t.spot ? null : t.spot === 'move' ? null : t.spot === 'attack' ? this.atk : this.sup;
    let spot: HTMLElement | null = null;
    if (touch && t.spot) {
      const r = target ? target.getBoundingClientRect() : null;
      const size = target ? r!.width * 1.45 : Math.min(innerHeight * 0.42, 190);
      const cx = r ? r.left + r.width / 2 : Math.max(110, innerWidth * 0.14);
      const cy = r ? r.top + r.height / 2 : innerHeight - size * 0.55;
      spot = h('div.tut-spot', { style: { left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px` } },
        h('div.tut-finger' + (t.spot === 'move' ? '.arrows' : ''), t.spot === 'move' ? [icon('chev', 'b', 'ar r'), icon('chev', 'b', 'ar l'), icon('chev', 'b', 'ar u')] : null));
    }
    const dots = h('div.tut-dots', ...[1, 2, 3].map((i) => h('i' + (i <= step ? '.on' : ''))));
    const bubble = h('div.tut-bubble.' + (t.spot || 'center'),
      h('div.tut-head', h('span', step <= 3 ? `Шаг ${step} из 3` : 'Готово'), dots),
      h('div.tut-title.ds', t.title),
      h('div.tut-text', touch ? t.touch : t.desk));
    const skip = this.onSkip && step <= 3 ? btn(['Пропустить', icon('chev')], () => this.onSkip?.(), 'paper xs tut-skip no-aim') : null;
    this.tut = h('div.tut' + (spot ? '' : '.nospot'), spot, bubble, skip);
    this.root.appendChild(this.tut);
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
        if (!fixed) { base.style.left = ''; base.style.top = ''; }
        base.classList.remove('active', 'aiming');
      }
    };
    place(this.moveBase, this.moveKnob, st.move, false);
    place(this.atk, this.atkKnob, st.attack, true);
    place(this.sup, this.supKnob, st.super, true);
    // кольцо супера: в момент «заряжено» — вспышка, дальше ровное свечение
    const sc = Math.max(0, Math.min(1, me.superCharge));
    this.sup.style.setProperty('--p', `${sc * 100}%`);
    const ready = sc >= 1;
    if (ready !== this.wasReady) {
      this.sup.classList.toggle('ready', ready);
      if (ready) { this.sup.classList.remove('flash'); void this.sup.offsetWidth; this.sup.classList.add('flash'); }
      this.wasReady = ready;
    }
    // патроны у кнопки атаки
    const cells = this.ammoBar.children;
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.min(1, me.ammo - i));
      (cells[i] as HTMLElement).style.setProperty('--a', String(k));
      cells[i].classList.toggle('full', k >= 1);
    }
    this.atk.classList.toggle('empty', me.ammo < 1);
    // события: заражение, мало здоровья, остановка времени
    this.haze.classList.toggle('show', me.infected);
    this.lowHp.classList.toggle('show', me.alive && (me.hpFrac ?? 1) < 0.35);
    const ts = me.timeStop ?? 0;
    this.timeFx.classList.toggle('show', ts > 0);
    let status = '';
    if (ts > 0) status = `timestop|${me.timeStopMine ? 'Время стоит' : 'Ты замер'} · ${Math.ceil(ts)}`;
    else if (me.infected) status = `infect|Заражён · ${Math.ceil(me.infectLeft ?? 0)}`;
    if (status !== this.lastStatus) {
      this.lastStatus = status;
      if (status) { const [g, t] = status.split('|'); this.statusChip.innerHTML = iconHtml(g) + `<span>${t}</span>`; this.statusChip.className = 'hud-status show ' + g; }
      else this.statusChip.className = 'hud-status';
    }
    // выбит
    let deadKey = '';
    if (!me.alive) deadKey = me.respawnIn > 0 ? `Вернёшься через ${Math.ceil(me.respawnIn)}` : this.mode === 'knockout' ? 'Смотришь за командой' : this.mode === 'showdown' ? 'Смотри, кто победит' : '';
    if (deadKey !== this.lastDead) {
      this.lastDead = deadKey;
      if (!me.alive) {
        this.dead.innerHTML = `<div class="dead-card">${iconHtml('ko', 'b')}<b>Тебя выбили!</b>${deadKey ? `<span>${deadKey}</span>` : ''}</div>`;
        this.dead.className = 'hud-dead show';
      } else this.dead.className = 'hud-dead';
    }
    if (me.alive && this.dead.classList.contains('show')) this.dead.className = 'hud-dead';
    // верх экрана: свой для каждого режима
    const enemyTeam = localTeam === 0 ? 1 : 0;
    let html = '';
    if (this.mode === 'gemgrab') {
      const mine = hud.score[localTeam] ?? 0, theirs = hud.score[enemyTeam] ?? 0;
      html = `<div class="ht-team blue">${sideShapeHtml('ally', '#fffaf0')}${iconHtml('shard')}<b>${mine}</b></div>` +
        `<div class="ht-timer">${fmtTime(hud.timer)}</div>` +
        `<div class="ht-team red"><b>${theirs}</b>${iconHtml('shard')}${sideShapeHtml('enemy', '#fffaf0')}</div>`;
      const lead = hud.countdown > 0 ? `${hud.countdownTeam === localTeam ? 'blue' : 'red'}|${Math.ceil(hud.countdown)}` : '';
      if (lead !== this.lastLead) {
        this.lastLead = lead;
        if (lead) {
          const [side, n] = lead.split('|');
          this.lead.innerHTML = `<b>${n}</b><span>${side === 'blue' ? 'Синие' : 'Красные'}<br>удерживают!</span>`;
          this.lead.className = 'hud-lead show ' + side;
        } else this.lead.className = 'hud-lead';
      }
    } else if (this.mode === 'knockout') {
      const pips = (n: number) => [0, 1].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      html = `<div class="ht-team blue pips">${pips(hud.score[localTeam] ?? 0)}</div>` +
        `<div class="ht-timer col"><small>Раунд ${hud.round}</small>${hud.timer > 0 ? fmtTime(hud.timer) : iconHtml('poison')}</div>` +
        `<div class="ht-team red pips">${pips(hud.score[enemyTeam] ?? 0)}</div>`;
      this.setBanner(hud.banner, 'round');
    } else if (this.mode === 'showdown') {
      html = `<div class="ht-chip">${iconHtml('heroes')}<b>${hud.alive}</b><small>осталось</small></div>` +
        `<div class="ht-chip">${iconHtml('cube')}<b>${me.cubes ?? 0}</b></div>` +
        `<div class="ht-chip poison">${iconHtml('poison')}<span>${hud.timer > 0 ? `Облако через ${fmtTime(hud.timer)}` : 'Облако сжимается!'}</span></div>`;
    } else if (!hud.tip) {
      html = `<div class="ht-chip">${iconHtml('damage')}<small>урон/с</small><b>${hud.dps.toLocaleString('ru-RU')}</b></div><div class="ht-chip slim"><small>всего</small><b>${hud.total.toLocaleString('ru-RU')}</b></div><span class="ht-exit"></span>`;
    }
    if (html !== this.lastTop) {
      this.top.innerHTML = html;
      this.lastTop = html;
      const slot = this.top.querySelector('.ht-exit');
      if (slot && this.onExit) slot.replaceWith(this.exitBtn());
    }
    // обучение
    if (hud.tip) this.paintTutorial(hud.round);
    else if (this.tut) { this.tut.remove(); this.tut = null; this.tutStep = -1; }
  }

  dispose() {
    window.removeEventListener('resize', this.layout);
    clearTimeout(this.announceTimer);
    this.root.remove();
  }
}
