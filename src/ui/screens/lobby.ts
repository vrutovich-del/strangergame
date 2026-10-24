// Лобби: герой на лаймовом подиуме, профиль и валюты сверху, разделы у левого пальца, «ИГРАТЬ» — под правым.
import { sfx } from '../../audio/sfx';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { mapsForMode } from '../../maps';
import { MODE_INFO } from '../../modes';
import { claimLogin, heroProgress, loginAvailable, notifications, upgradeCost } from '../../meta/progress';
import { ECONOMY } from '../../meta/economy';
import { store } from '../../meta/store';
import type { App } from '../app';
import { blobColor, curChip, lvlBadge, profileChip, rarityTag, refreshCurrencies, wallet } from '../common';
import { btn, h, modal } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { boxOverlay } from './boxes';
import { dropOverlay } from './drop';
import { dailyBox } from './calendar';

let loginShownThisSession = false;

export function lobbyScreen(app: App): Screen {
  const s = store.data;
  const n = notifications(s);
  const lo = app.selectedLoadout();
  const hero = getHero(lo.heroId);
  const hp = heroProgress(s, lo.heroId);
  app.showHero(lo.heroId, lo.skinId, 'idle', blobColor(hero.color));

  // разделы: число — сколько можно забрать, точка — есть что-то новое
  const claimQuests = s.quests.list.filter((q) => !q.claimed && q.progress >= q.target).length + (loginAvailable(s) ? 1 : 0);
  const sec = (id: string, label: string, bg: string, glyph: string, r: string, rot: string, badge: number | boolean, go: () => void, paper = false) =>
    h('button.sec' + (paper ? '.paperish' : ''), { onclick: () => { sfx('click'); go(); }, 'aria-label': label },
      h('div.sec-btn', { style: { background: bg, borderRadius: r, rotate: rot } },
        icon(glyph, paper ? 'a' : 'b'),
        typeof badge === 'number' && badge > 0 ? h('div.badge', badge > 9 ? '9+' : String(badge)) : badge === true ? h('div.dot') : null),
      h('div.sec-label', label));
  const sections = h('div.sections',
    sec('shop', 'Магазин', 'var(--tang)', 'bag', '20px 14px 18px 16px', '-2deg', n.shop, () => app.open('shop')),
    sec('heroes', 'Герои', 'var(--violet)', 'heroes', '14px 20px 16px 18px', '1.5deg', n.heroes, () => app.open('heroes')),
    sec('road', 'Дорога', 'var(--mint)', 'flag', '18px 16px 20px 14px', '-1deg', n.road, () => app.open('road')),
    sec('pass', 'Пропуск', 'var(--gum)', 'ticket', '16px 18px 14px 20px', '2deg', n.pass, () => app.open('pass')),
    sec('quests', 'Задания', 'var(--lime)', 'quests', '20px 16px 18px 14px', '-1.5deg', claimQuests || n.quests, () => app.open('quests')),
    sec('drops', 'Дропы', 'var(--paper)', 'meteor', '14px 18px 20px 16px', '1deg', s.drops.length, () => openDrops(app), true),
  );

  const mode = s.selectedMode;
  const mi = MODE_INFO[mode];
  const modeCard = h('div.mode-card', { style: { '--mc': mi.color } as any, onclick: () => { sfx('click'); app.open('modes'); } },
    icon(mi.icon, 'b'),
    h('div.mc-text', h('div.mc-name', mi.name), h('div.mc-sub', mode === 'training' ? 'Любой герой и скин' : `${mi.short} · карт: ${mapsForMode(mode).length}`)),
    icon('chev'),
  );
  const play = btn('ИГРАТЬ', () => {
    if (mode === 'training') app.playTraining(lo.heroId, lo.skinId);
    else app.playSolo(mode);
  }, 'yolk play');
  const roomOn = !!app.room?.alive;
  const friends = btn([icon('friends'), roomOn ? 'Комната ' + app.room.code : 'С друзьями', roomOn ? h('div.dot') : null], () => app.open('room'), 'sky friends');

  const cost = upgradeCost(hp.level);
  const lvlState = cost === null ? 'max' : s.coins >= cost ? 'up' : 'normal';
  const heroTag = h('div.hero-tag', { onclick: () => { sfx('click'); app.open('heroes', lo.heroId); } },
    h('div.ht-name', getSkin(lo.heroId, lo.skinId).name),
    h('div.ht-role', hero.role),
    h('div.ht-row', lvlBadge(hp.level, lvlState === 'max' ? 'max' : lvlState === 'up' ? 'up' : 'normal', `Ур. ${hp.level}`), h('div.ht-tro', icon('trophy'), String(hp.trophies))),
    rarityTag(hero.rarity ?? 'common'),
  );

  const stage = h('div.stage.lobby-stage');
  app.bindSpin(stage);
  const settings = btn(icon('gear'), () => app.open('settings'), 'sky icon', { 'aria-label': 'Настройки' });

  const el = h('div.screen.lobby',
    stage,
    profileChip(app),
    h('div.lobby-top', curChip(app, 'coins', 0), curChip(app, 'gems', 1), curChip(app, 'bling', 2), settings),
    heroTag,
    sections,
    h('div.play-col', modeCard, play, friends),
  );
  const blob = h('div.blob.lobby-blob', { style: { '--blob': blobColor(hero.color) } as any });
  const podium = h('div.podium.lobby-podium');

  // узкий экран: плашка героя наезжает на лицо — сдвигаем героя, подиум и кляксу левее
  const layout = () => {
    if (!el.isConnected) return;
    const st = stage.getBoundingClientRect(), tag = heroTag.getBoundingClientRect();
    const half = st.height * 0.3;
    const shift = Math.max(0, Math.min(st.width / 2 - half, st.left + st.width / 2 - (tag.left - half)));
    app.showcase.shiftFrac = st.width ? shift / st.width : 0;
    for (const e of [blob, podium]) e.style.translate = shift ? `${-shift}px 0` : '';
  };
  const onResize = () => requestAnimationFrame(layout);

  return {
    el,
    stage,
    back: [blob, podium],
    dispose() { window.removeEventListener('resize', onResize); },
    onShow() {
      window.addEventListener('resize', onResize);
      onResize();
      document.fonts?.ready.then(onResize);
      if (!loginShownThisSession && loginAvailable(s)) {
        // не мешаем, если игрок уже ушёл из лобби (например, зашёл в комнату друга по ссылке)
        setTimeout(() => {
          if (loginShownThisSession || app.screenName !== 'lobby' || app.battle) return;
          loginShownThisSession = true;
          showLoginPopup(app);
        }, 500);
      }
    },
  };
}

/** Метеорчики: открыть по очереди или показать пустое состояние. */
function openDrops(app: App) {
  if (store.data.drops.length) { dropOverlay(app, () => app.refresh()); return; }
  let close = () => {};
  close = modal(h('div.row', { style: 'flex-wrap:nowrap;justify-content:flex-start;gap:16px' },
    h('div.m-art', { style: 'transform:rotate(-6deg)' }, icon('meteor', 'b')),
    h('div.col', { style: 'align-items:flex-start;gap:8px' },
      h('div.m-title', 'Метеорчиков пока нет'),
      h('div.m-text', 'Побеждай в боях — за каждую победу прилетает Метеорчик.'),
      btn('В бой', () => { close(); const m = store.data.selectedMode; if (m === 'training') { const lo = app.selectedLoadout(); app.playTraining(lo.heroId, lo.skinId); } else app.playSolo(m); }, 'yolk sm'),
    ),
  ));
}

/** Календарь наград за вход (7 дней). */
export function showLoginPopup(app: App, after?: () => void) {
  const s = store.data;
  let close = () => {};
  const content = dailyBox(app, () => {
    const r = ECONOMY.login[s.login.next % 7];
    const before = wallet();
    const got = claimLogin(s);
    store.commit();
    if (r.kind === 'box' && got) { close(); boxOverlay(app, r.box, got, () => { app.refresh(); after?.(); }, 'Награда за вход'); }
    else if (got) { sfx('reward'); setTimeout(() => { close(); refreshCurrencies(before); after?.(); }, 650); }
  });
  close = modal(content, { cls: 'wide daily-modal', onClose: () => app.refresh() });
}
