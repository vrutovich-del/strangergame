// Скины Шахтёра. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'miner', name: 'Шахтёр', price: 0, currency: 'gems', rarity: 'common', cardColor: '#ffb02e', desc: 'Усатый шахтёр в каске с фонариком.', shotColor: 0xb0b8c8 },
  {
    id: 'viking', heroId: 'miner', name: 'Шахтёр-Викинг', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#c8642a',
    desc: 'Новая модель: рогатый шлем, борода косичкой и меховой плащ. Перед ударом подпрыгивает с боевым кличем!',
    palette: { helmet: 0x9aa4b4, helmetDark: 0x6a7484, mustache: 0xe0702a, brow: 0xc05a1a, shirt: 0x5a6a3a, shirtDark: 0x45542c, overalls: 0x6b4a2a, overallsDark: 0x4a321c, belt: 0x3a2412, iron: 0xc8ccd4 },
    shotColor: 0xd8dce6, sfxPitch: 0.85,
  },
  {
    id: 'crystal', heroId: 'miner', name: 'Кристальный Шахтёр', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#5ff4ff',
    desc: 'Новая модель: на каске и плечах растут светящиеся кристаллы, а кирки — из чистого алмаза.',
    palette: { helmet: 0x6a4ce0, helmetDark: 0x3a2a90, lampGlass: 0xff7bd5, shirt: 0x2b8ef0, shirtDark: 0x1b5fc4, overalls: 0x2c1d63, overallsDark: 0x1a0f3a, iron: 0x9ff8ff, ironDark: 0x5fd8ff, mustache: 0xeeeeff, brow: 0xc8c8f0 },
    shotColor: 0x5ff4ff, sfxPitch: 1.2,
  },
];
