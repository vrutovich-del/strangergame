// Общие окна покупок: подтверждение с балансом после покупки, «Не хватает валюты» с подсказкой, шансы ящика и Метеорчика.
import { sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { ECONOMY, TROPHY_ROAD, type BoxKind, type Currency } from '../../meta/economy';
import { BOX_ICON, canAfford, DROP_STEPS } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { CUR_ICON, CUR_NAME } from '../common';
import { btn, fmtNum, h, modal } from '../dom';
import { icon } from '../icons';

/** Картинка товара для окна: портрет героя/скина в цветном окне или стикер-иконка. */
export function buyArt(o: { img?: string; bg?: string; glyph?: string }) {
  if (o.img) return h('div.buy-art', { style: { background: `var(--dots), ${o.bg ?? 'var(--sky)'}` } }, h('img', { src: o.img, alt: '' }));
  return h('div.buy-art.glyph', { style: { background: `var(--dots), ${o.bg ?? 'var(--paper-2)'}` } }, icon(o.glyph ?? 'gem', 'b'));
}

/**
 * Подтверждение покупки: что покупаем, баланс «было → станет», «Отмена» и кнопка с ценой.
 * Если валюты не хватает — сразу окно «Не хватает».
 */
export function confirmBuy(app: App, o: { title: string; sub?: string; cur: Currency; price: number; art: HTMLElement; onBuy: () => void }) {
  const s = store.data;
  if (!canAfford(s, o.cur, o.price)) { poorBox(app, o.cur, o.price, o.title); return; }
  let close = () => {};
  const body = h('div.buy',
    h('div.buy-row', o.art,
      h('div.buy-info',
        h('div.m-title', `Купить «${o.title}»?`),
        o.sub ? h('div.m-text', o.sub) : null,
        h('div.buy-bal', h('span.muted', 'Баланс:'), icon(CUR_ICON[o.cur]), fmtNum(s[o.cur]), icon('chev', 'a', 'small'), h('span.buy-after', fmtNum(s[o.cur] - o.price))),
      ),
    ),
    h('div.m-actions',
      btn('Отмена', () => close(), 'paper sm'),
      btn([icon(CUR_ICON[o.cur]), h('span.num', fmtNum(o.price))], () => { close(); o.onBuy(); }, 'lime sm price'),
    ),
  );
  close = modal(body, { cls: 'buy-modal' });
}

/** «Не хватает»: сколько, у тебя сейчас и где заработать — с кнопками в нужный раздел. */
export function poorBox(app: App, cur: Currency, price: number, what?: string) {
  const s = store.data;
  const short = Math.max(0, price - s[cur]);
  sfx('nope');
  const chip = document.querySelector(`.cur[data-cur="${cur}"]`) as HTMLElement | null;
  if (chip) { chip.classList.remove('lack'); void chip.offsetWidth; chip.classList.add('lack'); setTimeout(() => chip.classList.remove('lack'), 900); }
  let close = () => {};
  const go = (fn: () => void) => () => { close(); fn(); };
  const roadAt = TROPHY_ROAD.find((m) => m.reward.kind === cur && m.at > s.bestTrophies);
  const rows: { glyph: string; t: string; d: string; b: string; bg: string; act: () => void }[] = [];
  const toBattle = { glyph: 'meteor', t: 'Бои и Метеорчики', d: 'за каждую победу прилетает Метеорчик', b: 'В бой', bg: 'var(--yolk)', act: () => app.toLobby() };
  if (cur === 'coins') {
    rows.push({ glyph: 'trophy', t: 'Бои', d: 'монеты дают за каждый бой', b: 'В бой', bg: 'var(--yolk)', act: () => app.toLobby() });
    rows.push({ glyph: 'quests', t: 'Задания', d: 'каждый день три новых', b: 'Задания', bg: 'var(--lime)', act: () => app.open('quests') });
  } else if (cur === 'gems') {
    rows.push({ glyph: 'gem', t: 'Подарок дня', d: 'бесплатные кристаллы каждый день', b: 'Магазин', bg: 'var(--tang)', act: () => app.open('shop', 'gift') });
    rows.push({ glyph: 'coin', t: 'Кристаллы за монеты', d: 'горсть, мешок или сундук', b: 'Обмен', bg: 'var(--sky)', act: () => app.open('shop', 'gems') });
    rows.push(toBattle);
  } else {
    rows.push(toBattle);
    rows.push({ glyph: 'box2', t: 'Ящики', d: 'блинги внутри с шансом 30–80%', b: 'Ящики', bg: 'var(--tang)', act: () => app.open('shop', 'boxes') });
  }
  if (roadAt) rows.push({ glyph: 'flag', t: 'Дорога трофеев', d: `на ${fmtNum(roadAt.at)} трофеях — награда`, b: 'Дорога', bg: 'var(--mint)', act: () => app.open('road') });
  const body = h('div.poor',
    h('div.buy-row',
      h('div.m-art', { style: 'transform:rotate(-8deg)' }, icon(CUR_ICON[cur], 'b')),
      h('div.buy-info',
        h('div.m-title', `Не хватает ${fmtNum(short)} ${CUR_NAME[cur]}`),
        h('div.m-text', `У тебя ${fmtNum(s[cur])}${what ? `, а «${what}» стоит ${fmtNum(price)}` : `, а нужно ${fmtNum(price)}`}. Вот где их взять:`),
      ),
    ),
    ...rows.slice(0, 3).map((r) => h('div.earn',
      icon(r.glyph),
      h('div.earn-t', h('b', r.t), h('span', r.d)),
      btn([r.b, icon('chev')], go(r.act), 'xs', { style: { background: r.bg } }),
    )),
  );
  close = modal(body, { cls: 'poor-modal' });
}

const PCT = (x: number) => `${Math.round(x * 1000) / 10}%`.replace('.', ',');

/** Шансы ящика: монеты всегда, остальное — с шансом. Честно и до открытия. */
export function boxOddsBox(kind: BoxKind) {
  const t = ECONOMY.boxes[kind];
  const rows = [
    { glyph: 'coin', t: `Монеты ${t.coins[0]}–${t.coins[1]}`, p: 1, c: 'var(--coin)' },
    { glyph: 'bling', t: `Блинги ${t.bling.min}–${t.bling.max}`, p: t.bling.chance, c: 'var(--bling)' },
    { glyph: 'gem', t: `Кристаллы ${t.gems.min}–${t.gems.max}`, p: t.gems.chance, c: 'var(--gem)' },
    { glyph: 'ticket', t: 'Скин', p: t.skin, c: 'var(--rarity-epic)' },
    { glyph: 'heroes', t: 'Новый герой', p: t.hero, c: 'var(--rarity-mythic)' },
  ];
  oddsModal(BOX_ICON[kind], `${t.name} · что внутри`, 'Каждый ящик — монеты и ещё что-то с таким шансом.', rows, 'Повтор героя или скина превращается в кристаллы — ничего не сгорает.');
}

/** Шансы Метеорчика: редкость решается сразу, тапы только показывают её. */
export function dropOddsBox() {
  const rows = DROP_STEPS.map((r) => ({ glyph: RARITY[r].shape, t: RARITY[r].name, p: ECONOMY.starrDrop.odds[r], c: RARITY[r].color }));
  oddsModal('meteor', 'Метеорчик · редкость', 'Редкость решается сразу, тапы только показывают её.', rows, 'Из Эпического и выше может выпасть скин или герой.');
}

function oddsModal(glyph: string, title: string, sub: string, rows: { glyph: string; t: string; p: number; c: string }[], note: string) {
  const list = h('div.odds',
    ...rows.map((o, i) => h('div.odd', icon(o.glyph),
      h('div.odd-t', o.t),
      h('div.bar.odd-bar', h('i', { style: { '--bc': o.c, transitionDelay: `${i * 80}ms` } as any })),
      h('div.odd-p.num', PCT(o.p)))),
  );
  modal(h('div.odds-box',
    h('div.buy-row', icon(glyph, 'b', 'odds-ic'), h('div.buy-info', h('div.m-title', title), h('div.m-small', sub))),
    list,
    h('div.field-note', icon('info'), note),
  ), { cls: 'odds-modal', top: true });
  // полосы заполняются по очереди
  requestAnimationFrame(() => requestAnimationFrame(() => {
    list.querySelectorAll('.odd-bar > i').forEach((el, i) => (el as HTMLElement).style.setProperty('--p', String(Math.max(0.02, rows[i].p))));
  }));
}
