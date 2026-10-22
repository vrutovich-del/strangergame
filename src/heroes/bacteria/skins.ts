// Скины Бактерии. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'bacteria', name: 'Бактерия', price: 0, currency: 'gems', rarity: 'common', cardColor: '#b05cff', desc: 'Хитрая фиолетовая бактерия.' },
  {
    id: 'king', heroId: 'bacteria', name: 'Вирус-Король', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#ffb300',
    desc: 'С золотой короной. Заражает по-королевски!',
    palette: { skin: 0x3a1450, hair: 0x5a1f78, spotA: 0xffc933, spotB: 0xffe27a, spotC: 0xc77ae8, goggleRim: 0xffd23f, strap: 0x8a1f3a, strapDark: 0x5e1428 },
    shotColor: 0xffd23f, sfxPitch: 0.9,
  },
  {
    id: 'rainbow', heroId: 'bacteria', name: 'Радужная Бактерия', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#ff7bd5',
    desc: 'Переливается всеми цветами радуги.',
    palette: { skin: 0x2a2450, spotA: 0xff4b55, spotB: 0xffd23f, spotC: 0x3fd8ff },
    shotColor: -1, sfxPitch: 1.15,
  },
  {
    id: 'ghost', heroId: 'bacteria', name: 'Бактерия-Призрак', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#c8c0ff',
    desc: 'Новая модель: без ножек, с волнистым хвостиком. Парит над землёй, а при выбивании улетает вверх!',
    palette: { skin: 0xe8e4ff, hair: 0xffffff, spotA: 0xc8c0ff, spotB: 0xb0a8f0, spotC: 0xd8d0ff, sclera: 0xffffff, iris: 0x5fc8ff, irisRing: 0x2a6fa0, lip: 0x6a6a9a, mouth: 0x3a3a6a, brow: 0x6a6a9a, goggleRim: 0xd8d8f0, strap: 0x9a90c8, strapDark: 0x7a70a8, glowGreen: 0x9fe8ff, glowPurple: 0xc8a8ff },
    shotColor: 0xd8d0ff, sfxPitch: 1.3,
  },
  {
    id: 'jelly', heroId: 'bacteria', name: 'Бактерия-Медуза', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#ff7bd5',
    desc: 'Новая модель: прозрачный светящийся купол и щупальца. Плывёт по воздуху, как настоящая медуза!',
    palette: { skin: 0x2a3a8a, hair: 0x7fd8ff, spotA: 0xff7bd5, spotB: 0x7fd8ff, spotC: 0xb08bff, glowGreen: 0x7fd8ff, glowPurple: 0xff7bd5, sclera: 0xfff3a0 },
    shotColor: 0xff9ad8, sfxPitch: 1.1,
  },
  {
    id: 'fire', heroId: 'bacteria', name: 'Огненная Бактерия', price: 250, currency: 'bling', rarity: 'rare', cardColor: '#ff7a2a',
    desc: 'Цветовая вариация: горячая, как вулкан.',
    palette: { skin: 0x4a1608, hair: 0xff6a00, spotA: 0xff4b1f, spotB: 0xffa31f, spotC: 0xffd23f, sclera: 0xfff2a8, iris: 0xff6a00, irisRing: 0x8a2a00, glowGreen: 0xffa31f },
    shotColor: 0xff7a2a, sfxPitch: 0.95,
  },
  {
    id: 'neon', heroId: 'bacteria', name: 'Неоновая Бактерия', price: 0, currency: 'gems', rarity: 'legendary', exclusive: 'pass', cardColor: '#3fd8ff',
    desc: 'Эксклюзив Боевого пропуска. Светится в темноте!',
    palette: { skin: 0x0d0d2a, hair: 0x3fd8ff, spotA: 0xff3fd8, spotB: 0x3fd8ff, spotC: 0x9dff3f, glowGreen: 0x3fd8ff, glowPurple: 0xff3fd8, sclera: 0xe8fbff },
    shotColor: 0x3fd8ff, sfxPitch: 1.25,
  },
  // спортивная коллекция
  {
    id: 'basketball', heroId: 'bacteria', name: 'Бактерия-Баскетболистка', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#2fae4a',
    desc: 'Спортивная коллекция: повязка, рюкзак с номером 11 и мяч, который крутится прямо на макушке!',
    kit: { main: 0x2fae4a, accent: 0xffffff, number: '11' },
    palette: { strap: 0x2fae4a, strapDark: 0x1f7a34, wood: 0x2fae4a, woodDark: 0x1f7a34, woodLid: 0x5ad06a },
    shotColor: 0xff8a2a, sfxPitch: 1.05,
  },
  {
    id: 'football', heroId: 'bacteria', name: 'Бактерия-Футболистка', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#e8323e',
    desc: 'Спортивная коллекция: красно-белая форма с номером 9 и мяч у ног. В меню чеканит мяч!',
    kit: { main: 0xe8323e, accent: 0xffffff, number: '9' },
    palette: { strap: 0xe8323e, strapDark: 0xa01a28, wood: 0xe8323e, woodDark: 0xa01a28, woodLid: 0xffffff },
    shotColor: 0xffffff, sfxPitch: 1.15,
  },
  {
    id: 'baseball', heroId: 'bacteria', name: 'Бактерия-Бейсболистка', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#ffd23f',
    desc: 'Спортивная коллекция: жёлтая кепка вместо очков, номер 3 и бита за спиной.',
    kit: { main: 0xffd23f, accent: 0x1f3a7a, number: '3' },
    palette: { strap: 0xffd23f, strapDark: 0xc8a020, wood: 0xffd23f, woodDark: 0xc8a020, woodLid: 0x1f3a7a },
    shotColor: 0xf4f4f8, sfxPitch: 0.95,
  },
];
