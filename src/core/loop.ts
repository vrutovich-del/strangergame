// Главный цикл кадров. Основной — requestAnimationFrame; если браузер его придерживает
// (окно не в фокусе, встроенный предпросмотр), подстраховывает таймер ~30 кадров/с.
export function startLoop(frame: (dt: number, now: number) => void) {
  let last = performance.now();
  let lastRaf = 0;
  const run = (now: number) => {
    const dt = (now - last) / 1000;
    if (dt < 0.004) return;
    last = now;
    frame(Math.min(0.1, dt), now / 1000);
  };
  const raf = (t: number) => {
    lastRaf = performance.now();
    run(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  setInterval(() => {
    const now = performance.now();
    if (now - lastRaf > 120) run(now);
  }, 33);
}
