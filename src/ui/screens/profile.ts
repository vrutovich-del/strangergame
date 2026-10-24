// Профиль: аватар, ник (можно сменить), трофеи и рекорд, статистика по режимам, любимый герой.
// Никаких личных данных — только игровой ник.
import { sfx } from '../../audio/sfx';
import { getHero, playableHeroes } from '../../heroes/registry';
import { MODE_INFO } from '../../modes';
import { AVATARS } from '../../meta/economy';
import { ownsHero, totalTrophies } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { avatarEl, screenHead } from '../common';
import { btn, fmtNum, h, modal, toast } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { nickField } from './firstRun';

const MR = ['18px 14px 20px 16px', '14px 18px 16px 20px', '16px 20px 14px 18px', '20px 16px 18px 14px'];

export function profileScreen(app: App): Screen {
  const s = store.data;
  const refresh = () => app.setScreen('profile', profileScreen(app));
  const fav = Object.entries(s.heroes).sort((a, b) => b[1].played - a[1].played)[0];
  const w = (m: string) => s.stats.wins[m] ?? 0, g = (m: string) => s.stats.games[m] ?? 0;
  const modes = (['gemgrab', 'showdown', 'knockout', 'training'] as const).map((m, i) => {
    const mi = MODE_INFO[m];
    const a = m === 'training' ? `Выбито: ${fmtNum(s.stats.kills)}` : `Побед: ${fmtNum(w(m))}`;
    const b = m === 'training' ? `Урона: ${fmtNum(s.stats.damage)}` : `Боёв: ${fmtNum(g(m))}`;
    return h('div.ms-card', { style: { borderRadius: MR[i] } },
      h('div.ms-ic', { style: { background: mi.color } }, icon(mi.icon, 'b')),
      h('div.ms-t', h('div.ds', mi.name), h('div.ms-ab', h('span', a), h('span', b))));
  });
  const favBar = fav && fav[1].played > 0
    ? h('div.fav', avatarEl(app, 'hero:' + fav[0], 'fav-av'), h('div', 'Любимый герой — ', h('b', getHero(fav[0]).name), ` · ${fmtNum(fav[1].played)} боёв · ${fmtNum(fav[1].wins)} побед`))
    : h('div.fav', icon('heroes', 'b'), h('div', 'Любимый герой появится после первых боёв'));
  const big = avatarEl(app, s.avatar, 'big');
  big.addEventListener('click', () => { sfx('click'); pickAvatar(app, refresh); });
  const left = h('div.prof-card',
    big,
    h('div.prof-nick.ds', s.nick || 'Игрок'),
    h('div.row', btn('Сменить ник', () => changeNick(refresh), 'sky xs'), btn('Аватар', () => pickAvatar(app, refresh), 'paper xs')),
    h('div.prof-tiles',
      h('div.pt', h('span', 'Трофеи'), h('b.num', icon('trophy'), fmtNum(totalTrophies(s)))),
      h('div.pt', h('span', 'Рекорд'), h('b.num', icon('trophy'), fmtNum(s.bestTrophies)))),
  );
  const el = h('div.screen.profile',
    screenHead(app, 'Профиль', { glyph: 'profile', bg: 'var(--sky)', cur: [] }),
    left,
    h('div.prof-grid.stagger', ...modes, favBar),
  );
  return { el };
}

/** Смена ника: поле с кубиком случайного ника и подсказкой, что настоящее имя не нужно. */
function changeNick(done: () => void) {
  let close = () => {};
  const f = nickField(store.data.nick);
  close = modal(h('div.col', { style: 'align-items:stretch' },
    h('div.m-title', 'Новый ник'),
    f.el,
    h('div.m-actions',
      btn('Отмена', () => close(), 'paper sm'),
      btn('Сохранить', () => {
        const n = f.value();
        if (!n) return;
        store.data.nick = n; store.commit(); sfx('buy'); toast('Ник сохранён!', 'good', 'check'); close(); done();
      }, 'lime sm'),
    ),
  ), { cls: 'nick-modal' });
}

/** Выбор аватара: значки и портреты открытых героев. Закрытые герои — с замком. */
function pickAvatar(app: App, done: () => void) {
  const s = store.data;
  let close = () => {};
  let sel = s.avatar;
  const R = ['14px 10px 16px 12px', '10px 14px 12px 16px', '16px 12px 14px 10px'];
  const heroes = playableHeroes().map((d) => ({ id: 'hero:' + d.id, lock: !ownsHero(s, d.id) }));
  const all = [...heroes, ...AVATARS.map((a) => ({ id: a, lock: false }))];
  const grid = h('div.av-grid');
  const render = () => grid.replaceChildren(...all.map((a, i) => {
    const el = avatarEl(app, a.id, 'pick-av' + (a.id === sel ? ' on' : '') + (a.lock ? ' lock' : ''));
    el.style.borderRadius = R[i % 3];
    if (a.lock) el.appendChild(icon('lock', 'a', 'av-lock'));
    el.addEventListener('click', () => {
      if (a.lock) { sfx('tick'); toast('Аватар героя открывается вместе с героем', 'info', 'lock'); return; }
      sel = a.id; sfx('tab'); render();
    });
    return el;
  }));
  render();
  close = modal(h('div.col', { style: 'align-items:stretch' },
    h('div.m-title', 'Выбери аватар'),
    grid,
    h('div.daily-foot', h('div.m-small', 'Аватары героев открываются вместе с героем'), btn('Готово', () => { s.avatar = sel; store.commit(); close(); done(); }, 'lime sm')),
  ), { cls: 'wide av-modal' });
}
