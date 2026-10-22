// Скины Шахтёра. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'miner', name: 'Шахтёр', price: 0, currency: 'gems', rarity: 'common', cardColor: '#4fb33a', desc: 'Крокодил-шахтёр в каске с фонариком и с двумя кирками.', shotColor: 0xc3cfe0 },
  {
    id: 'viking', heroId: 'miner', name: 'Шахтёр-Викинг', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#c8642a',
    desc: 'Новая модель: рогатый шлем и меховой плащ. Перед ударом подпрыгивает, а в меню издаёт боевой клич!',
    palette: { helmet: 0x9aa4b4, helmetBand: 0x5a3a20, denim: 0x6b4a2a, denimDark: 0x4a321c, cuff: 0xa88a6a, skin: 0x5a9a3a, skinDark: 0x34602a, steel: 0xd8dce6 },
    shotColor: 0xd8dce6, sfxPitch: 0.85,
  },
  {
    id: 'crystal', heroId: 'miner', name: 'Кристальный Шахтёр', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#5ff4ff',
    desc: 'Новая модель: на каске и плечах растут светящиеся кристаллы, а кирки — из чистого алмаза.',
    palette: { helmet: 0x6a4ce0, helmetBand: 0x3a2a90, lampGlow: 0xff7bd5, denim: 0x2b8ef0, denimDark: 0x1b5fc4, skin: 0x3fb8a0, skinDark: 0x23806e, belly: 0xb8f0e0, steel: 0x9ff8ff, steelDark: 0x5fd8ff, lens: 0x9ff8ff, lensGlow: 0x5fd8ff },
    shotColor: 0x5ff4ff, sfxPitch: 1.2,
  },
  // спортивная коллекция
  {
    id: 'basketball', heroId: 'miner', name: 'Шахтёр-Баскетболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#ff8a2a',
    desc: 'Спортивная коллекция: оранжевая форма с номером 33, повязка вместо каски и мяч на поясе.',
    kit: { main: 0xff8a2a, accent: 0xffffff, number: '33' },
    palette: { denim: 0xff8a2a, denimDark: 0xd0601a, cuff: 0xffffff, boot: 0xffffff, sole: 0xff8a2a, glove: 0xffffff },
    shotColor: 0xff8a2a, sfxPitch: 0.95,
  },
  {
    id: 'football', heroId: 'miner', name: 'Шахтёр-Футболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#e8eef8',
    desc: 'Спортивная коллекция: белая форма с номером 5, бутсы и мяч у ног. В меню чеканит мяч!',
    kit: { main: 0xf4f4f8, accent: 0x1f3a7a, number: '5' },
    palette: { denim: 0xf4f4f8, denimDark: 0xc8c8d8, cuff: 0x1f3a7a, boot: 0x1c1c22, sole: 0xffffff, glove: 0x1f3a7a },
    shotColor: 0xffffff, sfxPitch: 1.0,
  },
  {
    id: 'baseball', heroId: 'miner', name: 'Шахтёр-Бейсболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#e8323e',
    desc: 'Спортивная коллекция: красный шлем бэттера, форма с номером 8 и бита за спиной.',
    kit: { main: 0xe8323e, accent: 0xffffff, number: '8' },
    palette: { helmet: 0xe8323e, helmetBand: 0x1f3a7a, denim: 0xf4f4f8, denimDark: 0xc8c8d8, cuff: 0xe8323e, boot: 0xe8323e, glove: 0x8a4a1f },
    shotColor: 0xf4f4f8, sfxPitch: 0.85,
  },
];
