// Открытие ящика: ожидание (ящик дышит) → тряска от тапов (3 тапа) → взрыв → награды по одной → итог «Забрать».
// При «Меньше анимаций» ящик открывается одним тапом без тряски.
import { audio, sfx } from '../../audio/sfx';
import { Rng } from '../../core/rng';
import { ECONOMY, type BoxKind, type Reward } from '../../meta/economy';
import { BOX_ICON, openBox } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { refreshCurrencies, wallet } from '../common';
import { btn, burst, h, lessMotion } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { bigTile, closeLayer, rewardLayer, specialRewards, sumTile } from './rewards';

const TITLE_BG: Record<BoxKind, string> = { common: '#86cbff', big: '#d6a6ff', mega: '#ff9fd0' };

/** Показать открытие ящика поверх всего. given — уже выданные награды (если null — ящик откроется сейчас). gift — подарок с бантом. */
export function boxOverlay(app: App, kind: BoxKind, given: Reward[] | null, onDone: () => void, title?: string, gift = false) {
  const t = ECONOMY.boxes[kind];
  const before = wallet();
  let rewards: Reward[] = [];
  let i = 0;
  let taps = 0;
  const need = lessMotion() ? 1 : 3;
  let stage: 'wait' | 'burst' | 'item' | 'sum' = 'wait';
  const root = rewardLayer('box-open', () => tap());
  root.style.setProperty('--glow', t.color);
  const titleEl = h('div.rw-title.ds', { style: { background: TITLE_BG[kind] } }, title ?? t.name);
  const boxEl = h('div.box-obj' + (gift ? '.gift' : ''), icon(BOX_ICON[kind], 'b'), gift ? h('div.bow') : null);
  const hint = h('div.rw-hint', 'Тапни, чтобы открыть');
  root.append(titleEl, boxEl, hint);
  sfx('box_shake');

  const finish = () => {
    closeLayer(root);
    // валюта «прилетает» в фишки на экране под ящиком
    setTimeout(() => refreshCurrencies(before), 260);
    specialRewards(app, rewards, onDone);
  };
  const showItem = () => {
    if (i >= rewards.length) { summary(); return; }
    stage = 'item';
    const r = rewards[i++];
    root.querySelector('.big-tile:not(.sum)')?.remove();
    root.querySelector('.rw-counter')?.remove();
    const tile = bigTile(app, r);
    tile.classList.add('pop');
    root.append(tile, h('div.rw-counter', `${i} из ${rewards.length}`));
    hint.textContent = i < rewards.length ? 'Тапни — дальше' : 'Тапни — все награды';
    sfx(r.kind === 'skin' || r.kind === 'hero' ? 'levelup' : r.kind === 'coins' ? 'coin' : 'reward');
  };
  const summary = () => {
    stage = 'sum';
    root.querySelector('.big-tile:not(.sum)')?.remove();
    root.querySelector('.rw-counter')?.remove();
    hint.remove();
    titleEl.textContent = 'Твои награды';
    titleEl.style.background = 'var(--paper)';
    root.append(
      h('div.sum-row', ...rewards.map((r, k) => sumTile(app, r, k))),
      h('div.rw-btns', btn('Забрать', finish, 'lime lg')),
    );
    sfx('reward');
  };
  const tap = () => {
    if (stage === 'wait') {
      taps++;
      if (taps < need) {
        boxEl.classList.remove('shake'); void boxEl.offsetWidth; boxEl.classList.add('shake');
        root.style.setProperty('--glow-o', String(0.4 + taps * 0.25));
        sfx('box_shake', { pitch: 1 + taps * 0.15 });
        audio.vibrate(15);
        hint.textContent = `Ещё! ${taps} из ${need}`;
        return;
      }
      stage = 'burst';
      sfx('box_open');
      audio.vibrate(40);
      if (!given) { rewards = openBox(store.data, kind, new Rng(Date.now() & 0xffffff)); store.commit(); }
      else rewards = given;
      boxEl.classList.add('open');
      titleEl.style.visibility = 'hidden';
      root.appendChild(h('div.rw-flash'));
      burst(root, ['#fffaf0', t.color, '#ffd23a'], 24, ['coin', 'gem', 'bling']);
      setTimeout(() => { boxEl.remove(); root.querySelector('.rw-flash')?.remove(); titleEl.style.visibility = ''; titleEl.textContent = title ?? t.name; showItem(); }, lessMotion() ? 60 : 520);
    } else if (stage === 'item') showItem();
  };
  return () => root.remove();
}

/** Экран-обёртка (подарок после обучения): ящик прилетает с бантом. */
export function boxOpening(app: App, kind: BoxKind, onDone: () => void, title?: string, given: Reward[] | null = null, gift = false): Screen {
  const el = h('div.screen');
  return { el, onShow() { boxOverlay(app, kind, given, onDone, title, gift); } };
}
