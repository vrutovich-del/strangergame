// Скины Стоп-Тайма. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'stoptime', name: 'Стоп-Тайм', price: 0, currency: 'gems', rarity: 'common', cardColor: '#7f6bff', desc: 'Золотой будильник, который умеет останавливать время.', shotColor: 0x9f8cff },
  {
    id: 'cuckoo', heroId: 'stoptime', name: 'Часы с кукушкой', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#a8693a',
    desc: 'Новая модель: деревянный домик с крышей и маятником. Из окошка выскакивает кукушка!',
    palette: { body: 0xb07a3a, rim: 0x6b4220, dial: 0xfff0d0, lid: 0xf0dcb0, bell: 0xc8860f, shoe: 0x6b4220, shoeSole: 0x3e2410, minHand: 0xd94a3a, pin: 0x3fae4a },
    shotColor: 0xffc24a, sfxPitch: 0.85,
  },
  {
    id: 'night', heroId: 'stoptime', name: 'Ночной Стоп-Тайм', price: 250, currency: 'bling', rarity: 'rare', cardColor: '#2b3a8a',
    desc: 'Цветовая вариация: тёмно-синий, со светящимися звёздочками.',
    palette: { body: 0x2b3a8a, rim: 0x1a2260, dial: 0x1e2550, tick: 0xffe060, hourHand: 0xdfe6ff, minHand: 0xffe060, lid: 0x3a4aa0, brow: 0xdfe6ff, bell: 0x8a9cff, bellDark: 0x4a5ac0, shoe: 0x1a2260, mouth: 0x0d1030, glow: 0xffe060 },
    shotColor: 0xffe060, sfxPitch: 1.15,
  },
];
