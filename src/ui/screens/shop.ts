// Магазин: разделы листаются вбок, сверху вкладки-якоря. Всё — только за игровую валюту, реальных денег нет.
import { sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero, playableHeroes } from '../../heroes/registry';
import { skinsOf, type SkinDef } from '../../heroes/skins';
import { ECONOMY, EMOTES, type BoxKind, type Currency } from '../../meta/economy';
import { BOX_ICON, buyEmote, buyHero, buySkin, dailyDeal, grant, heroPrice, ownsHero, ownsSkin, rewardLabel, spend } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { CUR_ICON, isNewModel, refreshCurrencies, screenHead, wallet } from '../common';
import { btn, fmtLeft, fmtNum, h, modal, toast } from '../dom';
import { icon } from '../icons';
import { boxOverlay } from './boxes';
import type { Screen } from './index';
import { boxOddsBox, buyArt, confirmBuy } from './modals';
import { newHeroMoment } from './rewards';

const R = ['18px 14px 20px 16px', '14px 18px 16px 20px', '20px 16px 18px 14px', '16px 20px 14px 18px'];
const IR = ['13px 10px 15px 11px', '10px 13px 11px 15px', '15px 11px 13px 10px', '11px 15px 10px 13px'];
const RAYS = (c: string) => `repeating-conic-gradient(from 0deg at 50% 60%, rgba(255,255,255,.25) 0 12deg, transparent 12deg 24deg), ${c}`;
const DOTS = (c: string) => `var(--dots), ${c}`;
const untilMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m.getTime() - n.getTime(); };
const once = (key: string) => { try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); return true; } catch { return false; } };

interface CardOpts {
  name: string; sub?: string | HTMLElement; bg: string; art: Element | Element[];
  tag?: [string, string]; info?: () => void; stamp?: string; sold?: boolean; ring?: string; action: HTMLElement; dot?: boolean;
}
let cardN = 0;
function card(o: CardOpts) {
  const i = cardN++;
  return h('div.offer' + (o.sold ? '.sold' : ''), { style: { borderRadius: R[i % 4], rotate: ['0deg', '.5deg', '-.5deg', '.3deg'][i % 4], '--ring': o.ring ?? 'transparent' } as any },
    h('div.of-win', { style: { borderRadius: IR[i % 4], background: o.bg } }, ...(Array.isArray(o.art) ? o.art : [o.art])),
    o.tag ? h('div.of-tag', { style: { background: o.tag[1] } }, o.tag[0]) : null,
    o.info ? h('button.of-info', { onclick: (e: Event) => { e.stopPropagation(); sfx('click'); o.info!(); }, 'aria-label': 'Шансы' }, icon('info')) : null,
    o.stamp ? h('div.of-stamp.ds', o.stamp) : null,
    o.dot ? h('div.dot') : null,
    h('div.of-name.ds', o.name),
    o.sub ? h('div.of-sub', o.sub) : null,
    h('div.of-act', o.action),
  );
}
const doneBtn = (text: string, glyph?: string) => h('div.of-done', glyph ? icon(glyph) : null, text);
const priceLabel = (cur: Currency, amount: number, old?: number) => [old ? h('s.old.num', fmtNum(old)) : null, icon(CUR_ICON[cur]), h('span.num', fmtNum(amount))];

export function shopScreen(app: App, section?: string): Screen {
  const s = store.data;
  cardN = 0;
  const refresh = () => {
    const keep = scroller.scrollLeft;
    app.setScreen('shop', shopScreen(app));
    const sc = document.querySelector('.shop-scroll') as HTMLElement | null;
    if (sc) sc.scrollLeft = keep;
  };
  /** Купили — монеты улетают из фишки, на карточке штамп. */
  const bought = (before: ReturnType<typeof wallet>, text: string) => { store.commit(); sfx('buy'); toast(text, 'good', 'check'); refresh(); refreshCurrencies(before); };

  // ── акция дня ──
  const deal = dailyDeal();
  const dl = rewardLabel(deal.reward);
  const dealIcon = deal.reward.kind === 'box' ? BOX_ICON[deal.reward.box] : dl.icon;
  const dealBg = deal.reward.kind === 'box' ? ECONOMY.boxes[deal.reward.box].color : deal.reward.kind === 'coins' ? '#ffc93a' : deal.reward.kind === 'gems' ? '#2fc2ff' : '#ff6fd0';
  const dealCard = s.shop.deal
    ? card({ name: deal.title, sub: 'куплено сегодня', bg: '#b8b1a2', art: icon(dealIcon, 'b', 'of-ic dim'), stamp: 'Куплено', sold: true, action: doneBtn(`новая через ${fmtLeft(untilMidnight())}`, 'timer') })
    : card({
      name: deal.title, sub: 'скидка на один день', bg: RAYS(dealBg), art: icon(dealIcon, 'b', 'of-ic'), tag: ['Акция дня', 'var(--gum)'], ring: 'var(--gum)',
      action: btn(priceLabel(deal.price.currency, deal.price.amount, deal.old), () => confirmBuy(app, {
        title: deal.title, sub: 'Скидка действует до конца дня', cur: deal.price.currency, price: deal.price.amount, art: buyArt({ glyph: dealIcon, bg: dealBg }),
        onBuy: () => {
          const before = wallet();
          if (!spend(s, deal.price.currency, deal.price.amount)) return;
          s.shop.deal = true;
          if (deal.reward.kind === 'box') { const box = deal.reward.box; const got = grant(s, deal.reward); store.commit(); refreshCurrencies(before); boxOverlay(app, box, got, refresh); }
          else { grant(s, deal.reward); bought(before, 'Куплено!'); }
        },
      }), 'lime sm price'),
    });

  // ── подарок дня (бесплатно) ──
  const gift = ECONOMY.gemShop.find((g) => g.daily)!;
  const giftCard = s.shop.gift
    ? card({ name: 'Подарок дня', sub: 'уже забран', bg: '#b8b1a2', art: [icon('gem', 'b', 'of-ic dim'), h('div.of-mult.num', '×' + gift.gems)], stamp: 'Забрано', sold: true, action: doneBtn('завтра снова', 'timer') })
    : card({
      name: 'Подарок дня', sub: 'каждый день новый', bg: RAYS('#44c4ff'), art: [icon('gem', 'b', 'of-ic sm'), h('div.of-mult.num', '×' + gift.gems)], ring: 'var(--lime)', dot: true,
      action: btn('Бесплатно', () => { const before = wallet(); s.gems += gift.gems; s.shop.gift = true; store.commit(); sfx('coin'); refresh(); refreshCurrencies(before); }, 'lime sm'),
    });

  // ── герои: любого закрытого можно купить за монеты, кристаллы или блинги ──
  const locked = playableHeroes().filter((d) => !ownsHero(s, d.id));
  const heroCards = locked.map((d) => {
    const Rr = RARITY[d.rarity ?? 'common'];
    return card({
      name: d.name, sub: `${Rr.name.toLowerCase()} герой`, bg: DOTS(d.color), art: h('img', { src: app.portrait(d.id), alt: '' }),
      tag: ['Герой', Rr.color],
      action: btn(['от ', ...priceLabel('coins', heroPrice(d.id, 'coins'))], () => buyHeroChooser(app, d.id, refresh), 'lime sm price'),
    });
  });

  // ── скины ──
  const skinCard = (k: SkinDef) => {
    const owned = ownsSkin(s, k.heroId, k.id);
    const heroOpen = ownsHero(s, k.heroId);
    const d = getHero(k.heroId);
    const sub = k.currency === 'bling' ? 'цветовая вариация' : `${RARITY[k.rarity].name.toLowerCase()} · ${isNewModel(k) ? 'новая модель' : 'для: ' + d.name}`;
    return card({
      name: k.name, sub, bg: DOTS(k.cardColor), art: h('img', { src: app.portrait(k.heroId, k.id), alt: '', loading: 'lazy' }),
      tag: isNewModel(k) ? ['Новая модель', 'var(--sky)'] : k.currency === 'bling' ? ['Цвет', 'var(--paper)'] : undefined, sold: owned,
      action: owned ? doneBtn('Есть', 'check') : !heroOpen ? doneBtn(`Открой: ${d.name}`, 'lock') : btn(priceLabel(k.currency, k.price), () => confirmBuy(app, {
        title: k.name, sub: `Скин для героя ${d.name}` + (isNewModel(k) ? ' · новая модель с анимациями' : ''), cur: k.currency, price: k.price,
        art: buyArt({ img: app.portrait(k.heroId, k.id), bg: k.cardColor }),
        onBuy: () => { const before = wallet(); if (buySkin(s, k.heroId, k.id)) { s.heroes[k.heroId].skin = k.id; bought(before, `Новый скин: ${k.name}!`); } },
      }), 'lime sm price'),
    });
  };
  const allSkins = playableHeroes().flatMap((hd) => skinsOf(hd.id).filter((k) => k.id !== 'default' && !k.exclusive));
  allSkins.sort((a, b) => Number(ownsSkin(s, a.heroId, a.id)) - Number(ownsSkin(s, b.heroId, b.id)) || Number(ownsHero(s, b.heroId)) - Number(ownsHero(s, a.heroId)));
  const gemSkins = allSkins.filter((k) => k.currency === 'gems' && !k.kit);
  const sportSkins = allSkins.filter((k) => k.kit);
  const blingSkins = allSkins.filter((k) => k.currency === 'bling');

  // ── ящики ──
  const boxCard = (kind: BoxKind) => {
    const b = ECONOMY.boxes[kind];
    return card({
      name: b.name, sub: 'шансы — по «i»', bg: RAYS(b.color), art: icon(BOX_ICON[kind], 'b', 'of-ic'), info: () => boxOddsBox(kind),
      action: btn(priceLabel(b.price.currency, b.price.amount), () => confirmBuy(app, {
        title: b.name, sub: 'Откроется сразу. Шансы — по кнопке «i».', cur: b.price.currency, price: b.price.amount, art: buyArt({ glyph: BOX_ICON[kind], bg: b.color }),
        onBuy: () => { const before = wallet(); if (!spend(s, b.price.currency, b.price.amount)) return; store.commit(); refreshCurrencies(before); boxOverlay(app, kind, null, refresh); },
      }), 'lime sm price'),
    });
  };

  // ── кристаллы за монеты ──
  const gemCards = ECONOMY.gemShop.filter((g) => !g.daily).map((g) => card({
    name: g.title, sub: `${g.gems} кристаллов`, bg: DOTS('#2fc2ff'), art: [icon('gem', 'b', 'of-ic g' + g.art), h('div.of-mult.num', '×' + g.gems)],
    action: btn(priceLabel(g.price!.currency, g.price!.amount), () => confirmBuy(app, {
      title: `${g.title}: ${g.gems} кристаллов`, cur: g.price!.currency, price: g.price!.amount, art: buyArt({ glyph: 'gem', bg: '#2fc2ff' }),
      onBuy: () => { const before = wallet(); if (!spend(s, g.price!.currency, g.price!.amount)) return; s.gems += g.gems; bought(before, `+${g.gems} кристаллов!`); },
    }), 'lime sm price'),
  }));

  // ── эмоции за блинги ──
  const emoteCards = EMOTES.map((e, i) => {
    const owned = s.emotes.includes(i);
    const price = ECONOMY.emotes[i];
    return card({
      name: `Эмоция «${e.name}»`, sub: 'видна всем в бою', bg: DOTS('#ffd23a'), art: icon(e.icon, 'b', 'of-ic'), sold: owned,
      action: owned ? doneBtn('Есть', 'check') : btn(priceLabel('bling', price), () => confirmBuy(app, {
        title: `Эмоция «${e.name}»`, sub: 'Показывай её в бою кнопкой эмоций', cur: 'bling', price, art: buyArt({ glyph: e.icon, bg: '#ffd23a' }),
        onBuy: () => { const before = wallet(); if (buyEmote(s, i)) bought(before, 'Новая эмоция!'); },
      }), 'lime sm price'),
    });
  });

  const SECTIONS: { id: string; tab: string; glyph: string; title: string; timer?: string; cards: HTMLElement[]; dot?: boolean }[] = [
    { id: 'deal', tab: 'Акция', glyph: 'timer', title: 'Акция дня', timer: s.shop.deal ? undefined : `новая через ${fmtLeft(untilMidnight())}`, cards: [dealCard] },
    { id: 'gift', tab: 'Подарок', glyph: 'gem', title: 'Подарок дня', cards: [giftCard], dot: !s.shop.gift },
    { id: 'heroes', tab: 'Герои', glyph: 'heroes', title: 'Герои', cards: heroCards },
    { id: 'skins', tab: 'Скины', glyph: 'ticket', title: 'Скины', cards: gemSkins.map(skinCard) },
    { id: 'sport', tab: 'Спорт', glyph: 'star', title: 'Спортивная коллекция', cards: sportSkins.map(skinCard) },
    { id: 'boxes', tab: 'Ящики', glyph: 'box2', title: 'Ящики', cards: (['common', 'big', 'mega'] as BoxKind[]).map(boxCard) },
    { id: 'gems', tab: 'Кристаллы', glyph: 'gem', title: 'Кристаллы за монеты', cards: gemCards },
    { id: 'emotes', tab: 'Эмоции', glyph: 'emote', title: 'Эмоции и вариации за блинги', cards: [...emoteCards, ...blingSkins.map(skinCard)] },
  ].filter((x) => x.cards.length);

  const row = h('div.shop-row', ...SECTIONS.map((x) => h('div.shop-sec', { 'data-sec': x.id },
    h('div.sec-head.on-sea', x.title, x.timer ? h('span.sec-timer', icon('timer'), x.timer) : null),
    h('div.sec-cards', ...x.cards))));
  const scroller = h('div.hscroll.shop-scroll', row);
  const tabs = h('div.shop-tabs', ...SECTIONS.map((x) => h('button.stab', { 'data-sec': x.id, onclick: () => { sfx('tab'); scrollTo(x.id, true); } }, icon(x.glyph), x.tab, x.dot ? h('div.dot') : null)));
  const scrollTo = (id: string, smooth = false) => {
    const t = row.querySelector(`[data-sec="${id}"]`) as HTMLElement | null;
    if (!t) return;
    scroller.scrollTo({ left: Math.max(0, t.offsetLeft - 4), behavior: smooth ? 'smooth' : 'auto' });
  };
  const syncTabs = () => {
    let cur = SECTIONS[0].id;
    for (const sec of Array.from(row.children) as HTMLElement[]) if (sec.offsetLeft - 40 <= scroller.scrollLeft) cur = sec.dataset.sec!;
    if (scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4) cur = SECTIONS[SECTIONS.length - 1].id;
    tabs.querySelectorAll('.stab').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.sec === cur));
  };
  scroller.addEventListener('scroll', syncTabs, { passive: true });

  const title = h('div.s-title.ds.shop-title', icon('bag'), 'Магазин');
  const head = screenHead(app, 'Магазин');
  head.querySelector('.s-title')!.replaceWith(title);
  const tip = once('tip-shop') && !s.shop.gift ? h('div.tipbar.shop-tip', icon('info', 'b'), 'Подарок дня — бесплатно. Заходи за ним каждый день!') : null;
  const el = h('div.screen.shop', head, tabs, scroller, tip);
  return {
    el,
    onShow() {
      enableDragScroll(scroller);
      const map: Record<string, string> = { gems: 'gems', emotes: 'emotes', bling: 'emotes', gift: 'gift', boxes: 'boxes', heroes: 'heroes', skins: 'skins', deal: 'deal' };
      if (section && map[section]) scrollTo(map[section]);
      syncTabs();
    },
  };
}

/** Купить героя: выбрать валюту (монеты, кристаллы или блинги) и подтвердить. */
export function buyHeroChooser(app: App, heroId: string, after: () => void) {
  const d = getHero(heroId);
  let close = () => {};
  const opt = (cur: Currency) => btn(priceLabel(cur, heroPrice(heroId, cur)), () => {
    close();
    confirmBuy(app, {
      title: d.name, sub: 'Герой откроется сразу', cur, price: heroPrice(heroId, cur), art: buyArt({ img: app.portrait(heroId), bg: d.color }),
      onBuy: () => {
        const before = wallet();
        if (!buyHero(store.data, heroId, cur)) return;
        store.commit();
        refreshCurrencies(before);
        newHeroMoment(app, heroId, after);
      },
    });
  }, 'lime sm price');
  close = modal(h('div.buy',
    h('div.buy-row', buyArt({ img: app.portrait(heroId), bg: d.color }),
      h('div.buy-info', h('div.m-title', `Купить героя «${d.name}»?`), h('div.m-text', 'Выбери, чем удобнее заплатить.'))),
    h('div.buy3', opt('coins'), opt('gems'), opt('bling')),
  ), { cls: 'buy-modal' });
}

/** Прокрутка ленты пальцем и колесом мыши. Клик после протаскивания не срабатывает. */
export function enableDragScroll(el: HTMLElement) {
  if ((el as any).__drag) return;
  (el as any).__drag = true;
  let sx = 0, sl = 0, moved = 0;
  const move = (e: PointerEvent) => { const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); el.scrollLeft = sl - dx; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    sx = e.clientX; sl = el.scrollLeft; moved = 0;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  el.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  // колесо листает вбок, если под курсором нет своей вертикальной прокрутки
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
        if (e.deltaY > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return;
      }
    }
    el.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
}
