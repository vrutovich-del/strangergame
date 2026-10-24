// Аккаунт: вход и регистрация по логину и паролю (прогресс в облаке, на любом устройстве),
// выбор «Какой прогресс оставить?», статус облачного сохранения.
import { sfx } from '../../audio/sfx';
import { progressScore, totalTrophies } from '../../meta/progress';
import { migrate, type SaveData } from '../../meta/save';
import { store } from '../../meta/store';
import { checkLogin, checkPassword, cloud, CloudError, type CloudSave } from '../../net/cloud';
import type { App } from '../app';
import { fmtNum, h, holdButton, modal, toast, btn } from '../dom';
import { icon } from '../icons';
import { logoMark } from '../logo';
import type { Screen } from './index';
import { cleanNick } from './firstRun';

export type AccountMode = 'register' | 'login';

/** Взять облачное сохранение. */
export function applyCloudSave(data: string) {
  try { store.replace(migrate(JSON.parse(data))); } catch { toast('Сохранение в облаке повреждено', 'bad'); }
}

function parse(data: string): SaveData | null {
  try { return migrate(JSON.parse(data)); } catch { return null; }
}

const when = (t: number) => {
  if (!t) return 'давно';
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return days === 0 ? `сегодня в ${hm}` : days === 1 ? `вчера в ${hm}` : `${d.toLocaleDateString('ru-RU')} в ${hm}`;
};

/** После входа: если и на устройстве, и в облаке есть прогресс — спросить, какой оставить. */
function chooseProgress(app: App, remote: CloudSave | null, done: () => void) {
  const local = store.data;
  const r = remote ? parse(remote.data) : null;
  const finish = () => { cloud.confirmReady(); done(); };
  if (!r) { finish(); return; } // в облаке пусто — туда уйдёт прогресс с этого устройства
  if (progressScore(local) === 0 || progressScore(r) === progressScore(local)) { applyCloudSave(remote!.data); finish(); return; }
  const cloudBetter = progressScore(r) >= progressScore(local);
  const rows = (d: SaveData, hi: boolean) => [
    ['trophy', 'Трофеи', totalTrophies(d)], ['heroes', 'Герои', d.owned.length], ['ticket', 'Скины', d.skins.length], ['gem', 'Кристаллы', d.gems],
  ].map(([g, l, v]) => h('div.cf-row' + (hi ? '.hi' : ''), icon(g as string), h('span', l as string), h('b.num', fmtNum(v as number))));
  const keepCloud = () => { applyCloudSave(remote!.data); sfx('levelup'); finish(); };
  const keepDevice = () => {
    let close = () => {};
    close = modal(h('div.col', { style: 'align-items:stretch' },
      h('div.m-title', 'Оставить прогресс устройства?'),
      h('div.m-text', `Из облака пропадут ${fmtNum(totalTrophies(r))} трофеев, героев: ${r.owned.length}, скинов: ${r.skins.length}. Вернуть их будет нельзя.`),
      h('div.m-actions', btn('Оставить облако', () => { close(); keepCloud(); }, 'lime sm'), holdButton('Держи 2 секунды', 2000, () => { close(); sfx('stamp'); finish(); })),
    ), { cls: 'danger', top: true });
  };
  const card = (title: string, sub: string, glyph: string, bg: string, d: SaveData, best: boolean, label: string, act: () => void, cls: string) =>
    h('div.cf-card' + (best ? '.best' : ''),
      best ? h('div.cf-best', 'Больше прогресса') : null,
      h('div.cf-head', h('div.cf-ic', { style: { background: bg } }, icon(glyph)), h('div', h('div.ds', title), h('span', sub))),
      ...rows(d, best),
      btn(label, act, cls + ' sm'),
    );
  const el = h('div.screen.conflict',
    h('div.cf-title', h('div.s-title.ds', 'Какой прогресс оставить?'), h('div.on-sea.cf-sub', 'В облаке и на этом устройстве разные сохранения. Останется одно.')),
    h('div.cf-cards.stagger',
      card('В облаке', when(remote!.savedAt || r.savedAt), 'cloud', 'var(--sky)', r, cloudBetter, 'Оставить облако', keepCloud, cloudBetter ? 'lime' : 'paper'),
      card('На этом устройстве', when(local.savedAt), 'profile', 'var(--paper)', local, !cloudBetter, 'Оставить этот', keepDevice, !cloudBetter ? 'lime' : 'paper'),
    ),
  );
  app.setScreen('conflict', { el });
}

/**
 * Экран входа и регистрации. onDone(mode) — когда всё получилось, onBack — «Назад».
 */
export function accountScreen(app: App, mode: AccountMode, onDone: (mode: AccountMode) => void, onBack: () => void): Screen {
  const offline = !navigator.onLine;
  const field = (glyph: string, input: HTMLInputElement, eye = false) => {
    const f = h('div.field', icon(glyph), input);
    if (eye) {
      const e = h('button.eye', { 'aria-label': 'Показать пароль' }, icon('eye'));
      e.addEventListener('click', (ev) => { ev.preventDefault(); input.type = input.type === 'password' ? 'text' : 'password'; sfx('tab'); });
      f.appendChild(e);
    }
    return f;
  };
  const login = h('input', { maxLength: 14, placeholder: 'Логин', autocomplete: 'username', autocapitalize: 'off', spellcheck: false }) as HTMLInputElement;
  const pass = h('input', { type: 'password', maxLength: 64, placeholder: 'Пароль', autocomplete: mode === 'register' ? 'new-password' : 'current-password' }) as HTMLInputElement;
  const f1 = field('profile', login), f2 = field('lock', pass, true);
  const e1 = h('div.field-note.bad'), e2 = h('div.field-note.bad');
  const setErr = (which: 0 | 1 | 2, text: string) => {
    for (const [f, e, i] of [[f1, e1, 1], [f2, e2, 2]] as const) {
      const on = which === i;
      f.classList.toggle('err', on);
      e.replaceChildren(...(on ? [icon('close'), text] : []));
    }
    if (which) sfx('nope');
  };
  let busy = false;
  const go = async () => {
    if (busy || offline) return;
    setErr(0, '');
    const bl = checkLogin(login.value);
    if (bl) { setErr(1, bl); return; }
    const bp = mode === 'register' ? checkPassword(pass.value) : pass.value ? null : 'Введи пароль.';
    if (bp) { setErr(2, bp); return; }
    busy = true;
    submit.classList.add('loading');
    try {
      if (mode === 'register') {
        if (!store.data.nick) { store.data.nick = cleanNick(login.value) || 'Игрок'; store.commit(); }
        await cloud.register(login.value, pass.value);
        sfx('levelup');
        toast('Аккаунт создан! Прогресс сохраняется в облаке.', 'good', 'cloud');
        onDone(mode);
      } else {
        const remote = await cloud.signIn(login.value, pass.value);
        chooseProgress(app, remote, () => {
          sfx('levelup');
          toast('Ты вошёл как ' + cloud.session?.login, 'good', 'cloud');
          onDone(mode);
        });
      }
    } catch (e: any) {
      const code = e instanceof CloudError ? e.code : '';
      const text = e?.message || 'Не получилось. Попробуй ещё раз.';
      setErr(code.startsWith('EMAIL_EXISTS') ? 1 : 2, code.startsWith('EMAIL_EXISTS') ? 'Логин занят. Придумай другой — например, с цифрой.' : text);
    } finally {
      busy = false;
      submit.classList.remove('loading');
    }
  };
  for (const i of [login, pass]) i.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') void go(); });
  const submit = btn(mode === 'register' ? 'Создать' : 'Войти', () => void go(), 'lime acc-go' + (offline ? ' disabled' : ''), { why: 'Нет интернета — войти пока не получится' });
  const switchTo = (m: AccountMode) => { if (m !== mode) { sfx('tab'); app.setScreen('account', accountScreen(app, m, onDone, onBack)); } };
  const el = h('div.screen.account',
    btn(icon('back'), onBack, 'sky icon acc-back', { 'aria-label': 'Назад' }),
    offline ? h('div.acc-offline', icon('cloudoff', 'b'), 'Нет интернета. Войти пока не получится — можно играть без аккаунта.') : null,
    h('div.acc-side', h('div.acc-mark', { html: logoMark() }), h('div.on-sea', 'Аккаунт хранит героев, скины и валюту в облаке. Играй с любого устройства.')),
    h('div.acc-form' + (offline ? '.low' : ''),
      h('div.tabs',
        h('button.tab' + (mode === 'login' ? '.on' : ''), { onclick: () => switchTo('login') }, 'Вход'),
        h('button.tab' + (mode === 'register' ? '.on' : ''), { onclick: () => switchTo('register') }, 'Регистрация')),
      f1, e1, f2, e2,
      mode === 'register' ? h('div.m-small', 'Логин придумай сам — не пиши настоящее имя. Пароль никому не говори!') : null,
      h('div.m-actions', submit),
    ),
  );
  return { el, onShow: () => { if (!offline) setTimeout(() => login.focus(), 260); } };
}

/** Статус облачного сохранения — подсказка у фишки профиля. */
export function cloudStatusInfo() {
  const st = cloud.status;
  if (st === 'saving') return { glyph: 'refresh', ring: 'var(--sky)', title: 'Сохраняем…', text: 'Можно играть дальше, ничего не пропадёт.' };
  if (st === 'error') return { glyph: 'cloudoff', ring: 'var(--warn)', title: 'Нет связи с облаком', text: 'Прогресс сохранён на устройстве. Отправим в облако, когда появится интернет.' };
  const t = cloud.lastSaved ? `Сохранено в ${new Date(cloud.lastSaved).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}. ` : '';
  return { glyph: 'cloud', ring: 'var(--lime)', title: 'Сохранено в облаке', text: t + 'Прогресс есть на любом устройстве, где ты войдёшь.' };
}
