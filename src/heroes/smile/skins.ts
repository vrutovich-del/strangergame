// Скины Смайла. Чтобы добавить скин — допишите объект в список (см. docs/НОВЫЙ_СКИН.md).
import type { SkinDef } from '../skinTypes';

export const SKINS: SkinDef[] = [
  { id: 'default', heroId: 'smile', name: 'Смайл', price: 0, currency: 'gems', rarity: 'common', cardColor: '#ffd23f', desc: 'Классический весёлый Смайл.' },
  {
    id: 'angry', heroId: 'smile', name: 'Злой Смайл', price: 29, currency: 'gems', rarity: 'rare', cardColor: '#ff4b55',
    desc: 'Красный, брови домиком. Лучше его не злить!',
    palette: { skinTop: 0xff6a4a, skinMid: 0xf0402e, skinBottom: 0xb81c1c, limb: 0xf04a30, lid: 0xf3503a, forehead: 0xff5c45, blush: 0x9b0f0f, capBlue: 0x2b2b33, capSeam: 0x15151a, capOrange: 0xff4b2a },
    shotColor: 0xff5a3a, sfxPitch: 0.85,
  },
  {
    id: 'cosmo', heroId: 'smile', name: 'Космо-Смайл', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#5b7bff',
    desc: 'В шлеме космонавта. Улыбается даже в открытом космосе!',
    palette: { vest: 0xe8ecf4, vestTrim: 0x9aa6bf, strap: 0x4a5a80, pouch: 0x5a6a90, pouchFlap: 0x3d4a6a, glove: 0xe8ecf4, gloveCuff: 0xff7b28, boot: 0xe8ecf4, bootCuff: 0xff7b28, bootSole: 0x5a6a90 },
    shotColor: 0x7fd6ff, sfxPitch: 1.2,
  },
  {
    id: 'ninja', heroId: 'smile', name: 'Ниндзя-Смайл', price: 149, currency: 'gems', rarity: 'legendary', cardColor: '#2b2b3a',
    desc: 'Новая модель: капюшон, повязка с хвостами и катана. Бегает по-ниндзевски, бросает сюрикены с разворота и делает сальто!',
    palette: { vest: 0x1c1c28, vestTrim: 0x2b2b3a, strap: 0x2b2b3a, pouch: 0x2b2b3a, pouchFlap: 0x1c1c28, glove: 0x1c1c28, gloveCuff: 0xe8323e, boot: 0x1c1c28, bootCuff: 0xe8323e, bootSole: 0x101018, lace: 0x101018 },
    shotColor: 0xc8d0ff, sfxPitch: 1.15,
  },
  {
    id: 'robo', heroId: 'smile', name: 'Робо-Смайл', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#9aa4b4',
    desc: 'Новая модель: железный корпус, антенна с лампочкой и болты. Ходит рывками и танцует «робота»!',
    palette: { skinTop: 0xe6ecf4, skinMid: 0xb4bccb, skinBottom: 0x77819a, limb: 0x9aa4b4, lid: 0xc4ccd8, forehead: 0xd8dee8, blush: 0x5fc8ff, vest: 0x3a4458, vestTrim: 0x2b3245, strap: 0x5a6478, pouch: 0x5a6478, pouchFlap: 0x4a5468, glove: 0x5a6478, gloveCuff: 0xffd23f, boot: 0x4a5468, bootCuff: 0xffd23f, bootSole: 0x2b3245, grenade: 0xc8d0de },
    shotColor: 0x5fc8ff, sfxPitch: 0.8,
  },
  {
    id: 'mint', heroId: 'smile', name: 'Мятный Смайл', price: 250, currency: 'bling', rarity: 'rare', cardColor: '#5ee0a8',
    desc: 'Цветовая вариация: свежий мятный цвет.',
    palette: { skinTop: 0xa8ffd6, skinMid: 0x6fe8b0, skinBottom: 0x2fb57d, limb: 0x6fe8b0, lid: 0x7ff0bd, forehead: 0x9af8cc, blush: 0xff7fa8, capBlue: 0xff7fa8, capSeam: 0xc2416e },
    shotColor: 0x6fe8b0,
  },
  {
    id: 'gold', heroId: 'smile', name: 'Золотой Смайл', price: 0, currency: 'gems', rarity: 'legendary', exclusive: 'pass', cardColor: '#ffb300',
    desc: 'Эксклюзив Боевого пропуска. Сияет, как настоящее золото!',
    palette: { skinTop: 0xfff0a0, skinMid: 0xffc933, skinBottom: 0xc8860f, limb: 0xffc933, lid: 0xffd04a, forehead: 0xffe27a, capBlue: 0x1c1c22, capOrange: 0xffd23f, capSeam: 0x8a6a10, vest: 0x1c1c22, vestTrim: 0xffd23f, glove: 0x1c1c22, boot: 0x1c1c22, grenade: 0xffe27a },
    shotColor: 0xffd23f, sfxPitch: 1.1,
  },
  // спортивная коллекция
  {
    id: 'basketball', heroId: 'smile', name: 'Смайл-Баскетболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#6a2cc0',
    desc: 'Спортивная коллекция: майка с номером 23, повязка и мяч в руке. На бегу ведёт мяч!',
    kit: { main: 0x6a2cc0, accent: 0xffd23f, number: '23' },
    palette: { vest: 0x6a2cc0, vestTrim: 0xffd23f, strap: 0xffd23f, pouch: 0x6a2cc0, pouchFlap: 0x4a1c90, glove: 0xffbb22, gloveCuff: 0xffd23f, boot: 0xffffff, bootCuff: 0x6a2cc0, bootSole: 0xffd23f, lace: 0x6a2cc0 },
    shotColor: 0xff8a2a, sfxPitch: 1.05,
  },
  {
    id: 'football', heroId: 'smile', name: 'Смайл-Футболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#2b6fe8',
    desc: 'Спортивная коллекция: футболка с номером 10, бутсы и мяч у ног. В меню чеканит мяч!',
    kit: { main: 0x2b6fe8, accent: 0xffffff, number: '10' },
    palette: { vest: 0x2b6fe8, vestTrim: 0xffffff, strap: 0xffffff, pouch: 0x2b6fe8, pouchFlap: 0x1f50b0, glove: 0xffbb22, gloveCuff: 0xffffff, boot: 0x1c1c22, bootCuff: 0xffffff, bootSole: 0xff4b55, lace: 0xffffff },
    shotColor: 0xffffff, sfxPitch: 1.1,
  },
  {
    id: 'baseball', heroId: 'smile', name: 'Смайл-Бейсболист', price: 79, currency: 'gems', rarity: 'epic', cardColor: '#1f3a7a',
    desc: 'Спортивная коллекция: командная кепка, форма с номером 7, перчатка и бита на плече.',
    kit: { main: 0x1f3a7a, accent: 0xe8323e, number: '7' },
    palette: { capBlue: 0x1f3a7a, capSeam: 0x14285a, capOrange: 0xe8323e, capUnder: 0x9a1f28, vest: 0xf4f4f8, vestTrim: 0x1f3a7a, strap: 0x1f3a7a, pouch: 0x1f3a7a, pouchFlap: 0x14285a, glove: 0x8a4a1f, gloveCuff: 0x5a2a10, boot: 0x1f3a7a, bootCuff: 0xe8323e, bootSole: 0xf4f4f8 },
    shotColor: 0xf4f4f8, sfxPitch: 0.95,
  },
];
