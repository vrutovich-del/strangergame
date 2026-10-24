// Моменты награды: большая плитка награды, «Новый герой!» (тишина → вспышка → раскрытие → в коллекцию), «Новый скин!».
import { audio, sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { ECONOMY, type Reward } from '../../meta/economy';
import { BOX_ICON, heroProgress, ownsHero, rewardLabel } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { isNewModel, rarityTag } from '../common';
import { btn, burst, fmtNum, h, lessMotion } from '../dom';
import { icon } from '../icons';

const REWARD_NAME: Partial<Record<Reward['kind'], string>> = { coins: 'Монеты', gems: 'Кристаллы', bling: 'Блинги', emote: 'Эмоция' };

/** Полноэкранный слой награды: море, лучи, свечение. Тап по фону — onTap. */
export function rewardLayer(cls = '', onTap?: () => void) {
  const root = h('div.reward' + (cls ? '.' + cls : ''), h('div.rw-rays'), h('div.rw-glow'));
  if (onTap) root.addEventListener('click', onTap);
  document.getElementById('ui')!.appendChild(root);
  return root;
}
export function closeLayer(root: HTMLElement) {
  root.classList.add('hide');
  setTimeout(() => root.remove(), 240);
}

/** Большая плитка награды (в окне ящика или Метеорчика). rim — цвет каймы (редкость). */
export function bigTile(app: App, r: Reward, rim = 'var(--paper)') {
  const l = rewardLabel(r);
  if (r.kind === 'skin' || r.kind === 'hero') {
    const isHero = r.kind === 'hero';
    const sk = !isHero ? getSkin(r.heroId, r.skinId) : null;
    const d = getHero(r.heroId);
    return h('div.big-tile.pic', { style: { '--rim': rim, background: `var(--dots), ${sk ? sk.cardColor : d.color}` } as any },
      h('img', { src: app.bigPortrait(r.heroId, sk?.id ?? 'default'), alt: '' }),
      h('div.bt-cap', h('b.ds', sk ? sk.name : d.name), h('span', isHero ? 'новый герой' : 'новый скин')));
  }
  const glyph = r.kind === 'box' ? BOX_ICON[r.box] : l.icon;
  return h('div.big-tile', { style: { '--rim': rim } as any },
    icon(glyph, 'b'),
    h('div.bt-n.num', r.kind === 'box' ? '' : '×' + fmtNum(Number(l.text))),
    h('div.bt-name', r.kind === 'box' ? ECONOMY.boxes[r.box].name : REWARD_NAME[r.kind] ?? l.text),
  );
}

/** Маленькая плитка для итога (124×148). */
export function sumTile(app: App, r: Reward, i: number) {
  const t = bigTile(app, r);
  t.classList.add('sum');
  t.style.rotate = ['-3deg', '1.5deg', '-1deg', '2deg', '-2deg'][i % 5];
  t.style.animationDelay = `${i * 70}ms`;
  return t;
}

/**
 * «Новый герой!» — главный момент игры. Тишина и прожектор с силуэтом → вспышка цвета редкости →
 * раскрытие с именем, редкостью и супером → карточка «приклеивается» в альбом. Любой тап ускоряет.
 */
export function newHeroMoment(app: App, heroId: string, done: () => void) {
  const d = getHero(heroId);
  const R = RARITY[d.rarity ?? 'common'];
  const img = app.bigPortrait(heroId);
  let stage = 0;
  const timers: number[] = [];
  const root = rewardLayer('hero-moment', () => { if (stage < 2) reveal(); });
  root.style.setProperty('--rc', R.color);
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, lessMotion() ? 0 : ms));

  const dark = () => {
    root.classList.add('dark');
    root.append(h('div.hm-spot'), h('img.hm-sil', { src: img, alt: '' }), h('div.hm-q.ds', '? ? ?'));
    sfx('box_shake');
    later(850, flash);
  };
  const flash = () => {
    if (stage > 0) return;
    stage = 1;
    root.classList.remove('dark');
    root.classList.add('flash');
    audio.vibrate(40);
    sfx('box_open');
    later(380, reveal);
  };
  const reveal = () => {
    if (stage >= 2) return;
    stage = 2;
    timers.forEach(clearTimeout);
    root.className = 'reward hero-moment reveal';
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'));
    sfx('levelup');
    root.append(
      h('div.rw-title.ds', { style: { background: 'var(--lime)' } }, 'Новый герой!'),
      h('div.podium.hm-podium'),
      h('img.hm-hero', { src: img, alt: d.name }),
      h('div.hm-info',
        h('div.hm-name.ds', d.name),
        h('div.hm-row', rarityTag(d.rarity ?? 'common', true), h('span', d.role)),
        h('div.hm-super', icon('super', 'b'), h('div', h('b', `Супер: ${d.superName}`), h('span', d.superDesc))),
      ),
      h('div.rw-btns', btn('Дальше', album, 'lime lg')),
    );
    burst(root, [R.color, '#ffd23a', '#fffaf0'], 24, ['bling']);
  };
  const album = () => {
    const owned = store.data.owned.filter((x) => x !== heroId).slice(0, 3);
    root.replaceChildren(h('div.rw-rays'), h('div.rw-glow'),
      h('div.rw-title.ds', `${d.name} в коллекции!`),
      h('div.album',
        ...owned.slice(0, 2).map((id) => h('div.al-slot', h('img', { src: app.portrait(id), alt: '' }))),
        h('div.al-card', h('div.al-win', { style: { background: `var(--dots), ${d.color}` } }, h('img', { src: app.portrait(heroId), alt: '' })), h('div.al-name.ds', d.name), h('div.new-tag.ds', 'Новый!')),
        h('div.al-slot.empty', icon('lock')),
      ),
      h('div.rw-btns',
        btn('Позже', () => { closeLayer(root); done(); }, 'paper'),
        btn(`Выбрать: ${d.name}`, () => { store.data.selectedHero = heroId; store.commit(); closeLayer(root); done(); }, 'lime lg'),
      ),
    );
    sfx('stamp');
  };
  dark();
}

/** «Новый скин!»: лучи, скин на подиуме, имя и «Надеть» или «Дальше». */
export function newSkinMoment(app: App, heroId: string, skinId: string, done: () => void) {
  const sk = getSkin(heroId, skinId);
  const root = rewardLayer('skin-moment');
  sfx('levelup');
  const canWear = ownsHero(store.data, heroId);
  root.append(
    h('div.rw-title.ds.left', 'Новый скин!'),
    h('div.blob.sm-blob', { style: { '--blob': `color-mix(in oklab, ${sk.cardColor} 55%, #1aa7ac)` } as any }),
    h('div.podium.sm-podium'),
    h('img.sm-hero', { src: app.bigPortrait(heroId, skinId), alt: sk.name }),
    h('div.sp-card.sm-card',
      isNewModel(sk) ? h('div.nm-tag', 'Новая модель с анимациями') : null,
      h('div.sp-name.ds', sk.name),
      rarityTag(sk.rarity),
      h('div.m-text', 'Надеть можно сейчас или позже в окне героя.'),
      h('div.m-actions',
        btn('Дальше', () => { closeLayer(root); done(); }, 'paper'),
        canWear ? btn('Надеть', () => { heroProgress(store.data, heroId).skin = skinId; store.commit(); sfx('tab'); closeLayer(root); done(); }, 'lime') : null,
      ),
    ),
  );
  burst(root, [RARITY[sk.rarity].color, '#ffd23a', '#fffaf0'], 20);
}

/**
 * Показать подряд особые награды (новые герои и скины) из списка выданного. Остальное просто пропускаем.
 */
export function specialRewards(app: App, given: Reward[], done: () => void) {
  const list = given.filter((r) => r.kind === 'hero' || r.kind === 'skin');
  const next = () => {
    const r = list.shift();
    if (!r) { done(); return; }
    if (r.kind === 'hero') newHeroMoment(app, r.heroId, next);
    else if (r.kind === 'skin') newSkinMoment(app, r.heroId, r.skinId, next);
  };
  next();
}
