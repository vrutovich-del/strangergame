// Маленький помощник для интерфейса без фреймворков: h('div.card', {...}, детские элементы).
import { sfx } from '../audio/sfx';

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
      if (k === 'style') { if (typeof v === 'string') el.setAttribute('style', v); else Object.assign(el.style, v); }
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

/** Пружинящая кнопка со звуком. */
export function btn(label: Child, onClick: () => void, cls = 'btn-yellow', extra: Props = {}): HTMLElement {
  const b = h('button.btn.' + cls, extra, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.classList.contains('disabled')) { sfx('tick'); return; }
    sfx('click');
    onClick();
  });
  return b;
}

export function clear(el: HTMLElement) { while (el.firstChild) el.removeChild(el.firstChild); }

let toastEl: HTMLElement | null = null;
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info') {
  toastEl?.remove();
  toastEl = h('div.toast.' + kind, text);
  document.getElementById('ui')!.appendChild(toastEl);
  const el = toastEl;
  setTimeout(() => el.classList.add('hide'), 2200);
  setTimeout(() => el.remove(), 2700);
}

/** Модальное окно. Возвращает функцию закрытия. */
export function modal(content: HTMLElement, o: { onClose?: () => void; closable?: boolean; cls?: string } = {}) {
  const back = h('div.modal-back' + (o.cls ? '.' + o.cls : ''));
  const box = h('div.modal', h('div.modal-inner', content));
  back.appendChild(box);
  const close = () => {
    back.classList.add('hide');
    setTimeout(() => back.remove(), 200);
    o.onClose?.();
  };
  if (o.closable !== false) {
    const x = btn('✕', close, 'btn-close');
    box.appendChild(x);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
  }
  document.getElementById('ui')!.appendChild(back);
  return close;
}

/** Окно подтверждения «Да / Нет». */
export function confirmBox(title: string, text: string, yes: string, onYes: () => void, no = 'Отмена') {
  let close = () => {};
  const c = h('div.confirm',
    h('h2', title), h('p', text),
    h('div.row', btn(no, () => close(), 'btn-blue'), btn(yes, () => { close(); onYes(); }, 'btn-red')),
  );
  close = modal(c);
}

/** Анимированное число (счётчик). */
export function countUp(el: HTMLElement, from: number, to: number, ms = 800, prefix = '') {
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const v = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    el.textContent = prefix + (to - from >= 0 && prefix ? '' : '') + v;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Иконки валют. */
export const ICON = { coins: '🪙', gems: '💎', bling: '✨', trophy: '🏆', pass: '🎟️', xp: '⭐' };
