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
];
