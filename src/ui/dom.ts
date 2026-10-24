// Маленький помощник для интерфейса без фреймворков: h('div.card', {...}, детские элементы).
// Здесь же общие элементы дизайн-системы: кнопки, тосты, окна, подтверждения, отсчёт чисел.
import { audio, sfx } from '../audio/sfx';
import { icon } from './icons';

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Partial<Record<string, any>> & { onclick?: (e: MouseEvent) => void; style?: Partial<CSSStyleDeclaration> | string };

export function h(sel: string, props?: Props | Child, ...children: Child[]): HTMLElement {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel);
  const tag = m?.[1] || 'div';
  const el = document.createElement(tag);
  for (const part of (m?.[2] ?? '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props as Child); props = undefined; }
  if (props) {
    for (const [k, v] of Object.entries(props as Props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        // CSS-переменные (--rc, --p …) задаются только через setProperty
        else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); else (el.style as any)[sk] = sv; }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: HTMLElement, children: Child[]) {
  for (const c of children.flat(5 as 1) as Child[]) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement) { while (el.firstChild) el.removeChild(el.firstChild); }

/** Включено ли «Меньше анимаций» (настройка игры или системная). */
export const lessMotion = () => document.documentElement.hasAttribute('data-less-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Покачать элемент: «так нельзя», без красного и ругани. */
export function nudge(el: Element) {
  el.classList.remove('nudge');
  if (lessMotion()) return;
  void (el as HTMLElement).offsetWidth;
  el.classList.add('nudge');
  setTimeout(() => el.classList.remove('nudge'), 260);
}

/**
 * Пружинящая кнопка-стикер со звуком. cls — цвет и размер: 'yolk lg', 'lime', 'sky sm', 'paper', 'red' …
 * Недоступная (класс disabled) не нажимается: покачивается, коротко вибрирует и показывает причину из extra.why.
 */
export function btn(label: Child, onClick: () => void, cls = 'yolk', extra: Props & { why?: string } = {}): HTMLElement {
  const { why, ...rest } = extra;
  const b = h('button.btn', rest, label);
  for (const c of cls.split(/\s+/)) if (c) b.classList.add(c);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.classList.contains('loading')) return;
    if (b.classList.contains('disabled') || b.classList.contains('claimed')) {
      sfx('tick');
      nudge(b);
      audio.vibrate(12);
      const reason = why ?? b.dataset.why;
      if (reason) toast(reason, 'info');
      return;
    }
    sfx('click');
    onClick();
  });
  return b;
}

/** Круглая чёрная кнопка «Закрыть». */
export function closeBtn(onClick: () => void) {
  const b = h('button.btn-close', { 'aria-label': 'Закрыть' }, icon('close'));
  b.addEventListener('click', (e) => { e.stopPropagation(); sfx('back'); onClick(); });
  return b;
}

/** Кнопка «Назад» (синий стикер со стрелкой). */
export function backBtn(onClick: () => void) {
  return btn(icon('back'), onClick, 'sky icon', { 'aria-label': 'Назад' });
}

// ───────── тосты: стопкой сверху, не больше трёх ─────────
let toastBox: HTMLElement | null = null;
const TOAST_ICON = { good: 'check', bad: 'close', info: 'info' } as const;
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info', glyph?: string) {
  if (!toastBox || !toastBox.isConnected) { toastBox = h('div.toasts'); document.getElementById('ui')!.appendChild(toastBox); }
  // одинаковый тост не повторяем — просто продлеваем
  for (const t of Array.from(toastBox.children) as HTMLElement[]) if (t.dataset.text === text) t.remove();
  const el = h('div.toast.' + kind, { 'data-text': text }, icon(glyph ?? TOAST_ICON[kind], 'b'), h('span', text));
  toastBox.prepend(el);
  while (toastBox.children.length > 3) toastBox.lastElementChild!.remove();
  setTimeout(() => el.classList.add('hide'), 3000);
  setTimeout(() => el.remove(), 3300);
}

// ───────── окна ─────────
export interface ModalOpts { onClose?: () => void; closable?: boolean; cls?: string; top?: boolean }
/** Модальное окно — бумажный стикер поверх затемнения. Возвращает функцию закрытия. */
export function modal(content: HTMLElement, o: ModalOpts = {}) {
  const back = h('div.modal-back' + (o.top ? '.top' : ''));
  const box = h('div.modal' + (o.cls ? '.' + o.cls.split(' ').join('.') : ''), h('div.modal-inner', content));
  back.appendChild(box);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.add('hide');
    setTimeout(() => back.remove(), 170);
    o.onClose?.();
  };
  if (o.closable !== false) {
    box.appendChild(closeBtn(close));
    back.addEventListener('click', (e) => { if (e.target === back) { sfx('back'); close(); } });
  }
  document.getElementById('ui')!.appendChild(back);
  return close;
}

/** Заголовок окна: стикер-иконка и название. */
export const mHead = (title: string, glyph?: string) => h('div.m-head', glyph ? icon(glyph, 'b') : null, h('div.m-title', title));

/** Подтверждение «Да / Нет». danger — опасное действие: красная кайма. */
export function confirmBox(title: string, text: string, yes: string, onYes: () => void, o: { no?: string; glyph?: string; danger?: boolean; yesCls?: string; art?: HTMLElement } = {}) {
  let close = () => {};
  const body = h('div.col', { style: 'align-items:stretch' },
    h('div.row', { style: 'justify-content:flex-start;flex-wrap:nowrap;align-items:center' },
      o.art ?? (o.glyph ? h('div.m-art', { style: 'transform:rotate(8deg)' }, icon(o.glyph, 'b')) : null),
      h('div.col', { style: 'align-items:flex-start;gap:6px' }, h('div.m-title', title), text ? h('div.m-text', text) : null),
    ),
    h('div.m-actions',
      btn(o.no ?? 'Отмена', () => close(), 'paper sm'),
      btn(yes, () => { close(); onYes(); }, (o.yesCls ?? (o.danger ? 'red' : 'lime')) + ' sm'),
    ),
  );
  close = modal(body, { cls: o.danger ? 'danger' : '' });
  return close;
}

/** Кнопка «Нажми и держи» — второй шаг опасного действия (сброс прогресса). */
export function holdButton(label: string, ms: number, onDone: () => void) {
  const fill = h('div.hold-fill');
  const text = h('span', label);
  const b = h('button.btn.sm.hold', fill, text);
  let t0 = 0, raf = 0, done = false;
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    fill.style.transform = `scaleX(${k})`;
    if (k >= 1) { done = true; audio.vibrate(30); onDone(); return; }
    raf = requestAnimationFrame(tick);
  };
  const start = (e: Event) => { e.preventDefault(); if (done) return; t0 = performance.now(); text.textContent = 'Держи…'; raf = requestAnimationFrame(tick); };
  const stop = () => { if (done) return; cancelAnimationFrame(raf); fill.style.transform = 'scaleX(0)'; text.textContent = label; };
  b.addEventListener('pointerdown', start);
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointerleave', stop);
  b.addEventListener('pointercancel', stop);
  return b;
}

/** Подсказка «i» рядом с элементом. Закрывается любым тапом. */
export function tipPop(anchor: HTMLElement, title: string, text: string, glyph = 'info') {
  const r = anchor.getBoundingClientRect();
  const el = h('div.tip-pop', h('b', icon(glyph), title), h('span', text));
  document.getElementById('ui')!.appendChild(el);
  const w = el.offsetWidth, hh = el.offsetHeight;
  el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right + 10))}px`;
  el.style.top = `${Math.max(8, Math.min(innerHeight - hh - 8, r.top))}px`;
  const off = () => { el.remove(); window.removeEventListener('pointerdown', off, true); };
  setTimeout(() => window.addEventListener('pointerdown', off, true), 0);
}

/** Анимированное число (счётчик). При «Меньше анимаций» — сразу готовое. */
export function countUp(el: HTMLElement, from: number, to: number, ms = 900, prefix = '', fmt = (v: number) => String(v)) {
  if (lessMotion()) { el.textContent = prefix + fmt(to); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const v = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    el.textContent = prefix + fmt(v);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Число с пробелами между тысячами: 6 240. */
export const fmtNum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** «ещё 5 ч 12 мин» до момента ms. */
export function fmtLeft(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `${d} д ${hh} ч`;
  if (hh > 0) return `${hh} ч ${mm} мин`;
  return `${Math.max(1, mm)} мин`;
}

/** Конфетти из точки: кружочки цвета награды. Бюджет — 24 на телефоне и 60 на ПК, при «Меньше анимаций» — ноль. */
export function burst(root: HTMLElement, colors: string[], n = 18, glyphs: string[] = []) {
  if (lessMotion()) return;
  const max = matchMedia('(pointer: coarse)').matches ? 24 : 60;
  n = Math.min(n, max);
  const b = h('div.burst');
  for (let k = 0; k < n; k++) {
    const a = `${(k * 360) / n + Math.random() * 10}deg`, d = `${110 + Math.random() * 140}px`;
    if (glyphs.length && k % 4 === 0) {
      const g = icon(glyphs[k % glyphs.length], 'b');
      g.style.setProperty('--a', a); g.style.setProperty('--d', d);
      b.appendChild(g);
    } else b.appendChild(h('i' + (k % 3 === 2 ? '.sq' : ''), { style: { '--a': a, '--d': d, background: colors[k % colors.length] } as any }));
  }
  root.appendChild(b);
  setTimeout(() => b.remove(), 950);
}
