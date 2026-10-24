// Боевой пропуск: 30 уровней, бесплатная и премиум-линии, таймер сезона, финальный эксклюзивный скин на видном месте.
import { sfx } from '../../audio/sfx';
import { getSkin } from '../../heroes/skins';
import { ECONOMY, passRewards, type Reward } from '../../meta/economy';
import { BOX_ICON, buyPremiumPass, claimPass, ensureSeason, passTier, rewardLabel, seasonInfo } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { headChip, refreshCurrencies, screenHead, wallet } from '../common';
import { btn, fmtLeft, fmtNum, h } from '../dom';
import { icon } from '../icons';
import { boxOverlay } from './boxes';
import type { Screen } from './index';
import { buyArt, confirmBuy } from './modals';
import { specialRewards } from './rewards';
import { enableDragScroll } from './shop';

export function passScreen(app: App): Screen {
  const s = store.data;
  ensureSeason(s);
  const { season, endsAt } = seasonInfo();
  const tier = passTier(s.pass.xp);
  const rw = passRewards(season);
  const T = ECONOMY.pass.tiers;
  const refresh = () => { const keep = scroller.scrollLeft; app.setScreen('pass', passScreen(app)); const sc = document.querySelector('.pass-scroll') as HTMLElement | null; if (sc) sc.scrollLeft = keep; };
  const claim = (t: number, premium: boolean) => {
    const r = (premium ? rw.premium : rw.free)[t - 1];
    const before = wallet();
    const got = claimPass(s, t, premium);
    store.commit();
    if (!got) return;
    if (r.kind === 'box') boxOverlay(app, r.box, got, refresh);
    else if (r.kind === 'skin' || r.kind === 'hero') specialRewards(app, got, refresh);
    else { sfx('reward'); refresh(); refreshCurrencies(before); }
  };
  const cellArt = (r: Reward) => {
    if (r.kind === 'skin') return [h('img', { src: app.portrait(r.heroId, r.skinId), alt: '' }), h('div.pc-amt', getSkin(r.heroId, r.skinId).name)];
    const l = rewardLabel(r);
    return [icon(r.kind === 'box' ? BOX_ICON[r.box] : l.icon, 'b'), h('div.pc-amt.num', r.kind === 'box' ? (r.box === 'mega' ? 'мега' : r.box === 'big' ? 'большой' : 'ящик') : fmtNum(Number(l.text)))];
  };
  const cols: HTMLElement[] = [];
  for (let t = 1; t <= T; t++) {
    const reached = tier >= t;
    const cell = (premium: boolean) => {
      const claimed = (premium ? s.pass.prem : s.pass.free).includes(t);
      const r = (premium ? rw.premium : rw.free)[t - 1];
      const locked = premium && !s.pass.premium;
      const can = reached && !locked && !claimed;
      return [
        h('div.p-cell' + (premium ? '.prem' : '') + (claimed ? '.done' : '') + (can ? '.can' : '') + (locked ? '.locked' : '') + (r.kind === 'skin' ? '.skin' : ''),
          { style: r.kind === 'skin' && !claimed ? { background: `var(--dots), ${getSkin(r.heroId, r.skinId).cardColor}` } : undefined },
          ...cellArt(r),
          claimed ? h('div.p-check', icon('check')) : locked ? icon('lock', 'a', 'p-lock') : null),
        can ? btn('Забрать', () => claim(t, premium), 'lime xs p-claim' + (premium ? ' bottom' : '')) : null,
      ];
    };
    cols.push(h('div.p-col', ...cell(false), h('div.p-n.num' + (reached ? '.on' : ''), String(t)), ...cell(true)));
  }
  const xpIn = s.pass.xp - tier * ECONOMY.pass.xpPerTier;
  const final = rw.premium[T - 1];
  const finalSkin = final.kind === 'skin' ? getSkin(final.heroId, final.skinId) : null;
  const premiumBtn = s.pass.premium
    ? h('div.prem-on', icon('check'), 'Премиум открыт')
    : btn(['Премиум', h('span.price-chip', icon('gem'), String(ECONOMY.pass.premiumPrice))], () => confirmBuy(app, {
      title: 'Премиум-пропуск', sub: 'Вторая линия наград: спортивные скины, мега-ящики и эксклюзивный скин в конце.', cur: 'gems', price: ECONOMY.pass.premiumPrice,
      art: buyArt({ glyph: 'ticket', bg: '#ff6fb5' }),
      onBuy: () => { const before = wallet(); if (buyPremiumPass(store.data)) { store.commit(); sfx('levelup'); refresh(); refreshCurrencies(before); } },
    }), 'gum prem-btn');
  const finalCard = h('div.pass-final',
    h('div.pf-win', finalSkin ? h('img', { src: app.portrait((final as any).heroId, (final as any).skinId), alt: '' }) : null, h('div.pf-tag', `Ур. ${T} · эксклюзив`)),
    h('div.pf-foot', h('div.pf-name.ds', finalSkin?.name ?? 'Эксклюзив'), premiumBtn),
  );
  // полоса прогресса: заполняется до текущего уровня
  const COLW = 92; // ширина колонки + отступ, в --k
  const fillW = tier >= T ? COLW * T : COLW * (tier - 0.5) + COLW * (xpIn / ECONOMY.pass.xpPerTier);
  const lane = h('div.p-lane', { style: { width: `calc(${COLW * T + 90} * var(--k))` } },
    h('div.p-bar', h('div.p-fill', { style: { width: `calc(${Math.max(0, fillW) + 78} * var(--k))` } })),
    h('div.p-cols', ...cols),
  );
  const scroller = h('div.hscroll.pass-scroll', lane);
  const el = h('div.screen.pass',
    screenHead(app, 'Боевой пропуск', {
      glyph: 'ticket', bg: 'var(--gum)', cur: [],
      extra: [headChip('timer', `Сезон ${season} · ещё ${fmtLeft(endsAt - Date.now())}`, true), headChip('passpt', tier >= T ? `Ур. ${T} · максимум` : `Ур. ${tier} · ${xpIn} / ${ECONOMY.pass.xpPerTier}`)],
    }),
    finalCard,
    h('div.pass-area', h('div.p-labels', h('div.p-lab', 'Бесплатно'), h('div.p-lab.prem', 'Премиум')), scroller),
  );
  return {
    el,
    onShow() {
      enableDragScroll(scroller);
      const col = scroller.querySelectorAll('.p-col')[Math.max(0, tier - 2)] as HTMLElement | undefined;
      if (col) scroller.scrollTo({ left: Math.max(0, col.offsetLeft - 70), behavior: 'smooth' });
    },
  };
}
