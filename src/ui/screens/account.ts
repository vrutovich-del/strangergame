// Аккаунт: регистрация и вход по логину и паролю. Прогресс сохраняется в облаке и есть на любом устройстве.
import { sfx } from '../../audio/sfx';
import { progressScore, totalTrophies } from '../../meta/progress';
import { migrate, type SaveData } from '../../meta/save';
import { store } from '../../meta/store';
import { checkLogin, checkPassword, cloud, type CloudSave } from '../../net/cloud';
import type { App } from '../app';
import { btn, h, modal, toast } from '../dom';
import { cleanNick } from './firstRun';

export type AccountMode = 'register' | 'login';

/** Взять облачное сохранение. */
export function applyCloudSave(data: string) {
  try { store.replace(migrate(JSON.parse(data))); } catch { toast('Сохранение в облаке повреждено', 'bad'); }
}

function parse(data: string): SaveData | null {
  try { return migrate(JSON.parse(data)); } catch { return null; }
}

/** После входа: если и на устройстве, и в облаке есть прогресс — спросить, какой оставить. */
function chooseProgress(remote: CloudSave | null, done: () => void) {
  const local = store.data;
  const r = remote ? parse(remote.data) : null;
  const finish = () => { cloud.confirmReady(); done(); };
  if (!r) { finish(); return; } // в облаке пусто — туда уйдёт прогресс с этого устройства
  if (progressScore(local) === 0 || progressScore(r) === progressScore(local)) { applyCloudSave(remote!.data); finish(); return; }
  let close = () => {};
  const pick = (cloudOne: boolean) => { close(); if (cloudOne) applyCloudSave(remote!.data); finish(); };
  close = modal(h('div.col.center',
    h('h2', 'Какой прогресс оставить?'),
    h('p', 'И в аккаунте, и на этом устройстве есть свой прогресс.'),
    h('div.row',
      btn(['☁️ Аккаунта', h('br'), `🏆 ${totalTrophies(r)}`], () => pick(true), 'btn-green'),
      btn(['📱 С устройства', h('br'), `🏆 ${totalTrophies(local)}`], () => pick(false), 'btn-blue'),
    ),
    h('p.small', 'Второй прогресс заменится выбранным.'),
  ), { closable: false, cls: 'top' });
}

/**
 * Форма входа или регистрации. onDone(mode) — когда всё получилось.
 * Для первого запуска её вставляют в экран, для профиля — в окно.
 */
export function accountForm(mode: AccountMode, onDone: (mode: AccountMode) => void, onSwitch?: (mode: AccountMode) => void): HTMLElement {
  const login = h('input.nick-input', { maxLength: 14, placeholder: 'Логин', autocomplete: 'username', autocapitalize: 'off', spellcheck: false }) as HTMLInputElement;
  const pass = h('input.nick-input', { type: 'password', maxLength: 64, placeholder: 'Пароль', autocomplete: mode === 'register' ? 'new-password' : 'current-password' }) as HTMLInputElement;
  const pass2 = h('input.nick-input', { type: 'password', maxLength: 64, placeholder: 'Пароль ещё раз', autocomplete: 'new-password' }) as HTMLInputElement;
  const err = h('div.acc-error');
  let busy = false;
  const go = async () => {
    if (busy) return;
    err.textContent = '';
    const bad = checkLogin(login.value) ?? (mode === 'register' ? checkPassword(pass.value) ?? (pass.value !== pass2.value ? 'Пароли не совпадают.' : null) : pass.value ? null : 'Введи пароль.');
    if (bad) { err.textContent = bad; sfx('tick'); return; }
    busy = true;
    submit.classList.add('disabled');
    submit.textContent = mode === 'register' ? 'Создаём…' : 'Входим…';
    try {
      if (mode === 'register') {
        if (!store.data.nick) { store.data.nick = cleanNick(login.value) || 'Игрок'; store.commit(); }
        await cloud.register(login.value, pass.value);
        sfx('levelup');
        toast('Аккаунт создан! Прогресс сохраняется в облаке.', 'good');
        onDone(mode);
      } else {
        const remote = await cloud.signIn(login.value, pass.value);
        chooseProgress(remote, () => {
          sfx('levelup');
          toast('Ты вошёл как ' + cloud.session?.login, 'good');
          onDone(mode);
        });
      }
    } catch (e: any) {
      err.textContent = e?.message || 'Не получилось. Попробуй ещё раз.';
      sfx('tick');
    } finally {
      busy = false;
      submit.classList.remove('disabled');
      submit.textContent = mode === 'register' ? 'СОЗДАТЬ АККАУНТ' : 'ВОЙТИ';
    }
  };
  for (const i of [login, pass, pass2]) i.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') void go(); });
  const submit = btn(mode === 'register' ? 'СОЗДАТЬ АККАУНТ' : 'ВОЙТИ', () => void go(), 'btn-yellow');
  return h('div.acc-form',
    h('div.first-title.t', mode === 'register' ? 'Новый аккаунт' : 'Вход в аккаунт'),
    h('div.acc-fields', login, pass, mode === 'register' ? pass2 : null),
    err,
    submit,
    mode === 'register' ? h('div.small', 'Логин придумай сам — не пиши настоящее имя. Пароль никому не говори!') : null,
    onSwitch ? btn(mode === 'register' ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт', () => onSwitch(mode === 'register' ? 'login' : 'register'), 'btn-gray', { class: 'btn-sm' }) : null,
  );
}

/** Окно входа/регистрации (из профиля). */
export function accountModal(app: App, mode: AccountMode) {
  let close = () => {};
  const wrap = h('div');
  const show = (m: AccountMode) => {
    wrap.innerHTML = '';
    wrap.appendChild(accountForm(m, () => { close(); app.toLobby(); app.open('profile'); }, show));
  };
  show(mode);
  close = modal(wrap);
}

/** Блок «Аккаунт» для профиля. */
export function accountBox(app: App): HTMLElement {
  if (!cloud.enabled) return h('div.acc-box', h('div.small', '☁️ Аккаунты пока не подключены — прогресс хранится на этом устройстве.'));
  if (!cloud.session) {
    return h('div.acc-box',
      h('div', 'Войди в аккаунт — тогда прогресс не потеряется и будет на любом телефоне или компьютере.'),
      h('div.row',
        btn('Создать аккаунт', () => accountModal(app, 'register'), 'btn-green', { class: 'btn-sm' }),
        btn('Войти', () => accountModal(app, 'login'), 'btn-blue', { class: 'btn-sm' }),
      ),
    );
  }
  const text = () => {
    const st = cloud.status;
    return st === 'saving' ? '⏳ Сохраняем…' : st === 'error' ? '⚠️ Нет связи — сохраним, когда появится интернет'
      : cloud.lastSaved ? `✔ Сохранено в ${new Date(cloud.lastSaved).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '✔ Прогресс в облаке';
  };
  const statusEl = h('div.small', text());
  const off = cloud.onChange(() => { if (!statusEl.isConnected) { off(); return; } statusEl.textContent = text(); });
  return h('div.acc-box',
    h('div', '☁️ Ты вошёл как ', h('b.t', cloud.session.login)),
    statusEl,
    h('div.row', btn('Выйти из аккаунта', () => {
      cloud.flush();
      cloud.signOut();
      toast('Ты вышел из аккаунта. Прогресс на этом устройстве остался.', 'info');
      app.open('profile');
    }, 'btn-red', { class: 'btn-sm' })),
  );
}
