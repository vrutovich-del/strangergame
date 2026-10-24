// Дорога трофеев: лента вбок, полоса прогресса с аватаром игрока, награды над отметками, «Забрать», будущие герои.
import { sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { ECONOMY, TROPHY_ROAD, type Reward } from '../../meta/economy';
import { BOX_ICON, claimRoad, ownsHero, rewardLabel, totalTrophies } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { avatarEl, headChip, refreshCurrencies, screenHead, wallet } from '../common';
import { btn, fmtNum, h } from '../dom';
import { icon } from '../icons';
import { boxOverlay } from './boxes';
import type { Screen } from './index';
import { specialRewards } from './rewards';
import { enableDragScroll } from './shop';

const X0 = 110, STEP = 132;
const RR = ['18px 14px 20px 16px', '14px 18px 16px 20px', '20px 16px 18px 14px'];

/** Позиция на ленте (в единицах --k) для числа трофеев. */
function posFor(t: number) {
  const L = TROPHY_ROAD;
  if (t <= 0) return X0 - 80;
  if (t <= L[0].at) return X0 - 80 + 80 * (t / L[0].at);
  for (let i = 1; i < L.length; i++) if (t <= L[i].at) return X0 + STEP * (i - 1 + (t - L[i - 1].at) / (L[i].at - L[i - 1].at));
  return X0 + STEP * (L.length - 1) + 40;
}

export function roadScreen(app: App): Screen {
  const s = store.data;
  const total = totalTrophies(s);
  const best = s.bestTrophies;
  const refresh = () => { const keep = scroller.scrollLeft; app.setScreen('road', roadScreen(app)); const sc = document.querySelector('.road-scroll') as HTMLElement | null; if (sc) sc.scrollLeft = keep; };
  const W = X0 + STEP * (TROPHY_ROAD.length - 1) + 120;

  const items = TROPHY_ROAD.map((m, i) => {
    const reached = best >= m.at;
    const claimed = s.road.claimed.includes(m.at);
    const r = m.reward;
    const isHero = r.kind === 'hero';
    const big = isHero || r.kind === 'skin';
    const claim = reached && !claimed && r.kind !== 'future';
    let art: (HTMLElement | SVGSVGElement | null)[] = [];
    let bg = 'var(--paper)';
    if (r.kind === 'hero') {
      const d = getHero(r.heroId);
      const has = ownsHero(s, r.heroId);
      bg = `var(--dots), ${RARITY[d.rarity ?? 'common'].color}`;
      // будущий герой — загадка, открытый или уже близкий — портрет
      art = [has || best >= m.at - 150 ? h('img', { src: app.portrait(r.heroId), alt: '' }) : h('div.rd-q.ds', '?'), h('div.rd-cap.ds', d.name)];
    } else if (r.kind === 'skin') {
      bg = `var(--dots), ${getSkin(r.heroId, r.skinId).cardColor}`;
      art = [h('img', { src: app.portrait(r.heroId, r.skinId), alt: '' }), h('div.rd-cap.ds', getSkin(r.heroId, r.skinId).name)];
    } else if (r.kind === 'future') {
      art = [icon('lock', 'b'), h('div.rd-amt', r.text)];
    } else {
      const l = rewardLabel(r as Reward);
      art = [icon(r.kind === 'box' ? BOX_ICON[r.box] : l.icon, 'b'), h('div.rd-amt.num', r.kind === 'box' ? (r.box === 'mega' ? 'мега' : r.box === 'big' ? 'большой' : 'ящик') : fmtNum(Number(l.text)))];
    }
    const take = () => {
      const before = wallet();
      const got = claimRoad(store.data, m.at);
      store.commit();
      if (!got) return;
      if (r.kind === 'box') { roadMoment(app, m.at, r.box, () => boxOverlay(app, r.box, got, refresh)); return; }
      if (r.kind === 'hero' || r.kind === 'skin') { specialRewards(app, got, refresh); return; }
      sfx('reward');
      refresh();
      refreshCurrencies(before);
    };
    return h('div.rd-col' + (claimed ? '.done' : '') + (claim ? '.claim' : ''), { style: { left: `calc(${X0 + i * STEP} * var(--k))` } },
      isHero && !ownsHero(s, (r as any).heroId) && !claimed ? h('div.rd-tag.on-sea', 'Новый герой') : null,
      h('div.rd-card' + (big ? '.big' : ''), { style: { borderRadius: RR[i % 3], rotate: ['-1deg', '1deg', '-.5deg'][i % 3], background: claimed ? '#ece6d6' : bg } },
        ...art, claimed ? h('div.rd-check', icon('check')) : null),
      claim ? btn('Забрать', take, 'lime xs rd-claim') : null,
      h('div.rd-dot' + (best >= m.at ? '.on' : '')),
      h('div.rd-at.on-sea.num', icon('trophy'), fmtNum(m.at)),
    );
  });
  const me = posFor(best);
  const ribbon = h('div.rd-ribbon', { style: { width: `calc(${W} * var(--k))` } },
    h('div.rd-bar', h('div.rd-fill', { style: { width: `calc(${Math.max(0, me + 60)} * var(--k))` } })),
    ...items,
    h('div.rd-me', { style: { left: `calc(${me} * var(--k))` } }, avatarEl(app, s.avatar)),
  );
  const scroller = h('div.hscroll.road-scroll', ribbon);
  const nextHero = TROPHY_ROAD.find((m) => m.reward.kind === 'hero' && best < m.at && !ownsHero(s, (m.reward as any).heroId));
  const note = nextHero
    ? h('div.road-note', icon('heroes', 'b'), `До героя «${getHero((nextHero.reward as any).heroId).name}» — ещё ${fmtNum(nextHero.at - best)} трофеев`)
    : h('div.road-note', icon('trophy', 'b'), `Рекорд: ${fmtNum(best)} трофеев`);
  const el = h('div.screen.road',
    screenHead(app, 'Дорога трофеев', { glyph: 'flag', bg: 'var(--mint)', cur: [], extra: [headChip('trophy', fmtNum(total))] }),
    scroller, note,
  );
  return {
    el,
    onShow() {
      enableDragScroll(scroller);
      // лента доезжает до текущей позиции
      const meEl = ribbon.querySelector('.rd-me') as HTMLElement;
      scroller.scrollTo({ left: Math.max(0, meEl.offsetLeft - scroller.clientWidth * 0.35), behavior: 'smooth' });
    },
  };
}

/** Награда Дороги: лучи мяты, ящик подпрыгивает, «Открыть». */
function roadMoment(app: App, at: number, box: 'common' | 'big' | 'mega', open: () => void) {
  sfx('levelup');
  const root = h('div.moment',
    h('div.moment-rays.mint'),
    h('div.rm',
      h('div.rm-tag.ds', icon('flag'), `Дорога трофеев · ${fmtNum(at)}`),
      h('div.rm-art', icon(BOX_ICON[box], 'b')),
      h('div.rm-title.ds.on-sea', `${ECONOMY.boxes[box].name} твой!`),
      btn('Открыть', () => { root.remove(); open(); }, 'lime lg'),
    ),
  );
  document.getElementById('ui')!.appendChild(root);
  void app;
}
