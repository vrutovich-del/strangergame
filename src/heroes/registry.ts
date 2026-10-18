// Реестр героев. Новый герой регистрируется сам: достаточно папки src/heroes/<id>/ с файлом index.ts.
import type { HeroDef } from '../sim/types';
import { ROBOTS } from '../bots/robots';

const modules = import.meta.glob('./*/index.ts', { eager: true }) as Record<string, { default: HeroDef }>;

const HEROES = new Map<string, HeroDef>();
for (const m of Object.values(modules)) if (m.default) HEROES.set(m.default.id, m.default);
for (const r of ROBOTS) HEROES.set(r.id, r);

export function getHero(id: string): HeroDef {
  const h = HEROES.get(id);
  if (!h) throw new Error('Неизвестный герой: ' + id);
  return h;
}
export function hasHero(id: string) { return HEROES.has(id); }

/** Герои, которых может выбрать игрок, по порядку. */
export function playableHeroes(): HeroDef[] {
  return [...HEROES.values()].filter((h) => h.playable).sort((a, b) => a.order - b.order);
}
