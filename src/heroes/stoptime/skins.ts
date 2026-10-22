// Скины Стоп-Тайма. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'stoptime', name: 'Стоп-Тайм', price: 0, currency: 'gems', rarity: 'common', cardColor: '#2f62b8', desc: 'Синий робот с часами на рюкзаке, который умеет останавливать время.', shotColor: 0x6ff0ff },
  {
    id: 'cuckoo', heroId: 'stoptime', name: 'Часы с кукушкой', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#a8693a',
    desc: 'Новая модель: деревянный корпус, домик с кукушкой над часами и маятник. Кукушка выглядывает при каждом выстреле!',
    palette: { blue: 0xa8693a, blueDark: 0x6b4220, copper: 0xffc933, bronze: 0xc8860f, joint: 0x5e3a1a, glow: 0xffe9a0, glowSoft: 0xffc24a, dial: 0x4a2a14 },
    shotColor: 0xffc24a, sfxPitch: 0.85,
  },
  {
    id: 'night', heroId: 'stoptime', name: 'Ночной Стоп-Тайм', price: 250, currency: 'bling', rarity: 'rare', cardColor: '#1e2a6a',
    desc: 'Цветовая вариация: тёмно-синий, с жёлтым экраном и светящимися звёздочками.',
    palette: { blue: 0x1e2a6a, blueDark: 0x121a48, copper: 0x8a9cff, bronze: 0x5a6ad0, screen: 0x080c20, glow: 0xffe060, glowSoft: 0xffc030, lamp: 0xffe060 },
    shotColor: 0xffe060, sfxPitch: 1.15,
  },
];
