// Метеорчик: награда за победу. Редкость решена заранее — тапы только показывают её по ступеням:
// с каждой ступенью метеорчик растёт, кольцо и лучи меняют цвет, звук выше на тон. Потом он раскалывается.
import { audio, sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero } from '../../heroes/registry';
import type { DropRarity, Reward } from '../../meta/economy';
import { DROP_STEPS, openNextDrop } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { refreshCurrencies, wallet } from '../common';
import { btn, burst, h, lessMotion } from '../dom';
import { icon } from '../icons';
import { boxOverlay } from './boxes';
import { dropOddsBox } from './modals';
import { bigTile, closeLayer, rewardLayer, specialRewards, sumTile } from './rewards';

const SIZE = [150, 160, 172, 184, 196];
const mix = (c: string, k: number, w = '#0f7f86') => `color-mix(in oklab, ${c} ${k}%, ${w})`;

/** Открыть по очереди все ждущие Метеорчики. */
export function dropOverlay(app: App, onDone: () => void) {
  const before = wallet();
  const root = rewardLayer('meteor');
  const finish = () => {
    closeLayer(root);
    setTimeout(() => refreshCurrencies(before), 260);
    onDone();
  };
  const paint = (r: DropRarity) => {
    const c = RARITY[r].color;
    root.style.background = `radial-gradient(circle at 50% 52%, ${mix(c, 30)}, var(--sea-deep) 75%)`;
    root.style.setProperty('--ray', mix(c, 40, 'transparent'));
    root.style.setProperty('--glow', mix(c, 70, 'transparent'));
    root.style.setProperty('--rc', c);
  };
  const info = btn(icon('info'), () => dropOddsBox(), 'paper icon rw-info', { 'aria-label': 'Шансы' });

  // очередь: стопка метеорчиков, «Открыть» или «Все сразу»
  const queue = () => {
    const n = store.data.drops.length;
    if (n <= 1) { showDrop(store.data.drops[0]); return; }
    root.onclick = null;
    paint('rare');
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'), info,
      h('div.rw-title.ds', `Метеорчиков: ${n}`),
      h('div.m-stack', icon('meteor', 'b'), icon('meteor', 'b'), icon('meteor', 'b')),
      h('div.rw-btns', btn('Все сразу', allAtOnce, 'paper'), btn('Открыть', () => showDrop(store.data.drops[0]), 'lime lg')),
    );
  };

  const showDrop = (final: DropRarity) => {
    let step = 0;
    const target = Math.max(0, DROP_STEPS.indexOf(final));
    const left = store.data.drops.length;
    const ring = h('div.m-ring');
    const met = h('div.m-obj', icon('meteor', 'b'));
    const tag = h('div.m-rar');
    const pips = h('div.m-pips', ...DROP_STEPS.map(() => h('i')));
    const setStep = (k: number) => {
      const r = DROP_STEPS[k];
      const R = RARITY[r];
      paint(r);
      met.style.setProperty('--ms', String(SIZE[k]));
      tag.replaceChildren(icon(R.shape), R.name);
      tag.style.setProperty('--ri', R.ink);
      Array.from(pips.children).forEach((p, j) => (p as HTMLElement).classList.toggle('on', j <= k));
    };
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'), info,
      h('div.rw-title.ds', 'Метеорчик'),
      ring, met, tag, pips,
      h('div.rw-hint', 'Тапай по Метеорчику!'),
    );
    if (left > 1) root.appendChild(h('div.rw-counter', `ещё ${left - 1}`));
    setStep(0);
    // «Меньше анимаций»: сразу итоговая редкость
    if (lessMotion()) { step = target; setStep(target); }
    let opened = false;
    root.onclick = () => {
      if (opened) return;
      if (step < target) {
        step++;
        setStep(step);
        met.classList.remove('up', 'shake'); void met.offsetWidth; met.classList.add('up');
        sfx('drop', { pitch: 1 + step * 0.12 });
        audio.vibrate(15);
        burst(root, [RARITY[DROP_STEPS[step]].color, '#fffaf0'], 10 + step * 3);
        return;
      }
      opened = true;
      met.classList.add('open');
      sfx('box_open');
      audio.vibrate(40);
      burst(root, [RARITY[final].color, '#ffd23a', '#fffaf0'], 24, ['bling', 'coin']);
      const res = openNextDrop(store.data);
      store.commit();
      setTimeout(() => (res ? reveal(res) : next()), lessMotion() ? 50 : 520);
    };
  };

  const reveal = (res: NonNullable<ReturnType<typeof openNextDrop>>) => {
    root.onclick = null;
    const R = RARITY[res.rarity];
    if (res.item.kind === 'box') {
      // ящик из Метеорчика открываем как обычно, потом продолжаем
      root.style.display = 'none';
      boxOverlay(app, res.item.box, res.given, () => { root.style.display = ''; next(); }, 'Ящик из Метеорчика');
      return;
    }
    const shown = res.given[0] ?? res.item;
    const dup = (res.item.kind === 'hero' || res.item.kind === 'skin') && shown.kind === 'gems';
    const title = dup
      ? (res.item.kind === 'hero' ? `${getHero(res.item.heroId).name} уже есть — держи кристаллы` : 'Скин уже есть — держи кристаллы')
      : `${R.name} Метеорчик`;
    const titleEl = h('div.rw-title.ds', { style: { background: dup ? 'var(--paper)' : R.color, color: dup ? 'var(--ink)' : R.ink } }, title);
    const body = dup
      ? h('div.dup', dupCard(app, res.item), icon('chev', 'b', 'dup-arrow'), bigTile(app, shown))
      : bigTile(app, shown, R.color);
    body.classList.add('pop');
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'), titleEl, body,
      h('div.rw-btns', btn(store.data.drops.length ? 'Дальше' : 'Забрать', () => specialRewards(app, dup ? [] : [shown], next), 'lime lg')));
    sfx(shown.kind === 'hero' || shown.kind === 'skin' ? 'levelup' : shown.kind === 'coins' ? 'coin' : 'reward');
  };

  // «Все сразу»: открыть всё подряд и показать итог одним экраном
  const allAtOnce = () => {
    const got: Reward[] = [];
    while (store.data.drops.length) {
      const res = openNextDrop(store.data);
      if (!res) break;
      got.push(...(res.given.length ? res.given : [res.item]));
    }
    store.commit();
    sfx('box_open');
    paint('epic');
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'),
      h('div.rw-title.ds', 'Твои награды'),
      h('div.sum-row.many', ...got.slice(0, 10).map((r, k) => sumTile(app, r, k))),
      h('div.rw-btns', btn('Забрать', () => specialRewards(app, got, finish), 'lime lg')),
    );
    burst(root, ['#b45cff', '#ffd23a', '#fffaf0'], 24, ['bling']);
  };

  const next = () => {
    if (!store.data.drops.length) { finish(); return; }
    showDrop(store.data.drops[0]);
  };
  if (store.data.drops.length > 1) queue(); else next();
}

/** Карточка «уже есть» для повтора героя или скина. */
function dupCard(app: App, item: Reward) {
  if (item.kind !== 'hero' && item.kind !== 'skin') return h('div');
  const d = getHero(item.heroId);
  return h('div.dup-card', { style: { background: `var(--dots), ${d.color}` } },
    h('img', { src: app.portrait(item.heroId, item.kind === 'skin' ? item.skinId : 'default'), alt: '' }),
    h('div.dup-cap', 'уже есть'));
}
