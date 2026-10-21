// Выбор режима. Для полигона — выбор любого героя и любого скина.
import { sfx } from '../../audio/sfx';
import { playableHeroes } from '../../heroes/registry';
import { skinsOf } from '../../heroes/skins';
import { mapsForMode, type ModeId } from '../../maps';
import { MODE_INFO } from '../../modes';
import { ownsHero } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, h } from '../dom';
import type { Screen } from './index';
import { enableDragScroll } from './shop';

export function modesScreen(app: App): Screen {
  const s = store.data;
  const cards = (Object.keys(MODE_INFO) as ModeId[]).map((m) => {
    const mi = MODE_INFO[m];
    return h('div.mode-big' + (s.selectedMode === m ? '.on' : ''), {
      style: { background: `linear-gradient(160deg, ${mi.color}, #2c1d63)` },
      onclick: () => { s.selectedMode = m; store.commit(); sfx('tab'); app.toLobby(); },
    },
      h('div.mb-icon', mi.icon),
      h('div.mb-name.t', mi.name),
      h('div.mb-short.t', mi.short),
      h('div.mb-desc', mi.desc),
      h('div.mb-maps', m === 'training' ? 'Без наград' : 'Карты: ' + mapsForMode(m).map((x) => x.name).join(', ')),
    );
  });
  const scroller = h('div.hscroll.mode-scroll', h('div.mode-row', ...cards));
  const el = h('div.screen.panel-screen.modes', topBar(app, { title: 'Выбери режим', back: true }), scroller,
    h('div.row.modes-foot', btn('🎯 Полигон: любой герой и скин', () => trainingPicker(app), 'btn-blue', { class: 'btn-sm' })));
  return { el, onShow: () => enableDragScroll(scroller) };
}

/** Полигон: можно взять любого героя на максимальном уровне и примерить любой скин. */
export function trainingPicker(app: App) {
  let hero = store.data.selectedHero;
  let skin = 'default';
  const wrap = h('div.screen.panel-screen.trainpick');
  const render = () => {
    wrap.innerHTML = '';
    const heroes = h('div.hscroll.pick-row', ...playableHeroes().map((d) => h('div.pick' + (d.id === hero ? '.on' : ''), { onclick: () => { hero = d.id; skin = 'default'; sfx('tab'); render(); } }, h('img', { src: app.portrait(d.id) }), h('div.t', d.name + (ownsHero(store.data, d.id) ? '' : ' 🔒')))));
    const skins = h('div.hscroll.pick-row', ...skinsOf(hero).map((k) => h('div.pick' + (k.id === skin ? '.on' : ''), { onclick: () => { skin = k.id; sfx('tab'); render(); } }, h('img', { src: app.portrait(hero, k.id) }), h('div.t', k.name))));
    wrap.append(
      topBar(app, { title: 'Примерочная', back: true }),
      h('div.pick-body',
        h('div.pick-line', h('div.pick-label.t', 'Герой', h('small', 'уровень 9, даже закрытые')), heroes),
        h('div.pick-line', h('div.pick-label.t', 'Скин', h('small', 'примерка бесплатно')), skins),
        h('div.row', btn('В БОЙ!', () => app.playTraining(hero, skin), 'btn-yellow', { class: 'btn-play small-play' })),
      ),
    );
    enableDragScroll(heroes);
    enableDragScroll(skins);
  };
  render();
  app.layer.innerHTML = '';
  app.layer.appendChild(wrap);
  app.showcaseOn = false;
}
