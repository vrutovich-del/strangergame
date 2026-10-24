// PWA: сервис-воркер — игра кэшируется, открывается быстро и работает без интернета.
// Подсказка для iPhone «На экран „Домой“» — в screens/system.ts.
export function installPwa() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* без офлайна тоже можно играть */ });
    });
  }
}
