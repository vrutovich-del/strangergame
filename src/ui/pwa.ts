// PWA: сервис-воркер (офлайн и быстрая загрузка) и подсказка для iPhone, как открыть игру на весь экран.
import { btn, h } from './dom';

export function installPwa() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* без офлайна тоже можно играть */ });
    });
  }
  iosHint();
}

function iosHint() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as any).standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  let shown = false;
  try { shown = localStorage.getItem('ios-hint') === '1'; } catch { /* приватный режим */ }
  if (!ios || standalone || shown) return;
  setTimeout(() => {
    const el = h('div.ios-hint',
      h('div', '📱 Чтобы играть на весь экран: нажми ', h('b', 'Поделиться ⬆️'), ' → ', h('b', '«На экран „Домой“»'), ' и открой игру с иконки.'),
      btn('Понятно', () => { el.remove(); try { localStorage.setItem('ios-hint', '1'); } catch { /* ничего */ } }, 'btn-green', { class: 'btn-sm' }),
    );
    document.getElementById('ui')!.appendChild(el);
  }, 4000);
}
