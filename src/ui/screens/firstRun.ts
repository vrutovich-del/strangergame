// Первый запуск: приветствие («Я новый игрок» / «У меня есть аккаунт») → ник → обучение в бою (можно пропустить) → подарок → лобби.
import { sfx } from '../../audio/sfx';
import { store } from '../../meta/store';
import { cloud } from '../../net/cloud';
import type { App } from '../app';
import { blobColor } from '../common';
import { btn, h, nudge } from '../dom';
import { icon } from '../icons';
import { logoFull, logoMark } from '../logo';
import { accountScreen } from './account';
import type { Screen } from './index';

const NICK_A = ['Весёлый', 'Хитрый', 'Быстрый', 'Смелый', 'Космо', 'Супер', 'Мега', 'Тихий', 'Громкий', 'Странный', 'Пончик', 'Капитан'];
const NICK_B = ['Смайлик', 'Микроб', 'Бублик', 'Пиксель', 'Ёжик', 'Кактус', 'Робот', 'Пончик', 'Енот', 'Чих', 'Зефир', 'Шпрот'];
export const NICK_MAX = 14;

export function cleanNick(s: string) {
  return s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
}
export const randomNick = () => {
  const a = NICK_A[Math.floor(Math.random() * NICK_A.length)], b = NICK_B[Math.floor(Math.random() * NICK_B.length)];
  const n = a + '-' + b;
  return n.length <= NICK_MAX ? n : (a + b).slice(0, NICK_MAX);
};

/** Поле ника с кубиком случайного ника и подсказкой. onChange — после каждого изменения. */
export function nickField(initial: string, onChange?: (ok: boolean) => void) {
  const input = h('input', { value: initial, maxLength: NICK_MAX + 4, placeholder: 'Например, Пончик-Енот', autocomplete: 'off', spellcheck: false }) as HTMLInputElement;
  const field = h('div.field.nick-f', input);
  const note = h('div.field-note');
  const check = () => {
    const raw = input.value.trim();
    const long = raw.length > NICK_MAX;
    field.classList.toggle('err', long);
    note.classList.toggle('bad', long);
    note.replaceChildren(icon(long ? 'close' : 'info'), long ? `Длинновато: до ${NICK_MAX} букв. Кубик подскажет готовый ник.` : 'Настоящее имя не нужно — придумай смешное.');
    onChange?.(!!cleanNick(raw) && !long);
  };
  input.addEventListener('input', check);
  const dice = btn(icon('dice'), () => {
    input.value = randomNick();
    dice.classList.remove('spin'); void dice.offsetWidth; dice.classList.add('spin');
    sfx('tab');
    check();
  }, 'gum icon dice-btn', { 'aria-label': 'Случайный ник' });
  check();
  return {
    el: h('div.nick-wrap', h('div.nick-row', field, dice), note),
    input,
    value: () => { const raw = input.value.trim(); return raw.length > NICK_MAX ? '' : cleanNick(raw); },
  };
}

export function firstRun(app: App, done: () => void): Screen {
  // сохранение может замениться облачным после входа — поэтому всегда store.data, а не копия
  const startTutorial = () => app.playTraining('smile', 'default', true);
  const afterLogin = () => {
    const s = store.data;
    if (s.nick && s.tutorialDone) { done(); return; }
    if (s.nick) startTutorial(); else app.setScreen('first', nickStep(app, startTutorial));
  };

  const welcome = (): Screen => {
    app.showHero('smile', 'default', 'idle', blobColor('#ffd23a'));
    const stage = h('div.stage.wl-stage');
    app.bindSpin(stage);
    const el = h('div.screen.welcome',
      stage,
      h('div.wl-side',
        h('div.wl-logo', { html: logoFull() }),
        btn('Я новый игрок', () => app.setScreen('first', nickStep(app, startTutorial)), 'yolk xl wl-new'),
        cloud.enabled ? btn([icon('profile'), 'У меня есть аккаунт'], () =>
          app.setScreen('account', accountScreen(app, 'login', () => afterLogin(), () => app.setScreen('first', welcome()))), 'paper wl-acc') : null,
        h('div.wl-note.on-sea', 'Без аккаунта прогресс живёт на этом устройстве. Войти можно позже в настройках.'),
      ),
    );
    return { el, stage, back: [h('div.blob.wl-blob', { style: { '--blob': blobColor('#ffd23a') } as any }), h('div.podium.wl-podium')] };
  };

  const s = store.data;
  if (s.nick) return { el: h('div.screen'), onShow: () => startTutorial() };
  if (cloud.enabled && !cloud.loggedIn) return welcome();
  return nickStep(app, startTutorial);
}

/** Ввод ника: шаг 1 из 3 (дальше — обучение и подарок). */
function nickStep(app: App, next: () => void): Screen {
  let ok = false;
  const go = btn('Готово', () => {
    const n = f.value();
    if (!n) { nudge(f.el); return; }
    store.data.nick = n;
    store.commit();
    sfx('levelup');
    next();
  }, 'lime lg nick-go', { why: 'Придумай ник или нажми на кубик' });
  const f = nickField(store.data.nick || '', (v) => { ok = v; go.classList.toggle('disabled', !ok); });
  const el = h('div.screen.nick-step',
    h('div.nick-card',
      h('div.nick-mark', { html: logoMark() }),
      h('div.steps', h('i.on'), h('i'), h('i'), h('span', 'шаг 1 из 3')),
      h('div.m-title', 'Как тебя будут звать?'),
      f.el,
      h('div.m-actions', go),
    ),
  );
  void app;
  return { el, onShow: () => setTimeout(() => f.input.focus(), 280) };
}
