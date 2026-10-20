// Открытие ящика: ящик трясётся, по тапу взрывается, награды вылетают по одной.
import { sfx } from '../../audio/sfx';
import { Rng } from '../../core/rng';
import { RARITY } from '../../heroes/rarity';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { ECONOMY, type BoxKind, type Reward } from '../../meta/economy';
import { openBox, rewardLabel } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { rewardCard } from '../common';
import { btn, h } from '../dom';
import type { Screen } from './index';

/** Значок редкости. */
export function rarityBadge(r: keyof typeof RARITY) {
  return h('span.rarity-badge.t', { style: { '--rc': RARITY[r].color } as any }, RARITY[r].name);
}

/** Большая карточка награды (из ящика, Старр-дропа, дороги трофеев). */
export function rewardReveal(app: App, r: Reward): HTMLElement {
  if (r.kind === 'hero') {
    const d = getHero(r.heroId);
    return h('div.box-reward.hero', { style: { '--rc': RARITY[d.rarity ?? 'common'].color } as any },
      h('div.br-new.t', 'НОВЫЙ ГЕРОЙ!'),
      h('img.br-img.hero-glow', { src: app.portrait(r.heroId) }),
      h('div.br-name.t', d.name),
      rarityBadge(d.rarity ?? 'common'),
      h('div.br-role', d.role),
    );
  }
  const l = rewardLabel(r);
  const skin = r.kind === 'skin' ? getSkin(r.heroId, r.skinId) : null;
  return h('div.box-reward.' + r.kind,
    skin && r.kind === 'skin' ? h('img.br-img', { src: app.portrait(r.heroId, r.skinId) }) : h('div.br-icon', l.icon),
    h('div.br-amount.t', skin ? 'Новый скин!' : (r.kind === 'coins' || r.kind === 'gems' || r.kind === 'bling') ? '+' + l.text : l.text),
    h('div.br-name.t', skin ? skin.name : r.kind === 'coins' ? 'Монеты' : r.kind === 'gems' ? 'Кристаллы' : r.kind === 'bling' ? 'Блинги' : ''),
    skin ? rarityBadge(skin.rarity) : null,
  );
}

/** Показать открытие ящика поверх всего. given — уже выданные награды (если null — ящик откроется сейчас). */
export function boxOverlay(app: App, kind: BoxKind, given: Reward[] | null, onDone: () => void, title?: string) {
  const t = ECONOMY.boxes[kind];
  const root = h('div.box-screen');
  const titleEl = h('div.box-title.t', title ?? t.name);
  const box = h('div.big-box.' + kind, { style: { '--box': t.color } as any },
    h('div.bb-lid'), h('div.bb-body', h('div.bb-emblem', '?')), h('div.bb-shine'));
  const hint = h('div.box-hint.t', 'Нажми, чтобы открыть!');
  root.append(titleEl, box, hint);
  document.getElementById('ui')!.appendChild(root);
  let shakeTimer = window.setInterval(() => { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); sfx('box_shake'); }, 900);
  let stage = 0;
  let rewards: Reward[] = [];
  let i = 0;
  const finish = () => {
    root.classList.add('hide');
    setTimeout(() => root.remove(), 250);
    onDone();
  };
  const showNext = () => {
    if (i >= rewards.length) {
      // итог
      root.innerHTML = '';
      root.append(h('div.box-title.t', 'Твои награды'), h('div.box-summary', ...rewards.map((r) => rewardCard(r))), btn('Готово', finish, 'btn-yellow'));
      return;
    }
    const r = rewards[i++];
    const card = rewardReveal(app, r);
    root.querySelector('.box-reward')?.remove();
    root.querySelector('.box-left')?.remove();
    root.append(card, h('div.box-left.t', `Осталось: ${rewards.length - i}`));
    sfx(r.kind === 'skin' || r.kind === 'hero' ? 'levelup' : r.kind === 'coins' ? 'coin' : 'reward');
  };
  root.addEventListener('click', () => {
    if (stage === 0) {
      stage = 1;
      clearInterval(shakeTimer);
      box.classList.add('open');
      hint.remove();
      sfx('box_open');
      if (!given) { rewards = openBox(store.data, kind, new Rng(Date.now() & 0xffffff)); store.commit(); }
      else rewards = given;
      const burst = h('div.burst');
      for (let k = 0; k < 18; k++) burst.appendChild(h('i', { style: { '--a': `${k * 20}deg`, '--d': `${120 + Math.random() * 120}px`, background: ['#ffd23f', '#fff', t.color][k % 3] } as any }));
      root.appendChild(burst);
      setTimeout(() => { box.remove(); titleEl.remove(); burst.remove(); stage = 2; showNext(); }, 650);
    } else if (stage === 2 && i < rewards.length + 1 && root.querySelector('.box-reward')) {
      showNext();
    }
  });
  return () => { clearInterval(shakeTimer); root.remove(); };
}

/** Экран-обёртка (например, подарок после обучения). */
export function boxOpening(app: App, kind: BoxKind, onDone: () => void, title?: string, given: Reward[] | null = null): Screen {
  const el = h('div.screen.dim');
  let cancel = () => {};
  return {
    el,
    onShow() { cancel = boxOverlay(app, kind, given, onDone, title); },
    dispose() { void cancel; },
  };
}
