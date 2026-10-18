// Первый запуск: ник → обучение (можно пропустить) → подарочный ящик → лобби.
import { sfx } from '../../audio/sfx';
import { starterGift } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { btn, h, toast } from '../dom';
import { boxOverlay } from './boxes';
import type { Screen } from './index';

const NICK_A = ['Весёлый', 'Хитрый', 'Быстрый', 'Смелый', 'Космо', 'Супер', 'Мега', 'Тихий', 'Громкий', 'Странный'];
const NICK_B = ['Смайлик', 'Микроб', 'Бублик', 'Пиксель', 'Ёжик', 'Кактус', 'Робот', 'Пончик', 'Енот', 'Чих'];

export function cleanNick(s: string) {
  return s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
}
const randomNick = () => NICK_A[Math.floor(Math.random() * NICK_A.length)] + NICK_B[Math.floor(Math.random() * NICK_B.length)] + Math.floor(Math.random() * 90 + 10);

export function firstRun(app: App, done: () => void): Screen {
  const s = store.data;
  const el = h('div.screen.first');
  const stepNick = () => {
    const input = h('input.nick-input.big', { value: s.nick || '', maxLength: 14, placeholder: 'Твой ник' }) as HTMLInputElement;
    el.innerHTML = '';
    el.append(
      h('div.logo', 'Игра', h('br'), 'странностей'),
      h('div.first-box',
        h('div.first-title.t', 'Как тебя зовут в игре?'),
        h('div.row', input, btn('🎲', () => { input.value = randomNick(); sfx('tab'); }, 'btn-blue', { class: 'btn-sm' })),
        h('div.small', 'Придумай прозвище. Настоящее имя писать не нужно.'),
        btn('ДАЛЬШЕ', () => {
          const n = cleanNick(input.value);
          if (!n) { toast('Придумай ник или нажми 🎲', 'bad'); return; }
          s.nick = n; store.commit();
          stepTutorial();
        }, 'btn-yellow', { class: 'btn-play' }),
      ),
    );
    if (!input.value) input.value = randomNick();
  };
  const stepTutorial = () => {
    el.innerHTML = '';
    el.append(
      h('div.first-box',
        h('div.first-title.t', `Привет, ${s.nick}!`),
        h('p', 'Пройди короткое обучение: двигайся, стреляй и используй супер. Это займёт минуту!'),
        h('div.row',
          btn('Пропустить', () => {
            s.tutorialDone = true;
            s.giftBoxGiven = true;
            const gift = starterGift(s);
            store.commit();
            boxOverlay(app, 'big', gift, done, 'Подарок новичку!');
          }, 'btn-gray'),
          btn('НАЧАТЬ ОБУЧЕНИЕ', () => app.playTraining(s.selectedHero || 'smile', 'default', true), 'btn-yellow'),
        ),
      ),
    );
  };
  if (s.nick) stepTutorial(); else stepNick();
  return { el };
}
