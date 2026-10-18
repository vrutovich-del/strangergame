// Настройки: звук, музыка, вибрация, графика, подсказки, сложность роботов, перенос и сброс прогресса.
import { audio, sfx } from '../../audio/sfx';
import { CHANGELOG } from '../../changelog';
import { GAME_NAME, GAME_VERSION } from '../../config';
import { defaultSave, exportCode, importCode } from '../../meta/save';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, confirmBox, h, modal, toast } from '../dom';
import type { Screen } from './index';

function toggle(label: string, on: boolean, set: (v: boolean) => void) {
  const el = h('div.setting', h('span.set-l', label), btn(on ? 'Вкл' : 'Выкл', () => set(!on), on ? 'btn-green' : 'btn-gray', { class: 'btn-sm' }));
  return el;
}
function slider(label: string, value: number, set: (v: number) => void) {
  const input = h('input.slider', { type: 'range', min: 0, max: 100, value: Math.round(value * 100) }) as HTMLInputElement;
  input.addEventListener('input', () => set(Number(input.value) / 100));
  input.addEventListener('change', () => sfx('click'));
  return h('div.setting', h('span.set-l', label), input);
}
function choice<T extends string>(label: string, value: T, opts: [T, string][], set: (v: T) => void) {
  return h('div.setting', h('span.set-l', label), h('div.choice', ...opts.map(([v, t]) => btn(t, () => set(v), v === value ? 'btn-yellow' : 'btn-gray', { class: 'btn-sm' }))));
}

export function settingsScreen(app: App): Screen {
  const s = store.data;
  const st = s.settings;
  const re = () => app.open('settings');
  const el = h('div.screen.panel-screen.settings', topBar(app, { title: 'Настройки', back: true }),
    h('div.scroll.settings-body',
      slider('🔊 Звуки', st.sfx, (v) => { st.sfx = v; audio.sfxVolume = v; audio.applyVolumes(); store.commit(); }),
      slider('🎵 Музыка', st.music, (v) => { st.music = v; audio.musicVolume = v; audio.applyVolumes(); store.commit(); }),
      toggle('📳 Вибрация', st.vibration, (v) => { st.vibration = v; audio.vibration = v; store.commit(); if (v) audio.vibrate(40); re(); }),
      choice('🖼️ Графика', st.quality, [['auto', 'Авто'], ['low', 'Низкая'], ['high', 'Высокая']], (v) => { st.quality = v; app.r.setQuality(v); store.commit(); re(); }),
      toggle('💡 Подсказки управления', st.hints, (v) => { st.hints = v; store.commit(); re(); }),
      choice('🤖 Роботы', st.difficulty, [['auto', 'Авто'], ['easy', 'Лёгкие'], ['normal', 'Обычные'], ['hard', 'Сложные']], (v) => { st.difficulty = v; store.commit(); re(); }),
      h('div.sec-title.t', 'Перенос прогресса'),
      h('div.row',
        btn('📤 Получить код', () => showExport(), 'btn-blue', { class: 'btn-sm' }),
        btn('📥 Ввести код', () => showImport(app), 'btn-blue', { class: 'btn-sm' }),
      ),
      h('div.sec-title.t', 'Опасная зона'),
      h('div.row', btn('🗑️ Сбросить прогресс', () => {
        confirmBox('Сбросить прогресс?', 'Пропадут все трофеи, монеты, кристаллы и скины на этом устройстве.', 'Да, сбросить', () => {
          confirmBox('Точно-точно?', 'Это нельзя отменить! Может, сначала сохранишь код переноса?', 'Сбросить навсегда', () => {
            store.replace(defaultSave());
            location.reload();
          });
        });
      }, 'btn-red', { class: 'btn-sm' })),
      h('div.row', btn('📰 Что нового', () => whatsNew(), 'btn-purple', { class: 'btn-sm' })),
      h('div.version', `${GAME_NAME} · версия ${GAME_VERSION}`),
    ),
  );
  return { el };
}

function showExport() {
  const code = exportCode(store.data);
  const area = h('textarea.code-area', { readOnly: true }) as HTMLTextAreaElement;
  area.value = code;
  modal(h('div.col',
    h('h2', 'Код твоего прогресса'),
    h('p', 'Скопируй код и введи его на другом устройстве в «Настройки → Ввести код».'),
    area,
    btn('📋 Скопировать', async () => {
      try { await navigator.clipboard.writeText(code); toast('Скопировано!', 'good'); }
      catch { area.select(); document.execCommand?.('copy'); toast('Выдели и скопируй код', 'info'); }
    }, 'btn-green'),
  ));
}

function showImport(app: App) {
  const area = h('textarea.code-area', { placeholder: 'Вставь код сюда' }) as HTMLTextAreaElement;
  let close = () => {};
  close = modal(h('div.col',
    h('h2', 'Ввести код'),
    h('p', 'Прогресс на этом устройстве заменится прогрессом из кода.'),
    area,
    btn('Загрузить', () => {
      const d = importCode(area.value);
      if (!d) { toast('Код не подошёл. Проверь, всё ли скопировано.', 'bad'); return; }
      store.replace(d);
      close();
      toast('Прогресс загружен!', 'good');
      app.toLobby();
    }, 'btn-green'),
  ));
}

/** Экран «Что нового». */
export function whatsNew() {
  modal(h('div.whatsnew',
    h('h2', '📰 Что нового'),
    ...CHANGELOG.map((c) => h('div.wn-entry', h('div.wn-ver.t', `Версия ${c.version}`), h('ul', ...c.items.map((i) => h('li', i))))),
  ));
}
