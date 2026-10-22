// Магазин: ежедневная акция, герои, скины, ящики, кристаллы, эмоции. Нигде нет реальных денег.
import { sfx } from '../../audio/sfx';
import { getHero, playableHeroes } from '../../heroes/registry';
import { skinsOf, type SkinDef } from '../../heroes/skins';
import { EMOTE_LIST } from '../../render/battleView';
import { ECONOMY, type BoxKind, type Currency } from '../../meta/economy';
import { boxOdds, buyEmote, buyHero, buySkin, canAfford, dailyDeal, grant, heroPrice, ownsHero, ownsSkin, spend } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { rewardCard, topBar } from '../common';
import { btn, confirmBox, h, modal, toast } from '../dom';
import { boxOverlay, rarityBadge } from './boxes';
import type { Screen } from './index';

const CUR = { coins: '🪙', gems: '💎', bling: '✨' };
const LACK = { coins: 'Не хватает монет', gems: 'Не хватает кристаллов', bling: 'Не хватает блингов' };

/** Кнопки «купить героя» — по одной на каждую валюту, с подтверждением. */
export function heroBuyButtons(heroId: string, onBought: () => void) {
  const s = store.data;
  const d = getHero(heroId);
  return h('div.hero-prices', ...(['coins', 'gems', 'bling'] as Currency[]).map((cur) => {
    const price = heroPrice(heroId, cur);
    const can = canAfford(s, cur, price);
    return btn([h('span.hp-ico', CUR[cur]), h('span.hp-val', String(price))], () => {
      if (!canAfford(s, cur, price)) { toast(LACK[cur], 'bad'); return; }
      confirmBox('Купить героя?', `${d.name} за ${CUR[cur]} ${price}. Герой откроется сразу.`, 'Купить', () => {
        if (!buyHero(s, heroId, cur)) return;
        store.commit();
        sfx('levelup');
        toast(`Новый герой: ${d.name}!`, 'good');
        onBought();
      });
    }, cur === 'gems' ? 'btn-green' : cur === 'bling' ? 'btn-purple' : 'btn-yellow', { class: 'btn-sm hp-btn' + (can ? '' : ' cant') });
  }));
}

export function shopScreen(app: App, section?: string): Screen {
  const s = store.data;
  const refresh = () => app.open('shop', section);
  const priceBtn = (cur: 'coins' | 'gems' | 'bling', amount: number, onBuy: () => void, label?: string) =>
    btn(label ?? [CUR[cur], String(amount)], () => {
      if (!canAfford(s, cur, amount)) { toast(LACK[cur], 'bad'); return; }
      onBuy();
    }, cur === 'gems' ? 'btn-green' : cur === 'bling' ? 'btn-purple' : 'btn-yellow', { class: 'btn-sm' });

  // ежедневная акция
  const deal = dailyDeal();
  const dealCard = h('div.offer.deal',
    h('div.offer-tag', 'Акция дня'),
    rewardCard(deal.reward),
    h('div.offer-title.t', deal.title),
    deal.old ? h('div.old-price', `${CUR[deal.price.currency]} ${deal.old}`) : null,
    s.shop.deal ? h('div.sold.t', 'Куплено ✔') : priceBtn(deal.price.currency, deal.price.amount, () => {
      spend(s, deal.price.currency, deal.price.amount);
      s.shop.deal = true;
      if (deal.reward.kind === 'box') { const box = deal.reward.box; const got = grant(s, deal.reward); store.commit(); boxOverlay(app, box, got, refresh); }
      else { grant(s, deal.reward); store.commit(); sfx('buy'); toast('Куплено!', 'good'); refresh(); }
    }),
  );

  // герои: любого закрытого героя можно купить за монеты, кристаллы или блинги
  const locked = playableHeroes().filter((d) => !ownsHero(s, d.id));
  const heroCards = locked.length
    ? locked.map((d) => h('div.offer.hero', { style: { '--rc': d.color } as any },
      h('img.offer-img', { src: app.portrait(d.id) }),
      h('div.offer-title.t', d.name),
      rarityBadge(d.rarity ?? 'common'),
      heroBuyButtons(d.id, refresh),
    ))
    : [h('div.offer.hero.all', h('div.offer-art', '🎉'), h('div.offer-title.t', 'Все герои открыты!'))];

  // скины: обычные и спортивная коллекция; сначала — скины открытых героев
  const skins = playableHeroes().flatMap((hd) => skinsOf(hd.id).filter((k) => k.id !== 'default' && !k.exclusive));
  skins.sort((a, b) => Number(ownsHero(s, b.heroId)) - Number(ownsHero(s, a.heroId)));
  const skinCard = (k: SkinDef) => {
    const owned = ownsSkin(s, k.heroId, k.id);
    const heroOpen = ownsHero(s, k.heroId);
    return h('div.offer.skin' + (heroOpen ? '' : '.locked'), { style: { '--sc': k.cardColor } as any },
      h('img.offer-img', { src: app.portrait(k.heroId, k.id) }),
      h('div.offer-title.t', k.name),
      h('div.offer-desc', k.desc),
      owned ? h('div.sold.t', 'Есть ✔') : !heroOpen ? h('div.sold.t', '🔒 Открой героя') : priceBtn(k.currency, k.price, () => {
        if (buySkin(s, k.heroId, k.id)) { s.heroes[k.heroId].skin = k.id; store.commit(); sfx('buy'); toast('Новый скин: ' + k.name + '!', 'good'); refresh(); }
      }),
    );
  };
  const skinCards = skins.filter((k) => !k.kit).map(skinCard);
  const sportCards = skins.filter((k) => k.kit).map(skinCard);

  // ящики
  const boxCard = (kind: BoxKind) => {
    const b = ECONOMY.boxes[kind];
    return h('div.offer.box', { style: { '--bc': b.color } as any },
      btn('i', () => modal(h('div', h('h2', b.name), h('p', 'Что может выпасть:'), h('ul.odds', ...boxOdds(kind).map((x) => h('li', x))), h('p.small', 'Скин и герой выпадают только новые. Редкие герои выпадают реже.'))), 'btn-blue', { class: 'info-btn' }),
      h('div.mini-box.' + kind, { style: { '--box': b.color } as any }, h('div.bb-lid'), h('div.bb-body', h('div.bb-emblem', '?'))),
      h('div.offer-title.t', b.name),
      priceBtn(b.price.currency, b.price.amount, () => {
        spend(s, b.price.currency, b.price.amount);
        store.commit();
        boxOverlay(app, kind, null, refresh);
      }),
    );
  };

  // кристаллы
  const gemCards = ECONOMY.gemShop.map((g) => h('div.offer.gems',
    h('div.offer-art', g.art),
    h('div.offer-title.t', g.title),
    h('div.offer-amount.t', '💎 ' + g.gems),
    g.daily
      ? (s.shop.gift ? h('div.sold.t', 'Завтра ещё!') : btn('ЗАБРАТЬ', () => { s.gems += g.gems; s.shop.gift = true; store.commit(); sfx('coin'); toast(`+${g.gems} кристаллов!`, 'good'); refresh(); }, 'btn-green', { class: 'btn-sm' }))
      : priceBtn(g.price!.currency, g.price!.amount, () => { spend(s, g.price!.currency, g.price!.amount); s.gems += g.gems; store.commit(); sfx('buy'); toast(`+${g.gems} кристаллов!`, 'good'); refresh(); }),
  ));

  // эмоции за блинги
  const emoteCards = EMOTE_LIST.map((e, i) => {
    const owned = s.emotes.includes(i);
    const price = ECONOMY.emotes[i];
    return h('div.offer.emote', h('div.offer-art.emoji', e), owned ? h('div.sold.t', 'Есть ✔') : priceBtn('bling', price, () => { if (buyEmote(s, i)) { store.commit(); sfx('buy'); refresh(); } }));
  });

  const sec = (id: string, title: string, items: HTMLElement[]) => h('div.shop-sec#sec-' + id, h('div.sec-title.t', title), h('div.sec-items', ...items));
  const body = h('div.shop-row',
    sec('deal', 'Ежедневная акция', [dealCard]),
    sec('heroes', 'Герои', heroCards),
    sec('sport', '🏀 Спортивные скины ⚽', sportCards),
    sec('skins', 'Скины', skinCards),
    sec('boxes', 'Ящики', (['common', 'big', 'mega'] as BoxKind[]).map(boxCard)),
    sec('gems', 'Кристаллы', gemCards),
    sec('emotes', 'Эмоции за блинги', emoteCards),
  );
  const scroller = h('div.hscroll', body);
  const el = h('div.screen.panel-screen.shop', topBar(app, { title: 'Магазин', back: true }), scroller, h('div.shop-note', 'Все покупки — только за игровую валюту. Настоящие деньги здесь не нужны!'));
  return {
    el,
    onShow() {
      if (section) {
        const t = el.querySelector('#sec-' + section) as HTMLElement | null;
        if (t) scroller.scrollLeft = t.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft - 20;
      }
      enableDragScroll(scroller);
    },
  };
}

/** Прокрутка ленты пальцем и колесом мыши. */
export function enableDragScroll(el: HTMLElement) {
  let down = false, sx = 0, sl = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sl = el.scrollLeft; moved = 0; });
  window.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); el.scrollLeft = sl - dx; });
  window.addEventListener('pointerup', () => { down = false; });
  el.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } }, true);
  el.addEventListener('wheel', (e) => { el.scrollLeft += e.deltaY + e.deltaX; e.preventDefault(); }, { passive: false });
}
