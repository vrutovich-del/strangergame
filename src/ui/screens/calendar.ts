// Награда за вход: календарь из 7 дней, сегодняшний день поднят, «Забрать» ставит штамп-галочку.
import { sfx } from '../../audio/sfx';
import { ECONOMY } from '../../meta/economy';
import { BOX_ICON, loginAvailable, rewardLabel } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { btn, fmtLeft, h } from '../dom';
import { icon } from '../icons';

const RAD = ['16px 12px 18px 14px', '12px 16px 14px 18px', '18px 14px 16px 12px', '14px 18px 12px 16px', '16px 13px 18px 12px', '13px 17px 12px 16px', '20px 16px 22px 14px'];

const untilMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m.getTime() - n.getTime(); };

/** Содержимое календаря. onClaim — нажали «Забрать» (после штампа). compact — для экрана заданий. */
export function dailyBox(_app: App, onClaim: () => void, compact = false): HTMLElement {
  const s = store.data;
  const avail = loginAvailable(s);
  const today = s.login.next % 7;
  const days = ECONOMY.login.map((r, i) => {
    const done = i < today || (!avail && i === today - 1);
    const isToday = avail && i === today;
    const last = i === 6;
    const l = rewardLabel(r);
    const amt = r.kind === 'box' ? (r.box === 'common' ? 'ящик' : r.box === 'big' ? 'большой' : 'мега') : l.text;
    return h('div.day' + (done ? '.done' : '') + (isToday ? '.today' : '') + (last ? '.last' : ''), { style: { borderRadius: RAD[i], animationDelay: `${i * 40}ms` } },
      h('div.day-l', `День ${i + 1}`),
      icon(r.kind === 'box' ? BOX_ICON[r.box] : l.icon, 'b', 'day-ic'),
      h('div.day-a.num', amt),
      done ? h('div.day-stamp', icon('check')) : null,
      isToday ? h('div.day-today', 'Сегодня') : null,
    );
  });
  const next = ECONOMY.login[(avail ? today + 1 : today) % 7];
  const nextL = rewardLabel(next);
  const nextText = next.kind === 'box' ? ECONOMY.boxes[next.box].name : `${nextL.text} ${next.kind === 'coins' ? 'монет' : next.kind === 'gems' ? 'кристаллов' : 'блингов'}`;
  const row = h('div.days.stagger', ...days);
  const claim = avail
    ? btn('Забрать', () => {
      // штамп падает на сегодняшний день, потом награда
      const d = row.children[today] as HTMLElement;
      d.classList.add('done', 'stamped');
      d.classList.remove('today');
      d.querySelector('.day-today')?.remove();
      d.appendChild(h('div.day-stamp', icon('check')));
      sfx('stamp');
      claim.classList.add('claimed');
      onClaim();
    }, 'lime' + (compact ? ' sm' : ''))
    : h('div.next-chip', icon('timer'), `Следующая — через ${fmtLeft(untilMidnight())}`);
  return h('div.daily' + (compact ? '.compact' : ''),
    compact ? null : h('div.daily-head', h('div.m-title', 'Награда за вход'), h('div.m-small', avail && today === 0 ? 'Заходи каждый день — награды растут' : `День ${Math.min(7, today + (avail ? 1 : 0))} из 7`)),
    row,
    h('div.daily-foot',
      h('div.field-note', icon('info'), avail ? (today === 6 ? 'Сегодня — главный подарок недели!' : 'На 7-й день — Большой ящик') : `Завтра — ${nextText}`),
      claim,
    ),
  );
}
