// Выбор режима: 4 карточки с описанием, числом игроков и картами. Полигон — примерочная любого героя и скина.
import { sfx } from '../../audio/sfx';
import { getHero, playableHeroes } from '../../heroes/registry';
import { getSkin, skinsOf } from '../../heroes/skins';
import { mapsForMode, type ModeId } from '../../maps';
import { MODE_INFO } from '../../modes';
import { ownsHero } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { blobColor, rarityTag, screenHead } from '../common';
import { btn, h } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { enableDragScroll } from './shop';

const PLAYERS: Record<ModeId, string> = { gemgrab: '3 на 3', showdown: '10 игроков', knockout: '3 на 3', training: 'один' };
const RM = ['22px 16px 24px 18px', '16px 22px 18px 24px', '20px 18px 22px 16px', '18px 22px 16px 20px'];
const ROT = ['-1deg', '1deg', '-.8deg', '1.2deg'];

export function modesScreen(app: App): Screen {
  const s = store.data;
  const cards = (Object.keys(MODE_INFO) as ModeId[]).map((m, i) => {
    const mi = MODE_INFO[m];
    const sel = s.selectedMode === m;
    return h('div.mode-big' + (sel ? '.on' : ''), {
      style: { borderRadius: RM[i], rotate: ROT[i] },
      onclick: () => {
        sfx('tab');
        if (m === 'training') { trainingPicker(app); return; }
        s.selectedMode = m; store.commit(); app.toLobby();
      },
    },
      h('div.mb-top', { style: { background: `var(--dots), ${mi.color}`, borderRadius: RM[i].split(' ').slice(0, 2).join(' ') + ' 0 0' } },
        icon(mi.icon, 'b'),
        h('div.mb-players', PLAYERS[m]),
      ),
      h('div.mb-body',
        h('div.mb-name.ds', mi.name),
        h('div.mb-desc', mi.desc),
        h('div.mb-maps', icon('flag'), m === 'training' ? 'Трофеи не меняются' : mapsForMode(m).map((x) => x.name).join(', ')),
      ),
      sel ? h('div.sel-tag', icon('check'), 'Выбран') : null,
    );
  });
  const el = h('div.screen.modes',
    screenHead(app, 'Выбор режима', { cur: [] }),
    h('div.mode-grid.stagger', ...cards),
  );
  return { el };
}

/** Полигон: можно взять любого героя на максимальном уровне и примерить любой скин. */
export function trainingPicker(app: App) {
  let hero = store.data.selectedHero;
  let skin = 'default';
  const stage = h('div.stage.pick-stage');
  app.bindSpin(stage);
  const blob = h('div.blob.pick-blob');
  const side = h('div.pick-side');
  const render = () => {
    const d = getHero(hero);
    blob.style.setProperty('--blob', blobColor(d.color));
    app.showHero(hero, skin, 'idle', blobColor(d.color));
    side.replaceChildren(
      h('div.pick-title.ds', getSkin(hero, skin).name, rarityTag(d.rarity ?? 'common')),
      h('div.m-small', 'Уровень 9, даже закрытые герои. Примерка бесплатная.'),
      h('div.pick-label', 'Герой'),
      h('div.pick-row.hscroll', ...playableHeroes().map((x) => h('div.pick' + (x.id === hero ? '.on' : ''), {
        style: { '--pc': x.color } as any,
        onclick: () => { hero = x.id; skin = 'default'; sfx('tab'); render(); },
      }, h('img', { src: app.portrait(x.id), alt: '' }), h('div.pick-n', x.name), ownsHero(store.data, x.id) ? null : icon('lock', 'b', 'pick-lock')))),
      h('div.pick-label', 'Скин'),
      h('div.pick-row.hscroll', ...skinsOf(hero).map((k) => h('div.pick' + (k.id === skin ? '.on' : ''), {
        style: { '--pc': k.cardColor } as any,
        onclick: () => { skin = k.id; sfx('tab'); render(); },
      }, h('img', { src: app.portrait(hero, k.id), alt: '' }), h('div.pick-n', k.name)))),
      h('div.m-actions', btn([icon('training'), 'В бой!'], () => app.playTraining(hero, skin), 'yolk lg')),
    );
    side.querySelectorAll('.pick-row').forEach((r) => enableDragScroll(r as HTMLElement));
  };
  render();
  const el = h('div.screen.trainpick', screenHead(app, 'Полигон', { glyph: 'training', cur: [], back: () => app.open('modes') }), stage, side);
  app.setScreen('training', { el, stage, back: [blob, h('div.podium.pick-podium')] });
}
