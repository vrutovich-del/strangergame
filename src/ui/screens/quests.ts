// Задания: 3 ежедневных + календарь наград за вход на 7 дней.
import { sfx } from '../../audio/sfx';
import { ECONOMY, QUESTS } from '../../meta/economy';
import { claimLogin, claimQuest, ensureDaily, loginAvailable, questText } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { rewardCard, topBar } from '../common';
import { btn, h } from '../dom';
import { boxOverlay } from './boxes';
import type { Screen } from './index';

export function questsScreen(app: App): Screen {
  const s = store.data;
  ensureDaily(s);
  const refresh = () => app.open('quests');
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const left = midnight.getTime() - now.getTime();
  const quests = s.quests.list.map((q, i) => {
    const t = QUESTS.find((x) => x.id === q.id)!;
    const done = q.progress >= q.target;
    return h('div.quest' + (q.claimed ? '.claimed' : done ? '.done' : ''),
      h('div.q-text.t', questText(q)),
      h('div.q-line',
        h('div.q-bar', h('div.q-fill', { style: { width: `${Math.min(100, (q.progress / q.target) * 100)}%` } }), h('span.q-num', `${q.progress.toLocaleString('ru-RU')} / ${q.target.toLocaleString('ru-RU')}`)),
        h('div.q-rew', rewardCard(t.reward), h('div.q-xp.t', `+${ECONOMY.questReward.xp} ⭐`)),
        q.claimed ? h('div.sold.t', 'Готово ✔') : done ? btn('Забрать', () => { if (claimQuest(s, i)) { store.commit(); sfx('reward'); refresh(); } }, 'btn-green', { class: 'btn-sm' }) : null,
      ),
    );
  });
  const avail = loginAvailable(s);
  const days = ECONOMY.login.map((r, i) => {
    const done = i < s.login.next;
    return h('div.login-day' + (done ? '.done' : '') + (avail && i === s.login.next ? '.today' : ''), h('div.ld-n', `День ${i + 1}`), rewardCard(r));
  });
  const el = h('div.screen.panel-screen.quests', topBar(app, { title: 'Задания', back: true }),
    h('div.quests-body',
      h('div.quests-col',
        h('div.q-head.t', `Новые задания через ${Math.floor(left / 3600000)} ч ${Math.floor((left % 3600000) / 60000)} мин`),
        h('div.quest-list', ...quests),
      ),
      h('div.login-col',
      h('div.q-head.t', 'Награды за вход'),
      h('div.login-days', ...days),
      h('div.row', avail ? btn('Забрать награду дня', () => {
        const r = ECONOMY.login[s.login.next % 7];
        const got = claimLogin(s);
        store.commit();
        if (got && r.kind === 'box') boxOverlay(app, r.box, got, refresh);
        else { sfx('reward'); refresh(); }
      }, 'btn-green', { class: 'btn-sm' }) : h('div.small', 'Сегодняшняя награда получена. Приходи завтра!')),
      ),
    ),
  );
  return { el };
}
