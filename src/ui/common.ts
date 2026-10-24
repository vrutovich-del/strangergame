// Общие элементы меню: заголовок раздела, фишки валют, профиль, аватар, метки редкости и уровня, плитки наград, подиум.
import { audio, sfx } from '../audio/sfx';
import { RARITY, type Rarity } from '../heroes/rarity';
import { getHero } from '../heroes/registry';
import type { SkinDef } from '../heroes/skins';
import type { Currency, Reward } from '../meta/economy';
import { BOX_ICON, canAfford, rewardLabel, totalTrophies } from '../meta/progress';
import { store } from '../meta/store';
import { cloud } from '../net/cloud';
import { backBtn, btn, countUp, fmtNum, h } from './dom';
import { icon } from './icons';

export interface Nav {
  open(screen: string, arg?: any): void;
  back(): void;
  portrait(heroId: string, skinId?: string, team?: 'blue' | 'red' | 'orange'): string;
}

export const CUR_ICON: Record<Currency, string> = { coins: 'coin', gems: 'gem', bling: 'bling' };
export const CUR_NAME: Record<Currency, string> = { coins: 'монет', gems: 'кристаллов', bling: 'блингов' };

/** Фишка валюты: монета слева «наползает» на край, число, лаймовый «+» ведёт в магазин. */
export function curChip(nav: Nav, cur: Currency, i = 0) {
  const s = store.data;
  const val = h('div.cur-val.num', fmtNum(s[cur]));
  const plus = h('button.cur-plus', { 'aria-label': 'Где взять' }, icon('plus'));
  plus.addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); nav.open('shop', cur === 'bling' ? 'emotes' : 'gems'); });
  return h('div.cur', { 'data-cur': cur, style: { rotate: ['1deg', '-1deg', '.8deg'][i % 3] } }, icon(CUR_ICON[cur], 'b', 'cur-ico'), val, plus);
}

/**
 * Валюта прибавилась: фишка подпрыгивает, горит лаймовой каймой и досчитывает число, сверху «+N».
 * Если фишки на экране нет — ничего не делаем.
 */
export function bumpCurrency(cur: Currency, from: number, to: number) {
  const chip = document.querySelector(`.cur[data-cur="${cur}"]`) as HTMLElement | null;
  if (!chip || to === from) return;
  const val = chip.querySelector('.cur-val') as HTMLElement;
  chip.classList.remove('gain'); void chip.offsetWidth; chip.classList.add('gain');
  countUp(val, from, to, 900, '', fmtNum);
  if (to > from) {
    const plus = h('div.cur-plusn.num', '+' + fmtNum(to - from));
    chip.appendChild(plus);
    setTimeout(() => plus.remove(), 1100);
    sfx('coin');
  }
  setTimeout(() => chip.classList.remove('gain'), 1100);
}

/** Обновить все фишки валют на экране после трат и наград (с отсчётом). */
export function refreshCurrencies(before: { coins: number; gems: number; bling: number }) {
  const s = store.data;
  for (const c of ['coins', 'gems', 'bling'] as Currency[]) if (s[c] !== before[c]) {
    if (s[c] > before[c]) bumpCurrency(c, before[c], s[c]);
    else { const v = document.querySelector(`.cur[data-cur="${c}"] .cur-val`) as HTMLElement | null; if (v) countUp(v, before[c], s[c], 500, '', fmtNum); }
  }
}
export const wallet = () => ({ coins: store.data.coins, gems: store.data.gems, bling: store.data.bling });

/** Аватар: портрет героя или значок на цветном фоне. */
export function avatarEl(nav: Nav, avatar: string, cls = '') {
  const el = h('div.avatar' + (cls ? '.' + cls : ''));
  if (avatar.startsWith('hero:')) {
    const id = avatar.slice(5);
    el.style.setProperty('--ab', getHero(id)?.color ?? '#8d5bff');
    el.appendChild(h('img', { src: nav.portrait(id), alt: '' }));
  } else {
    const [, glyph = 'e_happy', bg = '#ffd23a'] = avatar.split(':');
    el.style.setProperty('--ab', bg);
    el.appendChild(icon(glyph, 'a'));
  }
  return el;
}

/** Значок облачного сохранения у профиля: сохранено / сохраняется / нет связи. */
export function cloudGlyph() {
  const st = cloud.status;
  return st === 'saving' ? 'cloudsync' : st === 'error' ? 'cloudoff' : 'cloud';
}

/** Фишка профиля: аватар, ник, трофеи и значок облака. */
export function profileChip(nav: Nav) {
  const s = store.data;
  const cl = cloud.session ? h('span.pc-cloud', icon(cloudGlyph())) : null;
  if (cl && cloud.session) {
    const off = cloud.onChange(() => { if (!cl.isConnected) { off(); return; } cl.replaceChildren(icon(cloudGlyph())); });
  }
  return h('div.profile-chip', { onclick: () => { sfx('click'); nav.open('profile'); } },
    avatarEl(nav, s.avatar),
    h('div.pc-text',
      h('div.pc-nick.ds', s.nick || 'Игрок'),
      h('div.pc-tro.num', icon('trophy'), fmtNum(totalTrophies(s)), cl),
    ),
  );
}

/**
 * Заголовок раздела: «Назад», бумажная плашка с названием, дополнительные элементы и фишки валют справа.
 */
export function screenHead(nav: Nav, title: string, o: { count?: string; back?: () => void; cur?: Currency[]; extra?: (HTMLElement | null)[]; glyph?: string; bg?: string } = {}) {
  return h('div.s-head',
    backBtn(o.back ?? (() => nav.back())),
    h('div.s-title.ds' + (o.bg ? '.colored' : ''), { style: o.bg ? { background: o.bg } : undefined }, o.glyph ? icon(o.glyph) : null, title, o.count ? h('span.s-count.num', o.count) : null),
    o.extra ? h('div.s-extra', ...o.extra) : null,
    h('div.s-curs', ...(o.cur ?? ['coins', 'gems', 'bling']).map((c, i) => curChip(nav, c, i))),
  );
}

/** Фишка в заголовке раздела: таймер сезона, уровень пропуска и т. п. dark — чёрная. */
export const headChip = (glyph: string, text: string, dark = false) => h('div.head-chip' + (dark ? '.dark' : ''), icon(glyph), text);

/** Метка редкости: цвет + форма. */
export function rarityTag(r: Rarity | string, big = false) {
  const R = RARITY[(r as Rarity)] ?? RARITY.common;
  return h('span.rar' + (big ? '.big' : ''), { style: { '--rc': R.color, '--ri': R.ink } as any }, icon(R.shape), R.name);
}

/** Значок уровня: обычный, «можно прокачать» (лаймовый) и максимальный (корона). */
export function lvlBadge(level: number, state: 'normal' | 'up' | 'max' = 'normal', text?: string) {
  return h('span.lvl' + (state === 'up' ? '.up' : state === 'max' ? '.max' : ''),
    state === 'up' ? icon('up') : state === 'max' ? icon('r6') : null, text ?? `Ур. ${level}` + (state === 'max' ? ' · макс' : ''));
}

/** Лаймовый подиум-наклейка под героем (HTML; сам герой рисуется в 3D поверх). */
export const podium = (cls = '') => h('div.podium' + (cls ? '.' + cls : ''));

/** Цвет кляксы за героем: цвет героя, смешанный с морем. */
export const blobColor = (c: string) => `color-mix(in oklab, ${c} 45%, #1aa7ac)`;

/** Скин «новая модель со своими анимациями» (а не перекраска). */
export const isNewModel = (sk: SkinDef) => /^Новая модель/.test(sk.desc);

/** Цвет плитки по типу награды. */
const TILE_BG: Partial<Record<Reward['kind'] | 'future', string>> = { box: '#3fa9ff' };

/**
 * Плитка награды. size: 'list' — 72 (в списках), 'win' — 124×148 (в окнах).
 * Цвет плитки — тип награды, кайма — редкость.
 */
export function rewardTile(nav: Nav, r: Reward | { kind: 'future'; text: string }, size: 'list' | 'win' = 'list') {
  const l = rewardLabel(r);
  if (r.kind === 'hero') {
    const d = getHero(r.heroId);
    const R = RARITY[d.rarity ?? 'common'];
    return h('div.rtile.' + size + '.hero', { style: { '--rc': R.color, '--hc': d.color } as any },
      h('img', { src: nav.portrait(r.heroId), alt: '' }),
      size === 'win' ? h('div.rt-cap', h('b.ds', d.name), h('span', 'новый герой')) : null);
  }
  if (r.kind === 'skin') {
    return h('div.rtile.' + size + '.skin', { style: { '--rc': RARITY[r.skinId === 'default' ? 'common' : 'rare'].color } as any },
      h('img', { src: nav.portrait(r.heroId, r.skinId), alt: '' }),
      size === 'win' ? h('div.rt-cap', h('b.ds', l.text), h('span', 'скин')) : null);
  }
  if (r.kind === 'box') {
    return h('div.rtile.' + size + '.box', { style: { background: ['#3fa9ff', '#b45cff', '#ff4fa3'][['common', 'big', 'mega'].indexOf(r.box)] } },
      icon(BOX_ICON[r.box], size === 'win' ? 'b' : 'a'), size === 'win' ? h('div.rt-name.ds', l.text) : null);
  }
  if (r.kind === 'future') return h('div.rtile.' + size + '.future', icon('lock'), h('div.rt-n', l.text));
  return h('div.rtile.' + size + '.' + r.kind, { style: TILE_BG[r.kind] ? { background: TILE_BG[r.kind]! } : undefined },
    icon(l.icon, size === 'win' ? 'b' : 'a'),
    h('div.rt-n.num', size === 'win' ? '×' + fmtNum(Number(l.text)) : fmtNum(Number(l.text)) || l.text),
    size === 'win' ? h('div.rt-name', r.kind === 'coins' ? 'монеты' : r.kind === 'gems' ? 'кристаллы' : r.kind === 'bling' ? 'блинги' : 'эмоция') : null,
  );
}

/**
 * Кнопка с ценой. Если не хватает — всё равно нажимается: покажет окно «Не хватает» с подсказкой, где взять.
 */
export function priceBtn(cur: Currency, amount: number, onBuy: () => void, cls = 'lime', onPoor?: () => void, old?: number) {
  const s = store.data;
  const ok = canAfford(s, cur, amount);
  const b = btn([old ? h('s.old.num', fmtNum(old)) : null, icon(CUR_ICON[cur]), h('span.num', fmtNum(amount))], () => {
    if (!canAfford(store.data, cur, amount)) { sfx('nope'); audio.vibrate(12); onPoor?.(); return; }
    onBuy();
  }, cls + ' price');
  if (!ok) b.classList.add('poor');
  return b;
}
