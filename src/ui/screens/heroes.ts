// Герои: коллекция карточек (лента вбок, выдерживает 40 героев), окно героя (вкладки «Герой» и «Скины»),
// прокачка с отсчётом «было → стало», предпросмотр скина на подиуме, покупка закрытого героя за любую валюту.
import { audio, sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero, playableHeroes } from '../../heroes/registry';
import { getSkin, skinsOf } from '../../heroes/skins';
import { ECONOMY, TROPHY_ROAD, type Currency } from '../../meta/economy';
import { buyHero, buySkin, heroPrice, heroProgress, heroStatsAt, ownsHero, ownsSkin, passRewardTier, upgradeCost, upgradeHero } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { blobColor, CUR_ICON, isNewModel, lvlBadge, rarityTag, refreshCurrencies, screenHead, wallet } from '../common';
import { btn, burst, countUp, fmtNum, h, lessMotion, toast } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { buyArt, confirmBuy, poorBox } from './modals';
import { newHeroMoment } from './rewards';
import { enableDragScroll } from './shop';

/** Где взять закрытого героя бесплатно (купить можно сразу — в окне героя и в магазине). */
export function howToGet(heroId: string) {
  const road = TROPHY_ROAD.find((m) => m.reward.kind === 'hero' && m.reward.heroId === heroId);
  const ways: { glyph: string; t: string }[] = [];
  if (road) ways.push({ glyph: 'flag', t: `Дорога · ${fmtNum(road.at)}` });
  ways.push({ glyph: 'meteor', t: 'Метеорчики' }, { glyph: 'box2', t: 'Ящики' });
  return ways;
}

// «Новый!» — герой открыт, но его окно ещё не смотрели (хранится на устройстве)
const SEEN_KEY = 'seen-heroes';
function seenHeroes(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) { const all = store.data.owned; localStorage.setItem(SEEN_KEY, JSON.stringify(all)); return new Set(all); }
    return new Set(JSON.parse(raw));
  } catch { return new Set(store.data.owned); }
}
function markSeen(id: string) {
  const s = seenHeroes(); s.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* приватный режим */ }
}
const once = (key: string) => { try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); return true; } catch { return false; } };

const RADS = ['20px 14px 22px 16px', '16px 22px 14px 24px', '22px 16px 24px 14px', '18px 22px 16px 20px', '14px 20px 18px 22px'];
const PRAD = ['14px 10px 16px 12px', '12px 16px 10px 18px', '16px 12px 18px 10px', '14px 16px 12px 18px', '10px 14px 16px 18px'];
const ROT = ['0deg', '.6deg', '-.6deg', '.4deg', '-.4deg'];

export function heroesScreen(app: App, focus?: string): Screen {
  if (focus) return heroWindow(app, focus);
  const s = store.data;
  const all = playableHeroes();
  const seen = seenHeroes();
  let filter: 'all' | 'up' | 'locked' = 'all';
  const canUp = (id: string) => { const c = upgradeCost(heroProgress(s, id).level); return ownsHero(s, id) && c !== null && s.coins >= c; };
  const upCount = all.filter((d) => canUp(d.id)).length;
  const row = h('div.hcards');
  const scroller = h('div.hscroll.hcards-scroll', row);
  const mini = h('div.minimap');

  const card = (d: (typeof all)[number], i: number) => {
    const has = ownsHero(s, d.id);
    const hp = heroProgress(s, d.id);
    const cost = upgradeCost(hp.level);
    const max = has && cost === null;
    const up = canUp(d.id);
    const sel = s.selectedHero === d.id;
    const isNew = has && !seen.has(d.id);
    const R = RARITY[d.rarity ?? 'common'];
    const road = TROPHY_ROAD.find((m) => m.reward.kind === 'hero' && m.reward.heroId === d.id);
    const skin = has && ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default';
    return h('div.hcard' + (has ? '' : '.locked') + (sel ? '.sel' : '') + (isNew ? '.new' : '') + (max ? '.max' : ''), {
      style: { borderRadius: RADS[i % 5], rotate: ROT[i % 5], '--hc': d.color, animationDelay: `${Math.min(i, 12) * 30}ms` } as any,
      onclick: () => { sfx('click'); app.setScreen('hero', heroWindow(app, d.id)); },
    },
      h('div.hc-win', { style: { borderRadius: PRAD[i % 5] } }, h('img', { src: app.portrait(d.id, skin), alt: d.name, loading: 'lazy' })),
      has ? lvlBadge(hp.level, max ? 'max' : up ? 'up' : 'normal', `Ур. ${hp.level}`) : icon('lock', 'b', 'hc-lock'),
      has ? h('div.trophy-chip.hc-tro', icon('trophy'), String(hp.trophies)) : null,
      up && cost !== null ? h('div.hc-up', icon('up'), icon('coin'), fmtNum(cost)) : null,
      sel ? h('div.sel-tag', icon('check'), 'Выбран') : null,
      isNew ? h('div.new-tag.ds', 'Новый!') : null,
      h('div.hc-name.ds', d.name),
      h('div.hc-sub', has ? (max ? 'Максимальный уровень' : d.role) : h('span', h('b', road ? `Дорога ${fmtNum(road.at)}` : 'Дропы'), road ? ', дропы, магазин' : ', ящики, магазин')),
      h('span.rar.hc-rar', { style: { '--rc': R.color, '--ri': R.ink } as any }, icon(R.shape), R.name),
    );
  };

  const render = () => {
    const list = all.filter((d) => filter === 'all' || (filter === 'up' ? canUp(d.id) : !ownsHero(s, d.id)));
    row.replaceChildren(...list.map(card));
    if (!list.length) row.appendChild(h('div.empty-box', icon(filter === 'up' ? 'up' : 'heroes', 'b'), h('div.col', { style: 'align-items:flex-start;gap:6px' },
      h('div.m-title', filter === 'up' ? 'Прокачивать пока некого' : 'Все герои уже открыты!'),
      h('div.m-small', filter === 'up' ? 'Монеты дают за бои, задания и Дорогу трофеев.' : 'Новые герои будут выходить в обновлениях.'))));
    mini.replaceChildren(h('div.mm-dots', h('div.mm-win'), ...list.map((d) => h('i', { style: { background: ownsHero(s, d.id) ? RARITY[d.rarity ?? 'common'].color : '#6f6a5e' } }))), h('span.mm-text'));
    scroller.scrollLeft = 0;
    requestAnimationFrame(updateMini);
  };
  const updateMini = () => {
    const cards = row.children.length;
    const over = scroller.scrollWidth > scroller.clientWidth + 4;
    mini.style.display = over ? '' : 'none';
    if (!over || !cards) return;
    const cw = scroller.scrollWidth / cards;
    const a = Math.floor(scroller.scrollLeft / cw) + 1, b = Math.min(cards, Math.floor((scroller.scrollLeft + scroller.clientWidth) / cw));
    (mini.querySelector('.mm-text') as HTMLElement).textContent = `${a}–${b} из ${cards}`;
    const win = mini.querySelector('.mm-win') as HTMLElement;
    win.style.left = `calc(${a - 1} * var(--dot))`;
    win.style.width = `calc(${Math.max(1, b - a + 1)} * var(--dot) + 4px)`;
  };
  scroller.addEventListener('scroll', updateMini, { passive: true });

  const filters = h('div.filters');
  const fbtn = (id: typeof filter, label: string) => {
    const b = h('button.fbtn' + (filter === id ? '.on' : ''), label);
    b.addEventListener('click', () => { filter = id; sfx('tab'); filters.querySelectorAll('.fbtn').forEach((x) => x.classList.toggle('on', x === b)); render(); });
    return b;
  };
  filters.append(fbtn('all', 'Все'), fbtn('up', 'Прокачка' + (upCount ? ` · ${upCount}` : '')), fbtn('locked', 'Закрытые'));

  const owned = all.filter((d) => ownsHero(s, d.id)).length;
  const tip = once('tip-heroes') ? h('div.tipbar', icon('info', 'b'), 'Нажми на героя — покажем его удары и скины') : null;
  const el = h('div.screen.heroes',
    screenHead(app, 'Герои', { count: `${owned} / ${all.length}`, extra: [filters], cur: ['coins'] }),
    scroller, mini, tip,
  );
  render();
  return { el, onShow: () => { enableDragScroll(scroller); updateMini(); } };
}

// ───────────── окно героя ─────────────
const SUPER_ICON: Record<string, string> = { bacteria: 'infect', stoptime: 'timestop' };
const speedText = (v: number) => (v < 2.2 ? 'Медленная' : v > 2.6 ? 'Быстрая' : 'Обычная');
const rangeText = (v: number) => (v <= 3 ? 'Ближняя' : v <= 6.5 ? 'Средняя' : 'Дальняя');
const secText = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')} с`;

export function heroWindow(app: App, heroId: string, tab: 'info' | 'skins' = 'info'): Screen {
  const s = store.data;
  const d = getHero(heroId);
  const has = ownsHero(s, heroId);
  if (has) markSeen(heroId);
  const hp = heroProgress(s, heroId);
  const R = RARITY[d.rarity ?? 'common'];
  const skinId = has && ownsSkin(s, heroId, hp.skin) ? hp.skin : 'default';
  const stage = h('div.stage.hw-stage');
  if (has) { app.showHero(heroId, skinId, 'idle', blobColor(d.color)); app.bindSpin(stage); }
  const reopen = (t = tab) => app.setScreen('hero', heroWindow(app, heroId, t));

  // табличка с именем под подиумом и кнопка «Выбрать»
  const plate = h('div.hw-plate', h('div.ds', d.name), rarityTag(d.rarity ?? 'common'), has ? h('div.ht-tro', icon('trophy'), String(hp.trophies)) : null);
  const select = !has ? null : s.selectedHero === heroId
    ? h('div.sel-tag.hw-sel', icon('check'), 'Выбран')
    : btn([icon('check'), 'Выбрать'], () => { s.selectedHero = heroId; store.commit(); sfx('tab'); app.toLobby(); }, 'yolk sm hw-sel');
  const mystery = has ? null : h('div.hw-mystery.ds', '?');

  // вкладки
  const skins = skinsOf(heroId);
  const tabs = h('div.tabs',
    h('button.tab' + (tab === 'info' ? '.on' : ''), { onclick: () => { if (tab !== 'info') { sfx('tab'); reopen('info'); } } }, icon('heroes'), 'Герой'),
    h('button.tab' + (tab === 'skins' ? '.on' : ''), { onclick: () => { if (tab !== 'skins') { sfx('tab'); reopen('skins'); } } }, icon('ticket'), 'Скины', h('span.tab-n', String(skins.length))),
  );
  let body: HTMLElement;
  if (tab === 'skins') body = skinsGrid(app, heroId);
  else if (!has) body = lockedInfo(app, heroId);
  else body = heroInfo(app, heroId, () => reopen('info'));
  const panel = h('div.hw-panel', tabs, body);

  const el = h('div.screen.hero-win',
    btn(icon('back'), () => app.open('heroes'), 'sky icon hw-back', { 'aria-label': 'Назад' }),
    select, stage, mystery, h('div.hw-plate-wrap', plate), panel,
  );
  return {
    el, stage: has ? stage : undefined,
    back: [h('div.blob.hw-blob', { style: { '--blob': blobColor(has ? d.color : '#2f62b8') } as any }), h('div.podium.hw-podium')],
    onShow: () => { const g = panel.querySelector('.skins-grid') as HTMLElement | null; if (g) enableDragScroll(g); void R; },
  };
}

function heroInfo(app: App, heroId: string, reopen: () => void) {
  const s = store.data;
  const d = getHero(heroId);
  const hp = heroProgress(s, heroId);
  const st = heroStatsAt(heroId, hp.level);
  const cost = upgradeCost(hp.level);
  const stat = (glyph: string, label: string, v: string) => h('div.stat', icon(glyph), h('div', h('span', label), h('b.num', v)));
  const move = (glyph: string, bg: string, name: string, kind: string, desc: string) => h('div.move', h('div.move-ic', { style: { background: bg } }, icon(glyph)), h('div', h('b', name, h('span', ' · ' + kind)), h('p', desc)));
  const poor = cost !== null && s.coins < cost;
  const foot = cost === null
    ? h('div.hw-foot', h('div.hw-lvl.num', `Ур. ${hp.level}`), h('div.max-chip', icon('r6'), 'Максимальный уровень'))
    : h('div.hw-foot',
      h('div.col', { style: 'align-items:flex-start;gap:4px' },
        h('div.hw-lvl.num', `Ур. ${hp.level} → ${hp.level + 1}`),
        poor ? h('div.need', icon('coin'), `Не хватает ${fmtNum(cost - s.coins)} — монеты дают за бои и Дорогу`) : null),
      btn([icon('up'), 'Прокачать', h('span.price-chip' + (poor ? '.poor' : ''), icon('coin'), fmtNum(cost))], () => {
        if (store.data.coins < cost) { poorBox(app, 'coins', cost, `Прокачка: ${d.name}`); return; }
        const before = wallet();
        if (!upgradeHero(store.data, heroId)) return;
        store.commit();
        refreshCurrencies(before);
        upgradeMoment(app, heroId, hp.level - 1, reopen);
      }, 'lime hw-up'),
    );
  return h('div.hw-info',
    h('div.stats',
      stat('hp', 'Здоровье', fmtNum(st.hp)), stat('damage', 'Урон', fmtNum(st.damage)), stat('supercharge', 'Супер', fmtNum(st.superDamage)),
      stat('speed', 'Скорость', speedText(d.stats.speed)), stat('range', 'Дальность', rangeText(d.attackAim.range)), stat('reload', 'Перезарядка', secText(d.stats.reload)),
    ),
    move('attack', 'var(--tang)', d.attackName, 'атака', d.attackDesc),
    move(SUPER_ICON[heroId] ?? 'super', 'var(--yolk)', d.superName, 'супер', d.superDesc),
    foot,
  );
}

function lockedInfo(app: App, heroId: string) {
  const d = getHero(heroId);
  const buy = (cur: Currency) => {
    const price = heroPrice(heroId, cur);
    return btn([icon(CUR_ICON[cur]), h('span.num', fmtNum(price))], () => {
      confirmBuy(app, {
        title: d.name, sub: `Герой откроется сразу · ${RARITY[d.rarity ?? 'common'].name.toLowerCase()}`, cur, price,
        art: buyArt({ img: app.portrait(heroId), bg: d.color }),
        onBuy: () => {
          const before = wallet();
          if (!buyHero(store.data, heroId, cur)) return;
          store.commit();
          refreshCurrencies(before);
          newHeroMoment(app, heroId, () => app.setScreen('hero', heroWindow(app, heroId)));
        },
      });
    }, 'lime sm');
  };
  return h('div.hw-info',
    h('div.hw-desc', h('b', d.role), h('p', d.description)),
    h('div.hw-desc', h('b', `Супер: ${d.superName}`), h('p', d.superDesc)),
    h('div.label-s', 'Где взять'),
    h('div.ways', ...howToGet(heroId).map((w) => h('div.way', icon(w.glyph), w.t))),
    h('div.buy3-wrap', h('div.label-s', 'Или купи сразу — чем удобнее'), h('div.buy3', buy('coins'), buy('gems'), buy('bling'))),
  );
}

function skinsGrid(app: App, heroId: string) {
  const s = store.data;
  const has = ownsHero(s, heroId);
  const hp = heroProgress(s, heroId);
  const cards = skinsOf(heroId).map((sk, i) => {
    const owned = ownsSkin(s, heroId, sk.id);
    const on = has && (hp.skin === sk.id || (!ownsSkin(s, heroId, hp.skin) && sk.id === 'default'));
    let foot: HTMLElement;
    if (on) foot = h('div.sk-foot.on', icon('check'), 'Надет');
    else if (owned && has) foot = h('div.sk-foot.own', 'Есть');
    else if (sk.exclusive) foot = h('div.sk-foot.pass', `Пропуск · ${passRewardTier(heroId, sk.id) ?? ECONOMY.pass.tiers}`);
    else if (!has) foot = h('div.sk-foot.own', icon('lock'), 'Герой закрыт');
    else foot = h('div.sk-foot', icon(CUR_ICON[sk.currency]), fmtNum(sk.price));
    const R = RARITY[sk.rarity];
    return h('div.skin-card' + (on ? '.on' : ''), { style: { borderRadius: PRAD[i % 5] }, onclick: () => { sfx('click'); app.setScreen('skin', skinPreview(app, heroId, sk.id)); } },
      h('div.sk-win', { style: { background: `var(--dots), ${sk.cardColor}` } },
        h('img', { src: app.portrait(heroId, sk.id), alt: sk.name, loading: 'lazy' }),
        icon(R.shape, 'a', 'sk-rar'),
        isNewModel(sk) ? h('div.sk-nm', 'Новая модель') : null),
      h('div.sk-name', sk.name),
      foot);
  });
  return h('div.skins-grid.hscroll', ...cards);
}

// ───────────── прокачка: вспышка, «Ур. N!», строки «было → стало» ─────────────
function upgradeMoment(app: App, heroId: string, fromLevel: number, done: () => void) {
  const a = heroStatsAt(heroId, fromLevel), b = heroStatsAt(heroId, fromLevel + 1);
  sfx('levelup');
  audio.vibrate(30);
  const rows = [['hp', 'Здоровье', a.hp, b.hp], ['damage', 'Урон', a.damage, b.damage], ['supercharge', 'Урон супера', a.superDamage, b.superDamage]] as const;
  const vals: HTMLElement[] = [];
  const root = h('div.moment.upg',
    h('div.moment-rays.lime'),
    h('div.upg-card',
      h('div.upg-tag.ds', `Ур. ${fromLevel + 1}!`),
      ...rows.map(([g, l, x, y]) => {
        const v = h('b.num', fmtNum(x));
        vals.push(v);
        return h('div.upg-row', icon(g), h('span', l), h('s.num', fmtNum(x)), icon('chev'), v);
      }),
      h('div.m-actions', btn('Отлично', () => { root.classList.add('hide'); setTimeout(() => root.remove(), 160); done(); }, 'lime')),
    ),
  );
  document.getElementById('ui')!.appendChild(root);
  burst(root, ['#c6ff3a', '#ffd23a', '#fffaf0'], 18, ['coin']);
  vals.forEach((v, i) => setTimeout(() => countUp(v, rows[i][2], rows[i][3], 600, '', fmtNum), lessMotion() ? 0 : 300 + i * 150));
  void app;
}

// ───────────── предпросмотр скина ─────────────
export function skinPreview(app: App, heroId: string, skinId: string): Screen {
  const s = store.data;
  const d = getHero(heroId);
  const sk = getSkin(heroId, skinId);
  const has = ownsHero(s, heroId);
  const hp = heroProgress(s, heroId);
  const owned = ownsSkin(s, heroId, skinId);
  const on = has && hp.skin === skinId;
  const stage = h('div.stage.sp-stage');
  app.showHero(heroId, skinId, 'idle', blobColor(sk.cardColor));
  app.bindSpin(stage);
  const back = () => app.setScreen('hero', heroWindow(app, heroId, 'skins'));
  const reopen = () => app.setScreen('skin', skinPreview(app, heroId, skinId));
  const equip = () => { hp.skin = skinId; store.commit(); sfx('tab'); toast(`Надет: ${sk.name}`, 'good', 'check'); reopen(); };
  let action: HTMLElement;
  if (on) action = btn([icon('check'), 'Надет'], () => {}, 'claimed');
  else if (owned && has) action = btn('Надеть', equip, 'lime');
  else if (!has) action = btn([icon('lock'), 'Сначала открой героя'], () => {}, 'locked', { why: 'Открой героя — в окне героя или в магазине' });
  else if (sk.exclusive) action = btn([icon('ticket'), `Пропуск · ур. ${passRewardTier(heroId, skinId) ?? ECONOMY.pass.tiers}`], () => app.open('pass'), 'gum');
  else action = btn([icon(CUR_ICON[sk.currency]), h('span.num', fmtNum(sk.price))], () => {
    confirmBuy(app, {
      title: sk.name, sub: `Скин для героя ${d.name}` + (isNewModel(sk) ? ' · новая модель с анимациями' : ''), cur: sk.currency, price: sk.price,
      art: buyArt({ img: app.portrait(heroId, skinId), bg: sk.cardColor }),
      onBuy: () => {
        const before = wallet();
        if (!buySkin(store.data, heroId, skinId)) return;
        hp.skin = skinId;
        store.commit();
        sfx('buy');
        refreshCurrencies(before);
        toast(`Новый скин: ${sk.name}!`, 'good', 'ticket');
        reopen();
      },
    });
  }, 'lime price');
  const card = h('div.sp-card',
    isNewModel(sk) ? h('div.nm-tag', 'Новая модель с анимациями') : null,
    h('div.sp-name.ds', sk.name),
    rarityTag(sk.rarity),
    h('div.m-text', sk.desc),
    h('div.m-actions', action),
  );
  const el = h('div.screen.skin-prev',
    screenHead(app, `Скины: ${d.name}`, { back, cur: [] }),
    stage, card,
  );
  return { el, stage, back: [h('div.blob.sp-blob', { style: { '--blob': blobColor(sk.cardColor) } as any }), h('div.podium.sp-podium')] };
}
