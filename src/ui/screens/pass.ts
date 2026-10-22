// Боевой пропуск: 30 уровней, бесплатная и премиум-линии, таймер сезона.
import { sfx } from '../../audio/sfx';
import { getSkin } from '../../heroes/skins';
import { ECONOMY, passRewards } from '../../meta/economy';
import { buyPremiumPass, claimPass, ensureSeason, passTier, seasonInfo } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { rewardCard, topBar } from '../common';
import { btn, confirmBox, h, toast } from '../dom';
import { boxOverlay } from './boxes';
import type { Screen } from './index';
import { enableDragScroll } from './shop';

export function passScreen(app: App): Screen {
  const s = store.data;
  ensureSeason(s);
  const { season, endsAt } = seasonInfo();
  const tier = passTier(s.pass.xp);
  const rw = passRewards(season);
  const refresh = () => app.open('pass');
  const claim = (t: number, premium: boolean) => {
    const r = (premium ? rw.premium : rw.free)[t - 1];
    const got = claimPass(s, t, premium);
    store.commit();
    if (!got) return;
    if (r.kind === 'box') boxOverlay(app, r.box, got, refresh);
    else {
      sfx(r.kind === 'skin' ? 'levelup' : 'reward');
      const g = got[0];
      if (r.kind === 'skin') toast(g?.kind === 'gems' ? `Скин уже был — вместо него 💎 ${g.amount}` : `Новый скин: ${getSkin(r.heroId, r.skinId).name}!`, 'good');
      refresh();
    }
  };
  const cols: HTMLElement[] = [];
  for (let t = 1; t <= ECONOMY.pass.tiers; t++) {
    const reached = tier >= t;
    const cell = (premium: boolean) => {
      const claimed = (premium ? s.pass.prem : s.pass.free).includes(t);
      const r = (premium ? rw.premium : rw.free)[t - 1];
      const locked = premium && !s.pass.premium;
      return h('div.pass-cell' + (premium ? '.prem' : '') + (claimed ? '.claimed' : '') + (reached ? '.reached' : '') + (r.kind === 'skin' ? '.has-skin' : '') + (t === ECONOMY.pass.tiers ? '.final' : ''),
        r.kind === 'skin' ? h('img.pass-skin', { src: app.portrait(r.heroId, r.skinId) }) : null,
        rewardCard(r),
        claimed ? h('div.sold.t', '✔') : reached && !locked ? btn('Забрать', () => claim(t, premium), 'btn-green', { class: 'btn-xs' }) : h('div.locked-tag', locked ? '🔒' : ''),
      );
    };
    cols.push(h('div.pass-col', h('div.pass-tier.t' + (reached ? '.on' : ''), String(t)), cell(false), cell(true)));
  }
  const left = Math.max(0, endsAt - Date.now());
  const days = Math.floor(left / 86400000), hours = Math.floor((left % 86400000) / 3600000);
  const xpIn = s.pass.xp - tier * ECONOMY.pass.xpPerTier;
  const head = h('div.pass-head',
    h('div.ph-timer', h('b.t', `Сезон ${season}`), ` · ⏳ ещё ${days} д ${hours} ч`),
    h('div.ph-xp', h('span.t', `Ур. ${tier}/${ECONOMY.pass.tiers}`), tier < ECONOMY.pass.tiers ? h('div.xp-bar', h('div.xp-fill', { style: { width: `${(xpIn / ECONOMY.pass.xpPerTier) * 100}%` } }), h('span.xp-text', `${xpIn} / ${ECONOMY.pass.xpPerTier} ⭐`)) : h('span', ' Максимум!')),
    s.pass.premium ? h('div.prem-on.t', '👑 Премиум открыт') : btn(['👑 Премиум за ', h('span', '💎 ' + ECONOMY.pass.premiumPrice)], () => {
      if (s.gems < ECONOMY.pass.premiumPrice) { toast('Не хватает кристаллов', 'bad'); return; }
      confirmBox('Открыть премиум?', `Премиум-линия наград за ${ECONOMY.pass.premiumPrice} кристаллов. Внутри — спортивные скины, а в конце — эксклюзивный скин!`, 'Открыть', () => {
        if (buyPremiumPass(s)) { store.commit(); sfx('levelup'); toast('Премиум открыт!', 'good'); refresh(); }
      });
    }, 'btn-yellow', { class: 'btn-sm' }),
  );
  const labels = h('div.pass-labels', h('div', 'Бесплатно'), h('div.t', '👑 Премиум'));
  const scroller = h('div.hscroll', h('div.pass-row', ...cols));
  const el = h('div.screen.panel-screen.pass', topBar(app, { title: 'Боевой пропуск', back: true }), head, h('div.pass-body', labels, scroller),
    h('div.shop-note', 'Очки пропуска ⭐ дают за бои и задания.'));
  return {
    el,
    onShow() {
      enableDragScroll(scroller);
      const col = scroller.querySelectorAll('.pass-col')[Math.max(0, tier - 2)] as HTMLElement | undefined;
      if (col) scroller.scrollLeft = col.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft - 10;
    },
  };
}
