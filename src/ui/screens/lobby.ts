// Главное меню: герой на подиуме, валюты, кнопки разделов, карточка режима и большая кнопка «ИГРАТЬ».
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { mapsForMode } from '../../maps';
import { MODE_INFO } from '../../modes';
import { claimLogin, heroProgress, loginAvailable, notifications } from '../../meta/progress';
import { ECONOMY } from '../../meta/economy';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar, rewardCard } from '../common';
import { btn, h, modal } from '../dom';
import type { Screen } from './index';
import { boxOverlay, rarityBadge } from './boxes';
import { dropOverlay } from './drop';
import { sfx } from '../../audio/sfx';

let loginShownThisSession = false;

export function lobbyScreen(app: App): Screen {
  const s = store.data;
  const n = notifications(s);
  const lo = app.selectedLoadout();
  app.showHero(lo.heroId, lo.skinId);
  app.showcase.offsetX = 0;
  const hero = getHero(lo.heroId);
  const hp = heroProgress(s, lo.heroId);
  const dot = (on: boolean) => (on ? h('span.badge-dot') : null);
  const side = (icon: string, label: string, screen: string, on: boolean, arg?: any) =>
    btn([h('span.sb-ico', icon), h('span.sb-label', label), dot(on)], () => app.open(screen, arg), 'btn-side');

  const drops = s.drops.length
    ? btn([h('span.sb-ico', '⭐'), h('span.sb-label', 'Дропы'), h('span.badge-num', String(s.drops.length))], () => dropOverlay(app, () => app.refresh()), 'btn-side', { class: 'drop-side' })
    : null;
  const left = h('div.lobby-left',
    side('🛒', 'Магазин', 'shop', n.shop),
    side('🦸', 'Герои', 'heroes', n.heroes),
    side('🏆', 'Дорога', 'road', n.road),
  );
  const right = h('div.lobby-right',
    side('🎟️', 'Пропуск', 'pass', n.pass),
    side('📜', 'Задания', 'quests', n.quests),
    drops,
  );
  const mode = s.selectedMode;
  const mi = MODE_INFO[mode];
  const modeCard = h('div.mode-card', { onclick: () => app.open('modes'), style: { background: `linear-gradient(${mi.color}, #2c1d63)` } },
    h('div.mc-icon', mi.icon),
    h('div.mc-text', h('div.mc-name.t', mi.name), h('div.mc-sub', mode === 'training' ? 'Любой герой, все скины' : `${mi.short} · карт: ${mapsForMode(mode).length}`)),
    h('div.mc-arrow', '▶'),
  );
  const play = btn('ИГРАТЬ', () => {
    if (mode === 'training') app.playTraining(lo.heroId, lo.skinId);
    else app.playSolo(mode);
  }, 'btn-yellow', { class: 'btn-play' });
  // игра с друзьями — одной кнопкой рядом с «ИГРАТЬ»
  const friends = btn([h('span.fb-ico', '👥'), h('span.fb-label', 'С ДРУЗЬЯМИ'), dot(!!app.room?.alive)], () => app.open('room'), 'btn-blue', { class: 'btn-friends' });
  const heroTag = h('div.hero-tag', { onclick: () => app.open('heroes', lo.heroId) },
    h('div.ht-name.t', getSkin(lo.heroId, lo.skinId).name),
    h('div.ht-row', h('span.lvl-badge', 'Ур. ' + hp.level), h('span.ht-trophies.t', '🏆 ' + hp.trophies)),
    h('div.ht-role', hero.role),
    rarityBadge(hero.rarity ?? 'common'),
  );
  const settings = btn('⚙️', () => app.open('settings'), 'btn-icon', { class: 'lobby-settings' });
  const center = h('div.lobby-center');
  // вращение модели пальцем
  let drag: { x: number; t: number } | null = null;
  center.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: performance.now() }; center.setPointerCapture(e.pointerId); });
  center.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    app.showcase.yaw += dx * 0.012;
    app.showcase.yawVel = (dx * 0.012) / Math.max(0.008, (performance.now() - drag.t) / 1000);
    drag = { x: e.clientX, t: performance.now() };
  });
  center.addEventListener('pointerup', () => { drag = null; });
  center.addEventListener('pointercancel', () => { drag = null; });

  const el = h('div.screen.lobby',
    topBar(app),
    settings,
    left, right, center, heroTag,
    h('div.lobby-bottom', modeCard, play, friends),
  );

  return {
    el,
    showcase: true,
    onShow() {
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

/** Календарь наград за вход (7 дней). */
export function showLoginPopup(app: App, after?: () => void) {
  const s = store.data;
  const days = ECONOMY.login.map((r, i) => h('div.login-day' + (i < s.login.next ? '.done' : '') + (loginAvailable(s) && i === s.login.next ? '.today' : ''),
    h('div.ld-n', `День ${i + 1}`), rewardCard(r)));
  let close = () => {};
  const content = h('div.login',
    h('h2', 'Награда за вход'),
    h('p.small', 'Заходи каждый день — награды всё лучше!'),
    h('div.login-days', ...days),
    loginAvailable(s) ? btn('ЗАБРАТЬ', () => {
      const r = ECONOMY.login[s.login.next % 7];
      const got = claimLogin(s);
      store.commit();
      close();
      if (r.kind === 'box' && got) boxOverlay(app, r.box, got, () => { app.refresh(); after?.(); }, 'Награда за вход');
      else if (got) { sfx('reward'); app.refresh(); after?.(); }
    }, 'btn-green') : h('p', 'Приходи завтра!'),
  );
  close = modal(content, { onClose: () => app.refresh() });
}
