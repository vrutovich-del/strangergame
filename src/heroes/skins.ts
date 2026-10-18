// Реестр скинов: собирается автоматически из файлов src/heroes/<id>/skins.ts.
import type { SkinDef } from './skinTypes';
export type { SkinDef } from './skinTypes';

const modules = import.meta.glob('./*/skins.ts', { eager: true }) as Record<string, { SKINS: SkinDef[] }>;
const ALL: SkinDef[] = Object.values(modules).flatMap((m) => m.SKINS ?? []);

export function skinsOf(heroId: string): SkinDef[] { return ALL.filter((s) => s.heroId === heroId); }
export function getSkin(heroId: string, skinId: string): SkinDef {
  return ALL.find((s) => s.heroId === heroId && s.id === skinId) ?? ALL.find((s) => s.heroId === heroId && s.id === 'default') ?? {
    id: 'default', heroId, name: heroId, price: 0, currency: 'gems', rarity: 'common', cardColor: '#888', desc: '',
  };
}
export function allSkins(): SkinDef[] { return ALL; }
export const skinKey = (heroId: string, skinId: string) => `${heroId}:${skinId}`;
