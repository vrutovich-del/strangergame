// Старр-дроп: звезда за победу. От тапов она «повышается» по редкостям, потом открывается одна награда.
import { sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import type { DropRarity } from '../../meta/economy';
import { DROP_STEPS, dropOdds, openNextDrop } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { append, btn, h, modal } from '../dom';
import { boxOverlay, rewardReveal } from './boxes';

function burst(root: HTMLElement, color: string, n = 18) {
  const b = h('div.burst');
  for (let k = 0; k < n; k++) b.appendChild(h('i', { style: { '--a': `${k * (360 / n)}deg`, '--d': `${110 + Math.random() * 130}px`, background: ['#ffffff', color, '#ffd23f'][k % 3] } as any }));
  root.appendChild(b);
  setTimeout(() => b.remove(), 800);
}

export function showDropOdds() {
  modal(h('div',
    h('h2', 'Старр-дроп'),
    h('p', 'За каждую победу — один Старр-дроп. Чем он реже, тем лучше награда:'),
    h('ul.odds', ...dropOdds().map((x) => h('li', x))),
    h('p.small', 'Внутри: монеты, кристаллы, блинги, ящики, скины или новый герой. Из Редкого дропа может выпасть только редкий герой, из Эпического — до эпического.'),
  ), { cls: 'top' });
}

/** Открыть по очереди все ждущие Старр-дропы. */
export function dropOverlay(app: App, onDone: () => void) {
  const root = h('div.drop-screen');
  document.getElementById('ui')!.appendChild(root);
  let shakeTimer = 0;
  const finish = () => {
    clearInterval(shakeTimer);
    root.classList.add('hide');
    setTimeout(() => root.remove(), 250);
    onDone();
  };
  const paint = (r: DropRarity) => {
    root.style.setProperty('--dc', RARITY[r].color);
    root.style.setProperty('--dd', RARITY[r].dark);
  };

  const showDrop = (final: DropRarity) => {
    let step = 0;
    const target = DROP_STEPS.indexOf(final);
    const left = store.data.drops.length - 1;
    root.innerHTML = '';
    root.style.display = '';
    const star = h('div.starr', h('div.starr-face.t', '?'));
    const name = h('div.drop-rarity.t', RARITY[DROP_STEPS[0]].name);
    paint(DROP_STEPS[0]);
    append(root, [
      h('div.box-title.t', 'Старр-дроп!'),
      name, star,
      h('div.box-hint.t', 'Нажимай на звезду!'),
      left > 0 ? h('div.box-left.t', `Ещё дропов: ${left}`) : null,
      btn('i', () => showDropOdds(), 'btn-blue', { class: 'info-btn drop-info' }),
    ]);
    clearInterval(shakeTimer);
    shakeTimer = window.setInterval(() => { star.classList.remove('shake'); void star.offsetWidth; star.classList.add('shake'); sfx('box_shake'); }, 1000);
    let opened = false;
    root.onclick = () => {
      if (opened) return;
      if (step < target) {
        // повышение редкости
        step++;
        const r = DROP_STEPS[step];
        paint(r);
        name.textContent = RARITY[r].name + '!';
        star.classList.remove('up', 'shake'); void star.offsetWidth; star.classList.add('up');
        sfx('drop', { pitch: 1 + step * 0.12 });
        burst(root, RARITY[r].color, 12 + step * 3);
        return;
      }
      opened = true;
      clearInterval(shakeTimer);
      star.classList.add('open');
      sfx('box_open');
      burst(root, RARITY[final].color, 24);
      const res = openNextDrop(store.data);
      store.commit();
      setTimeout(() => res ? reveal(res) : next(), 600);
    };
  };

  const reveal = (res: NonNullable<ReturnType<typeof openNextDrop>>) => {
    root.onclick = null;
    root.innerHTML = '';
    if (res.item.kind === 'box') {
      // ящик открываем как обычно, а потом продолжаем дропы
      root.style.display = 'none';
      boxOverlay(app, res.item.box, res.given, () => next(), 'Ящик из Старр-дропа!');
      return;
    }
    const shown = res.given[0] ?? res.item;
    const dup = res.item.kind === 'hero' && shown.kind === 'gems' ? 'Этот герой уже есть — держи кристаллы!'
      : res.item.kind === 'skin' && shown.kind === 'gems' ? 'Этот скин уже есть — держи кристаллы!' : '';
    append(root, [
      h('div.box-title.t', RARITY[res.rarity].name + ' дроп'),
      rewardReveal(app, shown),
      dup ? h('div.small', dup) : null,
      btn(store.data.drops.length ? 'Следующий дроп ▶' : 'Готово', () => next(), 'btn-yellow'),
    ]);
    sfx(shown.kind === 'hero' || shown.kind === 'skin' ? 'levelup' : shown.kind === 'coins' ? 'coin' : 'reward');
    if (shown.kind === 'hero') burst(root, RARITY[res.rarity].color, 30);
  };

  const next = () => {
    if (!store.data.drops.length) { finish(); return; }
    showDrop(store.data.drops[0]);
  };
  next();
}
