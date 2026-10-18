// Дорога трофеев: горизонтальная лента наград за общее число трофеев.
import { sfx } from '../../audio/sfx';
import { TROPHY_ROAD } from '../../meta/economy';
import { claimRoad, totalTrophies } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { rewardCard, topBar } from '../common';
import { btn, h } from '../dom';
import { boxOverlay } from './boxes';
import type { Screen } from './index';
import { enableDragScroll } from './shop';

export function roadScreen(app: App): Screen {
  const s = store.data;
  const total = totalTrophies(s);
  const best = s.bestTrophies;
  const refresh = () => app.open('road');
  const maxAt = TROPHY_ROAD[TROPHY_ROAD.length - 1].at;
  const items = TROPHY_ROAD.map((m) => {
    const reached = best >= m.at;
    const claimed = s.road.claimed.includes(m.at);
    const future = m.reward.kind === 'future';
    return h('div.road-item' + (reached ? '.reached' : '') + (claimed ? '.claimed' : '') + (future ? '.future' : ''),
      h('div.ri-at.t', '🏆 ' + m.at),
      future ? h('div.reward-card.future', h('div.rc-icon', '🦸'), h('div.rc-text.t', 'Новый герой'), h('div.soon-tag', 'Скоро!')) : rewardCard(m.reward as any),
      future ? null : claimed ? h('div.sold.t', 'Получено ✔') : reached ? btn('Забрать', () => {
        const rw = m.reward;
        const got = claimRoad(s, m.at);
        store.commit();
        if (!got) return;
        if (rw.kind === 'box') boxOverlay(app, rw.box, got, refresh);
        else { sfx('reward'); refresh(); }
      }, 'btn-green', { class: 'btn-sm' }) : h('div.locked-tag', '🔒'),
    );
  });
  const pct = Math.min(100, (best / maxAt) * 100);
  const ribbon = h('div.road-ribbon', h('div.road-line', h('div.road-fill', { style: { width: pct + '%' } })), h('div.road-items', ...items));
  const scroller = h('div.hscroll', ribbon);
  const el = h('div.screen.panel-screen.road', topBar(app, { title: 'Дорога трофеев', back: true }),
    h('div.road-head.t', `Сейчас: 🏆 ${total}   Рекорд: 🏆 ${best}`), scroller);
  return {
    el,
    onShow() {
      enableDragScroll(scroller);
      const next = el.querySelector('.road-item:not(.claimed)') as HTMLElement | null;
      if (next) scroller.scrollLeft = Math.max(0, next.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft - 60);
    },
  };
}
