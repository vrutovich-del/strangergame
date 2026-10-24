// Настройки по вкладкам: «Звук и экран», «Управление», «Аккаунт», «Об игре».
// Здесь же «Что нового», код переноса и сброс прогресса с двойным подтверждением.
import { audio, sfx } from '../../audio/sfx';
import { CHANGELOG } from '../../changelog';
import { GAME_NAME, GAME_VERSION } from '../../config';
import { defaultSave, exportCode, importCode } from '../../meta/save';
import { store } from '../../meta/store';
import { cloud } from '../../net/cloud';
import { applyMotionSetting, type App } from '../app';
import { screenHead } from '../common';
import { btn, closeBtn, h, holdButton, modal, toast } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { accountScreen, cloudStatusInfo } from './account';
import { enableDragScroll } from './shop';

type Tab = 'sound' | 'controls' | 'account' | 'about';
const TABS: [Tab, string, string][] = [['sound', 'Звук и экран', 'sound'], ['controls', 'Управление', 'hints'], ['account', 'Аккаунт', 'profile'], ['about', 'Об игре', 'info']];
const TR = ['16px 12px 18px 14px', '12px 16px 14px 18px', '18px 14px 16px 12px', '14px 18px 12px 16px'];

function row(glyph: string, title: string, desc: string | null, control: HTMLElement | null) {
  return h('div.set-row', icon(glyph), h('div.set-t', h('b', title), desc ? h('span', desc) : null), control);
}
function toggle(on: boolean, set: (v: boolean) => void) {
  const t = h('button.toggle' + (on ? '.on' : ''), { 'aria-pressed': String(on) });
  t.addEventListener('click', () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); sfx('tab'); set(v); });
  return t;
}
function slider(value: number, set: (v: number) => void) {
  const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100) }) as HTMLInputElement;
  const wrap = h('div.slider', { style: { '--v': String(value) } as any }, h('div.track', h('div.fill'), h('div.knob')), input);
  const num = h('div.slider-n.num', String(Math.round(value * 100)));
  input.addEventListener('input', () => { const v = Number(input.value) / 100; wrap.style.setProperty('--v', String(v)); num.textContent = input.value; set(v); });
  input.addEventListener('change', () => sfx('click'));
  return h('div.slider-row', wrap, num);
}
function seg<T extends string>(value: T, opts: [T, string][], set: (v: T) => void) {
  const s = h('div.seg');
  for (const [v, t] of opts) {
    const b = h('button' + (v === value ? '.on' : ''), t);
    b.addEventListener('click', () => { s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); sfx('tab'); set(v); });
    s.appendChild(b);
  }
  return s;
}

/** Строки вкладки «Звук и экран» (они же — быстрые настройки в паузе боя). */
export function soundRows(app: { r: App['r'] }) {
  const st = store.data.settings;
  return [
    row('sound', 'Звук', null, slider(st.sfx, (v) => { st.sfx = v; audio.sfxVolume = v; audio.applyVolumes(); store.commit(); })),
    row('music', 'Музыка', null, slider(st.music, (v) => { st.music = v; audio.musicVolume = v; audio.applyVolumes(); store.commit(); })),
    row('vibro', 'Вибрация', null, toggle(st.vibration, (v) => { st.vibration = v; audio.vibration = v; store.commit(); if (v) audio.vibrate(40); })),
    row('graphics', 'Графика', 'Авто подбирает качество под устройство', seg(st.quality, [['auto', 'Авто'], ['low', 'Низкое'], ['high', 'Высокое']], (v) => { st.quality = v; app.r.setQuality(v); store.commit(); })),
    row('lessmotion', 'Меньше анимаций', 'Без тряски, лучей и полёта наград', toggle(!!st.lessMotion, (v) => { st.lessMotion = v; store.commit(); applyMotionSetting(); })),
  ];
}

export function settingsScreen(app: App, arg?: { tab?: Tab }): Screen {
  const s = store.data;
  const st = s.settings;
  let tab: Tab = arg?.tab ?? 'sound';
  const panel = h('div.set-panel');
  const tabs = h('div.set-tabs');
  const reopen = (t: Tab) => app.setScreen('settings', settingsScreen(app, { tab: t }));

  const accountRows = () => {
    const rows: HTMLElement[] = [];
    if (!cloud.enabled) rows.push(row('cloudoff', 'Аккаунты', 'Пока не подключены — прогресс хранится на этом устройстве', null));
    else if (cloud.session) {
      const info = cloudStatusInfo();
      const r = row(info.glyph, cloud.session.login, `${info.title} · прогресс в облаке`, btn('Выйти', () => {
        cloud.flush(); cloud.signOut();
        toast('Ты вышел из аккаунта. Прогресс на этом устройстве остался.', 'info', 'cloud');
        reopen('account');
      }, 'paper xs'));
      const off = cloud.onChange(() => { if (!r.isConnected) { off(); return; } const i = cloudStatusInfo(); (r.querySelector('.set-t span') as HTMLElement).textContent = `${i.title} · прогресс в облаке`; });
      rows.push(r);
    } else {
      rows.push(row('cloud', 'Аккаунт', 'Сохрани прогресс в облаке и играй с любого устройства', btn('Войти', () =>
        app.setScreen('account', accountScreen(app, 'login', () => reopen('account'), () => reopen('account'))), 'lime xs')));
    }
    rows.push(row('copy', 'Код переноса', 'Для устройства без аккаунта. Никому не показывай.', btn('Показать', showExport, 'sky xs')));
    rows.push(row('share', 'Ввести код переноса', 'Заберёт прогресс с другого устройства', btn('Ввести', () => showImport(app), 'sky xs')));
    rows.push(row('close', 'Сбросить прогресс', 'Спросим два раза', btn('Сбросить', resetFlow, 'paper xs danger-text')));
    return rows;
  };
  const render = () => {
    tabs.replaceChildren(...TABS.map(([id, t, g], i) => h('button.set-tab' + (id === tab ? '.on' : ''), {
      style: { borderRadius: TR[i] }, onclick: () => { if (tab !== id) { tab = id; sfx('tab'); render(); } },
    }, icon(g), t)));
    let rows: HTMLElement[] = [];
    if (tab === 'sound') rows = soundRows(app);
    else if (tab === 'controls') rows = [
      row('hints', 'Подсказки управления', 'Подсказки клавиш и кругов под пальцами в бою', toggle(st.hints, (v) => { st.hints = v; store.commit(); })),
      row('robot', 'Сложность роботов', 'Авто — под твои трофеи', seg(st.difficulty, [['auto', 'Авто'], ['easy', 'Лёгкие'], ['normal', 'Обычные'], ['hard', 'Сложные']], (v) => { st.difficulty = v; store.commit(); })),
    ];
    else if (tab === 'account') rows = accountRows();
    else rows = [
      row('info', GAME_NAME, `версия ${GAME_VERSION}`, null),
      row('bling', 'Что нового', CHANGELOG[0]?.title ?? '', btn('Открыть', () => whatsNew(app), 'lime xs')),
      row('heroes', 'Герои и модели', 'Придуманы и нарисованы автором игры', null),
      row('emote', 'Шрифты', 'Shantell Sans и Nunito — свободная лицензия OFL', null),
    ];
    panel.replaceChildren(...rows);
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
  };
  render();
  const el = h('div.screen.settings',
    screenHead(app, 'Настройки', { glyph: 'gear', cur: [] }),
    tabs, panel,
  );
  return { el };
}

function showExport() {
  const code = exportCode(store.data);
  const area = h('textarea.code-area', { readOnly: true }) as HTMLTextAreaElement;
  area.value = code;
  modal(h('div.col', { style: 'align-items:stretch' },
    h('div.m-title', 'Код твоего прогресса'),
    h('div.m-text', 'Скопируй код и введи его на другом устройстве: «Настройки → Аккаунт → Ввести код переноса».'),
    area,
    h('div.m-actions', btn([icon('copy'), 'Скопировать'], async () => {
      try { await navigator.clipboard.writeText(code); toast('Скопировано!', 'good', 'copy'); }
      catch { area.select(); document.execCommand?.('copy'); toast('Выдели и скопируй код', 'info'); }
    }, 'lime sm')),
  ));
}

function showImport(app: App) {
  const area = h('textarea.code-area', { placeholder: 'Вставь код сюда' }) as HTMLTextAreaElement;
  let close = () => {};
  close = modal(h('div.col', { style: 'align-items:stretch' },
    h('div.m-title', 'Ввести код'),
    h('div.m-text', 'Прогресс на этом устройстве заменится прогрессом из кода.'),
    area,
    h('div.m-actions', btn('Отмена', () => close(), 'paper sm'), btn('Загрузить', () => {
      const d = importCode(area.value);
      if (!d) { toast('Код не подошёл. Проверь, всё ли скопировано.', 'bad'); return; }
      store.replace(d);
      applyMotionSetting();
      close();
      toast('Прогресс загружен!', 'good', 'check');
      app.toLobby();
    }, 'lime sm')),
  ));
}

/** Сброс: шаг 1 — «Сбросить прогресс?», шаг 2 — «Точно-точно?» и кнопка «нажми и держи 2 секунды». */
function resetFlow() {
  const acc = cloud.session ? ` Ты выйдешь из аккаунта «${cloud.session.login}», но прогресс в нём останется.` : '';
  let close = () => {};
  const step2 = () => {
    close();
    let c2 = () => {};
    c2 = modal(h('div.col', { style: 'align-items:stretch' },
      h('div.step-n', 'Шаг 2 из 2'),
      h('div.m-title', 'Точно-точно?'),
      h('div.m-text', 'Нажми и держи 2 секунды. Отпустишь — ничего не случится.'),
      h('div.m-actions', btn('Оставить', () => c2(), 'lime sm'), holdButton('Сбросить навсегда', 2000, () => {
        cloud.signOut();
        store.replace(defaultSave());
        location.reload();
      })),
    ), { cls: 'danger' });
  };
  close = modal(h('div.col', { style: 'align-items:stretch' },
    h('div.step-n', 'Шаг 1 из 2'),
    h('div.m-title', 'Сбросить прогресс?'),
    h('div.m-text', 'Пропадут герои, скины, валюта и трофеи на этом устройстве. Вернуть нельзя.' + acc),
    h('div.m-actions', btn('Оставить', () => close(), 'lime sm'), btn('Сбросить', step2, 'paper sm danger-text')),
  ), { cls: 'danger' });
}

/** «Что нового»: карточки версий листаются вбок, новая — слева. */
export function whatsNew(app?: App) {
  let page = 0;
  const cards = CHANGELOG.map((c, i) => h('div.wn-card', { style: { borderRadius: ['22px 16px 24px 18px', '16px 22px 18px 24px', '20px 18px 22px 16px'][i % 3] } },
    h('div.wn-top', { style: { background: `var(--dots), ${c.color}` } },
      c.hero && app ? h('img.wn-hero', { src: app.portrait(c.hero), alt: '' }) : icon(c.glyph ?? 'heroes', 'b', 'wn-ic'),
      h('div.wn-ver', h('span', c.version), h('b', new Date(c.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))),
      h('div.wn-title.ds', c.title)),
    h('div.wn-items', ...c.items.map((t) => h('div.wn-item', icon('check'), h('span', t)))),
  ));
  const list = h('div.wn-list.hscroll', ...cards);
  const dots = h('div.wn-dots', ...CHANGELOG.map((_, i) => h('i' + (i === 0 ? '.on' : ''))));
  list.addEventListener('scroll', () => {
    const w = (list.firstElementChild as HTMLElement)?.offsetWidth ?? 1;
    const p = Math.round(list.scrollLeft / (w + 20));
    if (p !== page) { page = p; Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i === p)); }
  }, { passive: true });
  const root = h('div.whatsnew',
    h('div.s-title.ds.wn-head', icon('bling'), 'Что нового'),
    list, dots,
  );
  const close = () => { root.classList.add('hide'); setTimeout(() => root.remove(), 180); };
  root.append(closeBtn(close), btn('Понятно', close, 'lime wn-ok'));
  document.getElementById('ui')!.appendChild(root);
  enableDragScroll(list);
}
