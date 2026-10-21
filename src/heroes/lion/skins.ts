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
    id: 'dragon', heroId: 'lion', name: 'Лев-Дракон', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#2a9a7a',
    desc: 'Новая модель: крылья, рога и шипы на хвосте. Машет крыльями на бегу и в прыжке хищника!',
    palette: {
      fur: 0x4fae5a, furLight: 0x7fd88a, cream: 0xd8f0a8, earInner: 0xa8e0a0,
      maneLight: 0x3fd8a8, maneMid: 0x2a9a7a, maneDark: 0x1f6a5a, maneRed: 0x174a40,
      brow: 0x1f4a2a, iris: 0xffd23f, irisRing: 0xc87a00, vest: 0x5a2a4a, leather: 0x3a1f30, leatherDark: 0x2a1424, claw: 0xffd23f, headband: 0x8a2a5a, headbandDark: 0x5a1a3a,
    },
    shotColor: 0xff8a2a, sfxPitch: 0.8,
  },
  {
    id: 'knight', heroId: 'lion', name: 'Лев-Рыцарь', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#3a5a9a',
    desc: 'Новая модель: шлем с пером, латы, щит и плащ. Бежит гордо, подняв голову, а плащ развевается!',
    palette: { vest: 0x3a5a9a, cloth: 0x3a5a9a, leather: 0x6a4a2a, metal: 0xd8dce6, spike: 0xffd23f, headband: 0x3a5a9a, headbandDark: 0x24407a },
    shotColor: 0x9fd8ff, sfxPitch: 0.95,
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
