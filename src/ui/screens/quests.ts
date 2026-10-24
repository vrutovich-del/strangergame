// Задания: 3 ежедневных с прогрессом и таймером до обновления; снизу — вход в календарь наград за вход.
import { sfx } from '../../audio/sfx';
import { ECONOMY, QUESTS } from '../../meta/economy';
import { claimQuest, ensureDaily, loginAvailable, questText, rewardLabel } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { headChip, refreshCurrencies, screenHead, wallet } from '../common';
import { btn, fmtLeft, fmtNum, h } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { showLoginPopup } from './lobby';

/** Значок и цвет задания по его виду. */
export const QUEST_LOOK: Record<string, [string, string]> = {
  win: ['trophy', 'var(--yolk)'], damage: ['damage', 'var(--tang)'], gems: ['shard', 'var(--violet)'], kills: ['ko', 'var(--sky)'],
  supers: ['super', 'var(--yolk)'], play_showdown: ['showdown', '#47d24a'], play_knockout: ['knockout', 'var(--tang)'], cubes: ['cube', 'var(--mint)'], top4: ['trophy', 'var(--gum)'],
};
const R = ['22px 16px 24px 18px', '16px 22px 18px 24px', '20px 18px 22px 16px'];
const ROT = ['-1deg', '.8deg', '-.6deg'];
const untilMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m.getTime() - n.getTime(); };

export function questsScreen(app: App): Screen {
  const s = store.data;
  ensureDaily(s);
  const refresh = () => app.setScreen('quests', questsScreen(app));
  const cards = s.quests.list.map((q, i) => {
    const t = QUESTS.find((x) => x.id === q.id)!;
    const done = q.progress >= q.target;
    const [glyph, bg] = QUEST_LOOK[q.id] ?? ['quests', 'var(--lime)'];
    const l = rewardLabel(t.reward);
    const act = q.claimed
      ? h('div.q-done', icon('check'), 'Забрано')
      : done
        ? btn('Забрать', () => {
          const before = wallet();
          if (!claimQuest(store.data, i)) return;
          store.commit();
          sfx('reward');
          refresh();
          refreshCurrencies(before);
        }, 'lime xs')
        : btn(['В бой', icon('chev')], () => app.toLobby(), 'paper xs');
    return h('div.quest' + (q.claimed ? '.claimed' : done ? '.full' : ''), { style: { borderRadius: R[i % 3], rotate: ROT[i % 3] } },
      h('div.q-top', h('div.q-ic', { style: { background: bg } }, icon(glyph)), h('div.q-text', questText(q))),
      h('div.q-prog', h('div.bar.q-bar', h('i', { style: { '--p': String(Math.min(1, q.progress / q.target)) } as any })), h('div.q-num.num', `${fmtNum(Math.min(q.progress, q.target))} / ${fmtNum(q.target)}`)),
      h('div.q-foot',
        h('div.q-rews', h('div.q-rew', icon(l.icon), fmtNum(Number(l.text))), h('div.q-rew', icon('passpt'), String(ECONOMY.questReward.xp))),
        act,
      ),
    );
  });
  const allDone = s.quests.list.length > 0 && s.quests.list.every((q) => q.claimed);
  const body = allDone
    ? h('div.empty-box.q-empty', icon('quests', 'b'), h('div.col', { style: 'align-items:flex-start;gap:8px' },
      h('div.m-title', 'Все задания выполнены!'), h('div.m-small', 'Новые появятся в полночь. А пока — бои за трофеи и Метеорчики.')))
    : h('div.quest-grid.stagger', ...cards);
  const avail = loginAvailable(s);
  const daily = h('button.q-daily', { onclick: () => { sfx('click'); showLoginPopup(app, refresh); } },
    icon('box1', 'b'), 'Награда за вход', h('span', avail ? 'можно забрать!' : `день ${Math.max(1, s.login.next)} из 7`), avail ? h('div.dot') : null);
  const el = h('div.screen.quests',
    screenHead(app, 'Задания', { glyph: 'quests', bg: 'var(--lime)', cur: [], extra: [headChip('timer', `Новые через ${fmtLeft(untilMidnight())}`, true)] }),
    body,
    h('div.q-bottom', daily, h('div.q-note.on-sea', `Каждое задание даёт ещё ${ECONOMY.questReward.xp} очков пропуска.`)),
  );
  return { el };
}
