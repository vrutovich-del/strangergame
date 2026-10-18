// Профиль: ник, аватар, статистика. Никаких личных данных — только игровой ник на этом устройстве.
import { sfx } from '../../audio/sfx';
import { getHero, playableHeroes } from '../../heroes/registry';
import { MODE_INFO } from '../../modes';
import { AVATARS } from '../../meta/economy';
import { totalTrophies } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, h, toast } from '../dom';
import type { Screen } from './index';
import { cleanNick } from './firstRun';

export function profileScreen(app: App): Screen {
  const s = store.data;
  const input = h('input.nick-input', { value: s.nick, maxLength: 14, placeholder: 'Ник' }) as HTMLInputElement;
  const save = btn('Сохранить', () => {
    const n = cleanNick(input.value);
    if (!n) { toast('Придумай ник', 'bad'); return; }
    s.nick = n; store.commit(); sfx('buy'); toast('Ник сохранён!', 'good'); app.open('profile');
  }, 'btn-green', { class: 'btn-sm' });
  const avatars = h('div.avatar-grid',
    ...[...AVATARS, ...playableHeroes().map((d) => 'hero:' + d.id)].map((a) => h('div.avatar-pick' + (s.avatar === a ? '.on' : ''), {
      onclick: () => { s.avatar = a; store.commit(); sfx('tab'); app.open('profile'); },
    }, a.startsWith('hero:') ? h('img', { src: app.portrait(a.slice(5)) }) : a)),
  );
  const fav = Object.entries(s.heroes).sort((a, b) => b[1].played - a[1].played)[0];
  const modes = (['gemgrab', 'showdown', 'knockout'] as const).map((m) => h('div.stat', h('span.st-l', MODE_INFO[m].icon + ' ' + MODE_INFO[m].name), h('span.st-v.t', `${s.stats.wins[m] ?? 0} побед / ${s.stats.games[m] ?? 0} боёв`)));
  const el = h('div.screen.panel-screen.profile', topBar(app, { title: 'Профиль', back: true }),
    h('div.scroll.profile-body',
      h('div.prof-card',
        h('div.avatar.big', s.avatar.startsWith('hero:') ? h('img', { src: app.portrait(s.avatar.slice(5)) }) : s.avatar),
        h('div.col', h('div.row', input, save), h('div.small', 'Не пиши настоящее имя и фамилию — придумай прозвище!')),
      ),
      h('div.sec-title.t', 'Аватар'),
      avatars,
      h('div.sec-title.t', 'Статистика'),
      h('div.stats',
        h('div.stat', h('span.st-l', '🏆 Трофеи сейчас'), h('span.st-v.t', String(totalTrophies(s)))),
        h('div.stat', h('span.st-l', '🥇 Рекорд трофеев'), h('span.st-v.t', String(s.bestTrophies))),
        ...modes,
        h('div.stat', h('span.st-l', '🤖 Выбито роботов'), h('span.st-v.t', String(s.stats.kills))),
        h('div.stat', h('span.st-l', '❤️ Любимый герой'), h('span.st-v.t', fav && fav[1].played > 0 ? getHero(fav[0]).name : '—')),
      ),
    ),
  );
  return { el };
}
