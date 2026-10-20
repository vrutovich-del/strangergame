// Аккаунты и облачное сохранение. Вход по логину и паролю, прогресс хранится в облаке (Firebase)
// и подтягивается на любом устройстве. Работает обычными HTTPS-запросами, без тяжёлых библиотек.
// Настройка (5 минут, бесплатно) — docs/АККАУНТЫ.md, ключи — CLOUD в src/config.ts.
// Никаких личных данных: только придуманный логин и пароль. Почта не нужна.
import { CLOUD } from '../config';

export interface Session {
  login: string;
  uid: string;
  idToken: string;
  refreshToken: string;
  /** Когда idToken перестанет работать (мс). */
  expiresAt: number;
  /** Какую версию облачного сохранения мы видели последней (savedAt). */
  syncedAt: number;
}

export interface CloudSave { savedAt: number; data: string; login: string }

export type CloudStatus = 'off' | 'idle' | 'saving' | 'saved' | 'error';

export const ACCOUNT_KEY = 'igra-strannostey-account';

export const cloudEnabled = (cfg = CLOUD) => !!(cfg.apiKey && cfg.databaseURL);

// ───────────── логин и пароль ─────────────
export function normalizeLogin(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

/** Ошибка в логине (или null, если всё хорошо). Логин — 3–14 букв, цифр, «_», «-», «.» (можно по-русски). */
export function checkLogin(s: string): string | null {
  const l = normalizeLogin(s);
  if (l.length < 3) return 'Логин — хотя бы 3 буквы или цифры.';
  if (l.length > 14) return 'Логин — не длиннее 14 символов.';
  if (!/^[\p{L}\p{N}_.-]+$/u.test(l)) return 'В логине можно только буквы, цифры и знаки _ - .';
  return null;
}

export function checkPassword(p: string): string | null {
  if (p.length < 6) return 'Пароль — хотя бы 6 символов.';
  if (p.length > 64) return 'Пароль слишком длинный.';
  return null;
}

/** Логин → адрес для Firebase. Почта не настоящая: любые буквы (и русские) кодируются латиницей. */
export function loginToEmail(login: string, domain = CLOUD.emailDomain) {
  const bytes = new TextEncoder().encode(normalizeLogin(login));
  let hex = '';
  bytes.forEach((b) => (hex += b.toString(16).padStart(2, '0')));
  return `u${hex}@${domain}`;
}

/** Понятный текст вместо кода ошибки Firebase. */
export function errorText(code: string): string {
  const c = code.split(' ')[0].split(':')[0].trim();
  switch (c) {
    case 'EMAIL_EXISTS': return 'Такой логин уже занят. Придумай другой.';
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS': return 'Неверный логин или пароль.';
    case 'WEAK_PASSWORD': return 'Пароль слишком простой: нужно хотя бы 6 символов.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER': return 'Слишком много попыток. Подожди пару минут.';
    case 'USER_DISABLED': return 'Этот аккаунт выключен.';
    case 'NETWORK': return 'Нет связи с сервером. Проверь интернет.';
    case 'NOT_CONFIGURED': return 'Аккаунты ещё не подключены (см. docs/АККАУНТЫ.md).';
    case 'TOKEN_EXPIRED':
    case 'INVALID_REFRESH_TOKEN':
    case 'USER_NOT_FOUND': return 'Нужно войти в аккаунт заново.';
    default: return 'Что-то пошло не так. Попробуй ещё раз.';
  }
}

export class CloudError extends Error {
  constructor(public code: string) { super(errorText(code)); }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function safeStorage(): KV | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** Аккаунт и синхронизация сохранения с облаком. */
export class Cloud {
  session: Session | null = null;
  status: CloudStatus = 'off';
  lastSaved = 0;
  /** Сохранение готово к отправке только после первой сверки с облаком (иначе можно затереть прогресс с другого устройства). */
  private ready = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private getSave: (() => { savedAt: number }) | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private cfg = CLOUD,
    private fetchFn: Fetch = (u, i) => fetch(u, i),
    private storage: KV | null = safeStorage(),
  ) {
    try {
      const raw = this.storage?.getItem(ACCOUNT_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch { this.session = null; }
    if (this.session) this.status = 'idle';
  }

  get enabled() { return cloudEnabled(this.cfg); }
  get loggedIn() { return !!this.session; }

  onChange(f: () => void) { this.listeners.add(f); return () => this.listeners.delete(f); }
  private changed() { this.listeners.forEach((f) => f()); }
  private saveSession() {
    try {
      if (this.session) this.storage?.setItem(ACCOUNT_KEY, JSON.stringify(this.session));
      else this.storage?.removeItem(ACCOUNT_KEY);
    } catch { /* память недоступна */ }
  }

  private async call(url: string, init: RequestInit): Promise<any> {
    let r: Response;
    try { r = await this.fetchFn(url, init); } catch { throw new CloudError('NETWORK'); }
    let body: any = null;
    try { body = await r.json(); } catch { body = null; }
    if (!r.ok) throw new CloudError(body?.error?.message ?? (typeof body?.error === 'string' ? body.error.toUpperCase().replace(/ /g, '_') : 'HTTP_' + r.status));
    return body;
  }

  private async auth(kind: 'signUp' | 'signInWithPassword', login: string, password: string): Promise<Session> {
    if (!this.enabled) throw new CloudError('NOT_CONFIGURED');
    const b = await this.call(`https://identitytoolkit.googleapis.com/v1/accounts:${kind}?key=${encodeURIComponent(this.cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginToEmail(login, this.cfg.emailDomain), password, returnSecureToken: true }),
    });
    return {
      login: normalizeLogin(login), uid: b.localId, idToken: b.idToken, refreshToken: b.refreshToken,
      expiresAt: Date.now() + (Number(b.expiresIn) || 3600) * 1000 - 60000, syncedAt: 0,
    };
  }

  /** Новый аккаунт: текущий прогресс с этого устройства сразу уходит в облако. */
  async register(login: string, password: string) {
    const bad = checkLogin(login) ?? checkPassword(password);
    if (bad) throw new Error(bad);
    this.session = await this.auth('signUp', login, password);
    this.saveSession();
    this.ready = true;
    this.status = 'idle';
    this.changed();
    await this.push();
    return this.session;
  }

  /** Вход. Возвращает облачное сохранение (или null, если в облаке пусто). Применить его решает игра. */
  async signIn(login: string, password: string): Promise<CloudSave | null> {
    const bad = checkLogin(login) ?? (password ? null : 'Введи пароль.');
    if (bad) throw new Error(bad);
    this.session = await this.auth('signInWithPassword', login, password);
    this.saveSession();
    this.status = 'idle';
    this.changed();
    const save = await this.pull();
    if (save) { this.session.syncedAt = save.savedAt; this.saveSession(); }
    return save;
  }

  /** После входа игра выбрала, какой прогресс оставить, — теперь можно сохранять. */
  confirmReady() {
    this.ready = true;
    this.schedulePush(0);
  }

  signOut() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.session = null;
    this.ready = false;
    this.status = 'off';
    this.saveSession();
    this.changed();
  }

  /** Свежий токен (раз в час Firebase просит обновить). */
  private async token(): Promise<string> {
    const s = this.session;
    if (!s) throw new CloudError('TOKEN_EXPIRED');
    if (Date.now() < s.expiresAt) return s.idToken;
    const b = await this.call(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
    });
    s.idToken = b.id_token; s.refreshToken = b.refresh_token ?? s.refreshToken;
    s.expiresAt = Date.now() + (Number(b.expires_in) || 3600) * 1000 - 60000;
    this.saveSession();
    return s.idToken;
  }

  private url(uid: string, token: string) {
    return `${this.cfg.databaseURL.replace(/\/+$/, '')}/saves/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
  }

  async pull(): Promise<CloudSave | null> {
    const uid = this.session?.uid ?? '';
    const b = await this.call(this.url(uid, await this.token()), { method: 'GET' });
    if (!b || typeof b.data !== 'string') return null;
    return { savedAt: Number(b.savedAt) || 0, data: b.data, login: String(b.login ?? '') };
  }

  /** Отправить текущее сохранение в облако. */
  async push() {
    if (!this.session || !this.getSave || !this.enabled) return;
    const save = this.getSave();
    const uid = this.session.uid;
    const body: CloudSave = { savedAt: save.savedAt, data: JSON.stringify(save), login: this.session.login };
    this.status = 'saving'; this.changed();
    try {
      await this.call(this.url(uid, await this.token()), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
      if (this.session?.uid === uid) { this.session.syncedAt = save.savedAt; this.saveSession(); }
      this.status = 'saved';
      this.lastSaved = Date.now();
    } catch (e) {
      this.status = 'error';
      if (e instanceof CloudError && (e.code === 'INVALID_REFRESH_TOKEN' || e.code === 'TOKEN_EXPIRED' || e.code === 'USER_NOT_FOUND')) this.signOut();
    }
    this.changed();
  }

  /** Сохранить чуть позже (несколько изменений подряд — одна отправка). */
  schedulePush(delay = 2500) {
    if (!this.session || !this.ready || !this.enabled) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.push(); }, delay);
  }

  /** Отправить прямо сейчас (игру закрывают). */
  flush() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    void this.push();
  }

  /**
   * Подключить игру. При запуске сверяемся с облаком:
   * если там новее (играли на другом устройстве) — отдаём облачное сохранение в apply.
   * score — «сколько прогресса» (если менялись оба, оставляем то, где его больше).
   */
  async attach(getSave: () => { savedAt: number }, apply: (data: string) => void, score: (data: string) => number) {
    this.getSave = getSave;
    if (!this.session || !this.enabled) return;
    try {
      const remote = await this.pull();
      const local = getSave();
      const synced = this.session?.syncedAt ?? 0;
      if (remote && remote.savedAt > synced) {
        const localChanged = local.savedAt > synced;
        if (!localChanged || score(remote.data) >= score(JSON.stringify(local))) {
          apply(remote.data);
          if (this.session) { this.session.syncedAt = remote.savedAt; this.saveSession(); }
          this.ready = true;
          this.status = 'saved';
          this.changed();
          return;
        }
      }
      this.ready = true;
      if (!remote || local.savedAt > (this.session?.syncedAt ?? 0)) await this.push();
      else { this.status = 'saved'; this.changed(); }
    } catch (e) {
      // нет связи — играем локально, сохраним, когда связь вернётся
      this.ready = true;
      this.status = 'error';
      if (e instanceof CloudError && (e.code === 'INVALID_REFRESH_TOKEN' || e.code === 'TOKEN_EXPIRED' || e.code === 'USER_NOT_FOUND')) this.signOut();
      this.changed();
    }
  }
}

export const cloud = new Cloud();
