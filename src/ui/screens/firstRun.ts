// Первый запуск: аккаунт (создать / войти / без аккаунта) → ник → обучение (можно пропустить) → подарок → лобби.
import { sfx } from '../../audio/sfx';
import { starterGift } from '../../meta/progress';
import { store } from '../../meta/store';
import { cloud } from '../../net/cloud';
import type { App } from '../app';
import { btn, h, toast } from '../dom';
import { accountForm, type AccountMode } from './account';
import { boxOverlay } from './boxes';
import type { Screen } from './index';

const NICK_A = ['Весёлый', 'Хитрый', 'Быстрый', 'Смелый', 'Космо', 'Супер', 'Мега', 'Тихий', 'Громкий', 'Странный'];
const NICK_B = ['Смайлик', 'Микроб', 'Бублик', 'Пиксель', 'Ёжик', 'Кактус', 'Робот', 'Пончик', 'Енот', 'Чих'];

export function cleanNick(s: string) {
  return s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
}
const randomNick = () => NICK_A[Math.floor(Math.random() * NICK_A.length)] + NICK_B[Math.floor(Math.random() * NICK_B.length)] + Math.floor(Math.random() * 90 + 10);

export function firstRun(app: App, done: () => void): Screen {
  // сохранение может замениться облачным после входа — поэтому всегда store.data, а не копия
  const el = h('div.screen.first');
  const logo = () => h('div.logo', 'Игра', h('br'), 'странностей');

  const stepWelcome = () => {
    el.innerHTML = '';
    el.append(
      logo(),
      h('div.first-box',
        h('div.first-title.t', 'Привет!'),
        h('p', 'Создай аккаунт — тогда прогресс не потеряется и будет на любом телефоне или компьютере.'),
        h('div.row',
          btn('СОЗДАТЬ АККАУНТ', () => stepAccount('register'), 'btn-yellow'),
          btn('ВОЙТИ', () => stepAccount('login'), 'btn-green'),
        ),
        btn('Играть без аккаунта', () => stepNick(), 'btn-gray', { class: 'btn-sm' }),
      ),
    );
  };

  const stepAccount = (mode: AccountMode) => {
    el.innerHTML = '';
    el.append(
      h('div.first-box',
        accountForm(mode, (m) => {
          const s = store.data;
          if (m === 'login' && s.nick && s.tutorialDone) { done(); return; }
          if (s.nick) stepTutorial(); else stepNick();
        }, stepAccount),
        btn('◀ Назад', () => stepWelcome(), 'btn-gray', { class: 'btn-sm' }),
      ),
    );
  };

  const stepNick = () => {
    const s = store.data;
    const input = h('input.nick-input.big', { value: s.nick || '', maxLength: 14, placeholder: 'Твой ник' }) as HTMLInputElement;
    el.innerHTML = '';
    el.append(
      logo(),
      h('div.first-box',
        h('div.first-title.t', 'Как тебя зовут в игре?'),
        h('div.row', input, btn('🎲', () => { input.value = randomNick(); sfx('tab'); }, 'btn-blue', { class: 'btn-sm' })),
        h('div.small', 'Придумай прозвище. Настоящее имя писать не нужно.'),
        btn('ДАЛЬШЕ', () => {
          const n = cleanNick(input.value);
          if (!n) { toast('Придумай ник или нажми 🎲', 'bad'); return; }
          store.data.nick = n; store.commit();
          stepTutorial();
        }, 'btn-yellow', { class: 'btn-play' }),
      ),
    );
    if (!input.value) input.value = randomNick();
  };

  const stepTutorial = () => {
    const s = store.data;
    el.innerHTML = '';
    el.append(
      h('div.first-box',
        h('div.first-title.t', `Привет, ${s.nick}!`),
        h('p', 'Пройди короткое обучение: двигайся, стреляй и используй супер. Это займёт минуту!'),
        h('div.row',
          btn('Пропустить', () => {
            const d = store.data;
            d.tutorialDone = true;
            const gift = d.giftBoxGiven ? null : starterGift(d);
            d.giftBoxGiven = true;
            store.commit();
            if (gift) boxOverlay(app, 'big', gift, done, 'Подарок новичку!'); else done();
          }, 'btn-gray'),
          btn('НАЧАТЬ ОБУЧЕНИЕ', () => app.playTraining('smile', 'default', true), 'btn-yellow'),
        ),
      ),
    );
  };

  const s = store.data;
  if (s.nick) stepTutorial();
  else if (cloud.enabled && !cloud.loggedIn) stepWelcome();
  else stepNick();
  return { el };
}
