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
  // спортивная коллекция
  {
    id: 'basketball', heroId: 'stoptime', name: 'Стоп-Тайм Баскетболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#ff6a1f',
    desc: 'Спортивная коллекция: оранжевый корпус, повязка, номер 12 на рюкзаке и мяч на поясе.',
    kit: { main: 0xff6a1f, accent: 0xffffff, number: '12' },
    palette: { blue: 0xff6a1f, blueDark: 0xc84a10, copper: 0xffffff, bronze: 0xd8d8e0 },
    shotColor: 0xff8a2a, sfxPitch: 1.05,
  },
  {
    id: 'football', heroId: 'stoptime', name: 'Стоп-Тайм Футболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#e8323e',
    desc: 'Спортивная коллекция: красно-белый корпус, номер 4 и мяч у ног. В меню чеканит мяч!',
    kit: { main: 0xe8323e, accent: 0xffffff, number: '4' },
    palette: { blue: 0xe8323e, blueDark: 0xa01a28, copper: 0xffffff, bronze: 0xd8d8e0 },
    shotColor: 0xffffff, sfxPitch: 1.1,
  },
  {
    id: 'baseball', heroId: 'stoptime', name: 'Стоп-Тайм Бейсболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#1f3a7a',
    desc: 'Спортивная коллекция: тёмно-синяя кепка, номер 6 и бита на рюкзаке.',
    kit: { main: 0x1f3a7a, accent: 0xffd23f, number: '6' },
    palette: { blue: 0x1f3a7a, blueDark: 0x14285a, copper: 0xffd23f, bronze: 0xc8a020 },
    shotColor: 0xffd23f, sfxPitch: 0.9,
  },
];
