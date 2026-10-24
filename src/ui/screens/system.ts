// Системное: «Что-то пошло не так» с «Обновить», плашка «Нет интернета», подсказка для iPhone «На экран „Домой“».
import { btn, h } from '../dom';
import { icon } from '../icons';
import { appIconSvg, logoMark } from '../logo';

let crashed = false;
/** Общая ошибка: прогресс не пропал, обнови страницу. Без голого «Ошибка». */
export function crashScreen(code = 'R-' + Math.floor(100 + Math.random() * 900)) {
  if (crashed) return;
  crashed = true;
  const boot = document.getElementById('boot');
  if (boot) boot.style.display = 'none';
  const el = h('div.crash',
    h('div.crash-art', h('div.crash-mark', { html: logoMark() }), icon('ko', 'b', 'crash-ko')),
    h('div.crash-card',
      h('div.m-title', 'Что-то пошло не так'),
      h('div.m-text', 'Прогресс не пропал — он сохранён. Обнови страницу, и продолжим.'),
      h('div.crash-foot', h('span.crash-code', `код ошибки: ${code}`), btn([icon('refresh'), 'Обновить'], () => location.reload(), 'sky')),
    ),
  );
  (document.getElementById('ui') ?? document.body).appendChild(el);
}

/** Плашка «Нет интернета» сверху: играть с роботами можно, прогресс сохранится на устройстве. */
export function watchOnline() {
  let bar: HTMLElement | null = null;
  const show = () => {
    if (bar) return;
    bar = h('div.offline-bar',
      icon('cloudoff', 'b'),
      h('div', h('b', 'Нет интернета'), h('span', 'Играй с роботами — прогресс сохранится на устройстве')),
      btn('Понятно', () => hide(), 'paper xs'));
    document.getElementById('ui')!.appendChild(bar);
  };
  const hide = () => { bar?.classList.add('hide'); const b = bar; setTimeout(() => b?.remove(), 220); bar = null; };
  window.addEventListener('offline', show);
  window.addEventListener('online', hide);
  if (!navigator.onLine) show();
}

/** iPhone в Safari: подсказка «Добавь на экран „Домой“». Показываем один раз. */
export function iosHint() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as any).standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  let shown = false;
  try { shown = localStorage.getItem('ios-hint') === '1'; } catch { /* приватный режим */ }
  if (!ios || standalone || shown) return;
  setTimeout(() => {
    const done = () => { el.classList.add('hide'); setTimeout(() => el.remove(), 200); try { localStorage.setItem('ios-hint', '1'); } catch { /* ничего */ } };
    const step = (n: number, art: HTMLElement | SVGSVGElement, text: string) => h('div.ios-step', art, h('div', h('b', `${n}. `), text));
    const el = h('div.ios-hint',
      h('div.ios-arrow', { html: '<svg viewBox="0 0 120 70" preserveAspectRatio="none"><path d="M8 66 C30 30 70 14 108 8" style="fill:none;stroke:#fffaf0;stroke-width:4px;stroke-linecap:round;stroke-dasharray:2 9"/><path d="M96 2 L112 7 L100 18" style="fill:none;stroke:#fffaf0;stroke-width:4px;stroke-linecap:round;stroke-linejoin:round"/></svg>' }),
      h('div.ios-card',
        h('div.m-title', 'Играй на весь экран'),
        h('div.ios-steps',
          step(1, h('div.ios-ic', { style: { background: 'var(--sky)' } }, icon('share')), 'Нажми «Поделиться» в Safari'),
          step(2, h('div.ios-ic', { style: { background: 'var(--lime)' } }, icon('plus')), 'Выбери «На экран „Домой“»'),
          step(3, h('div.ios-ic.app', { html: appIconSvg() }), 'Запускай с иконки — без полосок браузера')),
        h('div.m-actions', btn('Не сейчас', done, 'paper sm'), btn('Понятно', done, 'lime sm')),
      ),
    );
    document.getElementById('ui')!.appendChild(el);
  }, 3000);
}
