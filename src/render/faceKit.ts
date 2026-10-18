// Быстрые версии setBlink / setLook из моделей автора: работают по кешу костей, без обхода дерева.
import type { Rig } from './heroView';

/** 0 — обычные веки, 1 — закрыты, отрицательные — глаза шире (испуг). */
export function blink(r: Rig, amount: number) {
  const a = Math.max(-0.45, Math.min(1, amount));
  for (const side of ['L', 'R']) {
    const lid = r.bone('eyelid_' + side);
    if (!lid) continue;
    const open = lid.userData.restX ?? -0.3;
    lid.rotation.x = open + (1.68 - open) * a;
  }
}

export function blinkOne(r: Rig, side: 'L' | 'R', amount: number) {
  const lid = r.bone('eyelid_' + side);
  if (!lid) return;
  const open = lid.userData.restX ?? -0.3;
  lid.rotation.x = open + (1.68 - open) * amount;
}

/** Куда смотрят зрачки: x, y в −1…1. */
export function look(r: Rig, x: number, y: number) {
  for (const side of ['L', 'R']) {
    const iris = r.bone('iris_' + side);
    if (!iris) continue;
    const rest = iris.userData.rest ?? [0, 0];
    iris.rotation.set(rest[0] - y * 0.38, rest[1] + x * 0.45, 0);
  }
}

/** Естественное моргание раз в несколько секунд. */
export function autoBlink(t: number, seed = 0) {
  const p = (t + seed) % 3.4;
  return p < 0.12 ? Math.sin((p / 0.12) * Math.PI) : 0;
}
