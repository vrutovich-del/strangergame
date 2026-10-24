// Надписи поверх 3D: ник, уровень и полоса здоровья над бойцами (цвет стороны + форма), всплывающие цифры урона.
import { iconHtml, sideShapeHtml } from './icons';

export interface PlateData {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** 'self' — зелёная (кольцо под ногами), 'ally' — синяя с треугольником, 'enemy' — красная с ромбом. */
  side: 'self' | 'ally' | 'enemy';
  ammo: number;
  gems: number;
  cubes: number;
  infected: boolean;
  /** Глиф эмоции или пусто. */
  emote: string;
  superReady: boolean;
}

const SIDE_FILL = { self: '#5fe05a', ally: '#3f8cff', enemy: '#ff4b55' };

class Plate {
  el: HTMLDivElement;
  private nameEl: HTMLSpanElement;
  private lvl: HTMLSpanElement;
  private shape: HTMLSpanElement;
  private fill: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private ammo: HTMLDivElement | null = null;
  private ammoCells: HTMLDivElement[] = [];
  private badge: HTMLDivElement;
  private ready: HTMLDivElement;
  private emoteEl: HTMLDivElement;
  private virus: HTMLSpanElement;
  private last: Partial<PlateData> = {};
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'plate';
    this.el.innerHTML =
      '<div class="plate-emote"></div>' +
      `<div class="plate-name"><span class="plate-lvl"></span><span class="plate-nick"></span><span class="plate-virus">${iconHtml('infect')}</span></div>` +
      '<div class="plate-row"><span class="plate-shape"></span><div class="plate-bar"><div class="plate-fill"></div><span class="plate-hp"></span></div>' +
      `<div class="plate-badge"></div><div class="plate-ready">${iconHtml('super')}</div></div>`;
    this.emoteEl = this.el.querySelector('.plate-emote')!;
    this.badge = this.el.querySelector('.plate-badge')!;
    this.badge.style.display = 'none';
    this.ready = this.el.querySelector('.plate-ready')!;
    this.nameEl = this.el.querySelector('.plate-nick')!;
    this.lvl = this.el.querySelector('.plate-lvl')!;
    this.virus = this.el.querySelector('.plate-virus')!;
    this.shape = this.el.querySelector('.plate-shape')!;
    this.fill = this.el.querySelector('.plate-fill')!;
    this.hpText = this.el.querySelector('.plate-hp')!;
    parent.appendChild(this.el);
  }
  set(d: PlateData) {
    const L = this.last;
    if (L.name !== d.name) this.nameEl.textContent = d.name;
    if (L.level !== d.level) this.lvl.textContent = String(d.level);
    if (L.side !== d.side) {
      this.el.dataset.side = d.side;
      this.shape.innerHTML = d.side === 'self' ? '' : sideShapeHtml(d.side, SIDE_FILL[d.side]);
      if (d.side === 'self' && !this.ammo) {
        this.ammo = document.createElement('div');
        this.ammo.className = 'plate-ammo';
        for (let i = 0; i < 3; i++) { const c = document.createElement('div'); this.ammo.appendChild(c); this.ammoCells.push(c); }
        this.el.appendChild(this.ammo);
      }
    }
    const hp = Math.ceil(d.hp);
    if (L.hp !== hp || L.maxHp !== d.maxHp) {
      this.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, d.hp / d.maxHp))})`;
      this.hpText.textContent = String(hp);
    }
    if (this.ammo && L.ammo !== d.ammo) {
      for (let i = 0; i < 3; i++) {
        const k = Math.max(0, Math.min(1, d.ammo - i));
        this.ammoCells[i].style.setProperty('--a', String(k));
        this.ammoCells[i].classList.toggle('full', k >= 1);
      }
    }
    const badge = d.gems > 0 ? 'shard:' + d.gems : d.cubes > 0 ? 'cube:' + d.cubes : '';
    if (badge !== this.badge.dataset.v) {
      this.badge.dataset.v = badge;
      if (badge) { const [ic, n] = badge.split(':'); this.badge.innerHTML = iconHtml(ic) + n; }
      this.badge.style.display = badge ? '' : 'none';
    }
    if (L.infected !== d.infected) { this.virus.style.display = d.infected ? '' : 'none'; this.el.classList.toggle('infected', d.infected); }
    if (L.emote !== d.emote) {
      if (d.emote) this.emoteEl.innerHTML = iconHtml(d.emote);
      this.emoteEl.classList.toggle('show', !!d.emote);
    }
    if (L.superReady !== d.superReady) { this.el.classList.toggle('super', d.superReady); }
    this.last = { ...d, hp };
  }
  place(x: number, y: number, visible: boolean) {
    if (!visible) { if (this.el.style.display !== 'none') this.el.style.display = 'none'; return; }
    if (this.el.style.display === 'none') this.el.style.display = '';
    this.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }
  remove() { this.el.remove(); }
}

export class Overlay {
  root: HTMLDivElement;
  private plates = new Map<number, Plate>();
  private nums: { el: HTMLDivElement; t: number }[] = [];
  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    parent.appendChild(this.root);
  }
  plate(id: number): Plate {
    let p = this.plates.get(id);
    if (!p) { p = new Plate(this.root); this.plates.set(id, p); }
    return p;
  }
  dropPlate(id: number) { this.plates.get(id)?.remove(); this.plates.delete(id); }
  /** Всплывающее число урона. cls: me — по мне, ally — по союзнику, super — суперударом, small — мелкий, info — подпись. */
  number(x: number, y: number, text: string, cls: string, glyph?: string) {
    const el = document.createElement('div');
    el.className = 'dmg ' + cls;
    if (glyph) el.innerHTML = iconHtml(glyph) + '<span></span>';
    (glyph ? el.lastElementChild! : el).textContent = text;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    this.root.appendChild(el);
    this.nums.push({ el, t: performance.now() });
    if (this.nums.length > 40) this.nums.shift()!.el.remove();
    setTimeout(() => el.remove(), 900);
  }
  /** Короткая надпись в мире (например, «+1» с кристаллом). */
  floatText(x: number, y: number, text: string, glyph?: string) { this.number(x, y, text, 'info', glyph); }
  dispose() { this.root.remove(); this.plates.clear(); }
}
