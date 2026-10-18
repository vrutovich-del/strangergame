// Экран результата: победа/поражение, «Звёздный игрок», анимированные трофеи, монеты, очки пропуска, задания.
import { sfx } from '../../audio/sfx';
import { getHero } from '../../heroes/registry';
import { MODE_INFO } from '../../modes';
import { ECONOMY } from '../../meta/economy';
import { questText, totalTrophies, type BattleRewards } from '../../meta/progress';
import { store } from '../../meta/store';
import type { MatchResult } from '../../sim/types';
import type { BattleSource } from '../battle';
import type { App } from '../app';
import { btn, countUp, h } from '../dom';
import type { Screen } from './index';

export function resultsScreen(app: App, res: MatchResult, src: BattleSource, r: BattleRewards | null, next: () => void): Screen {
  const s = store.data;
  const w = src.world;
  const me = w.findById(src.localId);
  const star = w.findById(res.starPlayerId);
  const hostLeft = res.reason === 'host_left';
  let title = 'Бой окончен', cls = 'draw';
  if (hostLeft) { title = 'Хост вышел из игры'; cls = 'draw'; }
  else if (res.mode === 'showdown') { const pl = r?.place ?? 0; title = pl === 1 ? 'ПОБЕДА!' : `${pl}-е место`; cls = pl <= 3 ? 'win' : 'lose'; }
  else if (r?.won === true) { title = 'ПОБЕДА!'; cls = 'win'; }
  else if (r?.won === false) { title = 'ПОРАЖЕНИЕ'; cls = 'lose'; }
  else { title = 'НИЧЬЯ'; cls = 'draw'; }
  if (me) app.showHero(me.heroId, me.skinId, cls === 'win' ? 'win' : cls === 'lose' ? 'lose' : 'idle');
  app.showcase.offsetX = -0.9;
  sfx(cls === 'win' ? 'win' : cls === 'lose' ? 'lose' : 'announce');

  const row = (icon: string, label: string, value: number, plus = true) => {
    const v = h('span.rr-val.t', '0');
    setTimeout(() => { countUp(v, 0, value, 900, value > 0 && plus ? '+' : ''); if (value) sfx('coin'); }, 400);
    return h('div.rr', h('span.rr-ico', icon), h('span.rr-label', label), v);
  };
  const rows = h('div.res-rows');
  if (r) {
    rows.append(row('🏆', 'Трофеи', r.trophies));
    rows.append(row('🪙', 'Монеты', r.coins));
    rows.append(row('⭐', 'Очки пропуска', r.xp));
    if (r.bling) rows.append(row('✨', 'Первая победа дня!', r.bling));
    if (r.tierAfter > r.tierBefore) rows.append(h('div.rr.highlight.t', `🎟️ Новый уровень пропуска: ${r.tierAfter}!`));
    for (const i of r.questsDone) rows.append(h('div.rr.highlight', '📜 Задание выполнено: ' + questText(s.quests.list[i])));
  }
  if (hostLeft) rows.append(h('div.rr', 'Награды за победу не выдаются, но и трофеи не отняли.'));
  const trophyLine = h('div.res-total.t', `🏆 ${r ? r.trophiesBefore : totalTrophies(s)}`);
  if (r) setTimeout(() => countUp(trophyLine, r.trophiesBefore, totalTrophies(s), 1000, '🏆 '), 500);
  const starEl = star && !hostLeft ? h('div.res-star',
    h('div.rs-title.t', '⭐ Звёздный игрок'),
    h('img', { src: app.portrait(star.heroId, star.skinId, star.heroId.startsWith('robo_') ? (star.team === src.localTeam ? 'blue' : 'red') : 'blue') }),
    h('div.rs-name.t', star.name),
    h('div.rs-sub', star.heroId.startsWith('robo_') ? getHero(star.heroId).name : `Выбито: ${star.stats.kills} · Урон: ${Math.round(star.stats.damage)}`),
    star.id === me?.id ? h('div.rs-bonus.t', `+${ECONOMY.starPlayerCoins} 🪙`) : null,
  ) : null;
  const myStats = me ? h('div.res-mystats', `Урон: ${Math.round(me.stats.damage)} · Выбито: ${me.stats.kills}` + (res.mode === 'gemgrab' ? ` · Кристаллов собрано: ${me.stats.gems}` : '') + (res.mode === 'showdown' ? ` · Кубов: ${me.stats.cubes}` : '')) : null;
  const el = h('div.screen.results',
    h('div.res-left',
      h('div.res-mode.t', MODE_INFO[res.mode].icon + ' ' + MODE_INFO[res.mode].name),
      h('div.res-title.t.' + cls, title),
      myStats,
      rows, trophyLine,
      btn('ДАЛЬШЕ', next, 'btn-yellow', { class: 'btn-play' }),
    ),
    starEl,
  );
  return { el, showcase: true, dispose() { app.showcase.offsetX = 0; } };
}
