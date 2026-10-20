import { describe, expect, it } from 'vitest';
import { ACCOUNT_KEY, checkLogin, checkPassword, Cloud, cloudEnabled, errorText, loginToEmail } from '../src/net/cloud';

const CFG = { apiKey: 'test-key', databaseURL: 'https://demo-rtdb.example/', emailDomain: 'players.test' };

/** Поддельный Firebase в памяти: аккаунты и база. */
function fakeFirebase() {
  const users = new Map<string, { pass: string; uid: string }>();
  const db = new Map<string, string>();
  const calls: string[] = [];
  let n = 0;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = async (url: string, init: RequestInit = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url.split('?')[0]}`);
    if (url.includes('accounts:signUp')) {
      const b = JSON.parse(String(init.body));
      if (users.has(b.email)) return json(400, { error: { message: 'EMAIL_EXISTS' } });
      if (b.password.length < 6) return json(400, { error: { message: 'WEAK_PASSWORD : Password should be at least 6 characters' } });
      const uid = 'uid' + ++n;
      users.set(b.email, { pass: b.password, uid });
      return json(200, { localId: uid, idToken: 'tok-' + uid, refreshToken: 'ref-' + uid, expiresIn: '3600' });
    }
    if (url.includes('accounts:signInWithPassword')) {
      const b = JSON.parse(String(init.body));
      const u = users.get(b.email);
      if (!u || u.pass !== b.password) return json(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
      return json(200, { localId: u.uid, idToken: 'tok-' + u.uid, refreshToken: 'ref-' + u.uid, expiresIn: '3600' });
    }
    if (url.includes('securetoken')) return json(200, { id_token: 'tok-new', refresh_token: 'ref-new', expires_in: '3600' });
    const m = /\/saves\/([^.]+)\.json\?auth=([^&]+)/.exec(url);
    if (m) {
      const uid = decodeURIComponent(m[1]);
      if (!decodeURIComponent(m[2]).startsWith('tok-')) return json(401, { error: 'Permission denied' });
      if (init.method === 'PUT') { db.set(uid, String(init.body)); return json(200, JSON.parse(String(init.body))); }
      return json(200, db.has(uid) ? JSON.parse(db.get(uid)!) : null);
    }
    return json(404, {});
  };
  return { users, db, calls, fetchFn };
}
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('логин и пароль', () => {
  it('логин можно по-русски, он превращается в латинский адрес', () => {
    const e = loginToEmail('  Ёжик_77 ', 'players.test');
    expect(e).toMatch(/^u[0-9a-f]+@players\.test$/);
    expect(loginToEmail('ёжик_77', 'players.test')).toBe(e);
    expect(e.split('@')[0].length).toBeLessThanOrEqual(64);
    expect(loginToEmail('Петя', 'x')).not.toBe(loginToEmail('Вася', 'x'));
  });
  it('проверка логина и пароля', () => {
    expect(checkLogin('ab')).not.toBeNull();
    expect(checkLogin('Смайлик2026')).toBeNull();
    expect(checkLogin('очень-длинный-логин')).not.toBeNull();
    expect(checkLogin('a<b>c')).not.toBeNull();
    expect(checkPassword('12345')).not.toBeNull();
    expect(checkPassword('123456')).toBeNull();
  });
  it('понятные ошибки', () => {
    expect(errorText('EMAIL_EXISTS')).toContain('занят');
    expect(errorText('INVALID_LOGIN_CREDENTIALS')).toContain('Неверный');
    expect(errorText('WEAK_PASSWORD : Password should be at least 6 characters')).toContain('6');
  });
  it('без ключей аккаунты выключены', () => {
    expect(cloudEnabled({ apiKey: '', databaseURL: '', emailDomain: 'x' })).toBe(false);
    expect(cloudEnabled(CFG)).toBe(true);
  });
});

describe('облачное сохранение', () => {
  it('регистрация отправляет прогресс в облако, вход на другом устройстве его возвращает', async () => {
    const fb = fakeFirebase();
    const save = { savedAt: 1000, coins: 777 };
    const a = new Cloud(CFG, fb.fetchFn, memory());
    await a.attach(() => save, () => {}, () => 0);
    await a.register('Ёжик', 'secret1');
    expect(a.loggedIn).toBe(true);
    expect(JSON.parse(JSON.parse(fb.db.get('uid1')!).data).coins).toBe(777);
    // другое устройство
    const b = new Cloud(CFG, fb.fetchFn, memory());
    const remote = await b.signIn('ЁЖИК', 'secret1');
    expect(JSON.parse(remote!.data).coins).toBe(777);
    await expect(b.signIn('Ёжик', 'wrong-pass')).rejects.toThrow('Неверный');
  });
  it('занятый логин и слабый пароль не проходят', async () => {
    const fb = fakeFirebase();
    const a = new Cloud(CFG, fb.fetchFn, memory());
    await a.register('Смайл', 'secret1');
    const b = new Cloud(CFG, fb.fetchFn, memory());
    await expect(b.register('смайл', 'secret2')).rejects.toThrow('занят');
    await expect(b.register('Новый', '123')).rejects.toThrow();
  });
  it('вход сохраняется после перезапуска игры', async () => {
    const fb = fakeFirebase();
    const st = memory();
    const a = new Cloud(CFG, fb.fetchFn, st);
    await a.register('Пончик', 'secret1');
    expect(st.m.has(ACCOUNT_KEY)).toBe(true);
    const again = new Cloud(CFG, fb.fetchFn, st);
    expect(again.session?.login).toBe('пончик');
    again.signOut();
    expect(st.m.has(ACCOUNT_KEY)).toBe(false);
  });
  it('при запуске: в облаке новее (играли на другом устройстве) — берём облако', async () => {
    const fb = fakeFirebase();
    const phone = { savedAt: 100, coins: 1 };
    const a = new Cloud(CFG, fb.fetchFn, memory());
    await a.attach(() => phone, () => {}, () => 0);
    await a.register('Енот', 'secret1');
    // планшет: вошёл и наиграл
    const tabletSt = memory();
    const tablet = new Cloud(CFG, fb.fetchFn, tabletSt);
    let tabletSave = { savedAt: 200, coins: 500 };
    await tablet.signIn('Енот', 'secret1');
    await tablet.attach(() => tabletSave, () => {}, () => 0);
    tablet.confirmReady();
    await tablet.push();
    // телефон снова запускает игру: при запуске он сам что-то сохранил (savedAt новее), но игры там не было
    const phoneAgain = new Cloud(CFG, fb.fetchFn, (a as any).storage);
    let applied = '';
    const bootSave = { savedAt: 300, coins: 1 };
    await phoneAgain.attach(() => bootSave, (d) => (applied = d), (d) => JSON.parse(d).coins);
    expect(JSON.parse(applied).coins).toBe(500);
    void tabletSave;
  });
  it('без сверки с облаком ничего не отправляется', async () => {
    const fb = fakeFirebase();
    const st = memory();
    const a = new Cloud(CFG, fb.fetchFn, st);
    await a.register('Кактус', 'secret1');
    const again = new Cloud(CFG, fb.fetchFn, st);
    const before = fb.calls.length;
    again.schedulePush(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(fb.calls.length).toBe(before);
  });
});
