// Скины Льва. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'lion', name: 'Лев', price: 0, currency: 'gems', rarity: 'common', cardColor: '#f2902e', desc: 'Свирепый золотой лев-воин.', shotColor: 0xffc24a },
  {
    id: 'snow', heroId: 'lion', name: 'Снежный Лев', price: 250, currency: 'bling', rarity: 'rare', cardColor: '#9fd8ff',
    desc: 'Цветовая вариация: белая шерсть и ледяная грива.',
    palette: {
      fur: 0xf1efe8, furLight: 0xffffff, cream: 0xffffff, earInner: 0xd8ecff,
      maneLight: 0xe2f2ff, maneMid: 0xaed0f2, maneDark: 0x83a6d6, maneRed: 0x6283b8,
      brow: 0x5f7899, iris: 0x5fc8ff, irisRing: 0x2a6fa0, headband: 0xaed0f2, headbandDark: 0x6283b8, vest: 0x4a5a80,
    },
    shotColor: 0x9fe0ff, sfxPitch: 1.1,
  },
  {
    id: 'shadow', heroId: 'lion', name: 'Теневой Лев', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#8a3cd0',
    desc: 'Тёмная шерсть, фиолетовая грива и светящиеся глаза.',
    palette: {
      fur: 0x3a3048, furLight: 0x4e4262, cream: 0x6a5a80, earInner: 0x8a6aa8,
      maneLight: 0xc77aff, maneMid: 0x9a4ce0, maneDark: 0x6424a0, maneRed: 0x40126a,
      brow: 0x1a1024, sclera: 0xffe6ff, iris: 0xff3fd8, irisRing: 0x8a1f8a,
      vest: 0x1c1428, leather: 0x2a1f38, leatherDark: 0x1a1224, metal: 0x6a5a80, spike: 0xd9a8ff, claw: 0xff9bf0,
    },
    shotColor: 0xd27bff, sfxPitch: 0.85,
  },
];
