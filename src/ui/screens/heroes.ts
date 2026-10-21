// Герои: сетка карточек с редкостью, подробности, прокачка с анимацией, скины. Закрытые герои — с замком.
import { sfx } from '../../audio/sfx';
import { RARITY } from '../../heroes/rarity';
import { getHero, playableHeroes } from '../../heroes/registry';
import { skinsOf } from '../../heroes/skins';
import { ECONOMY, TROPHY_ROAD } from '../../meta/economy';
import { buySkin, heroProgress, heroStatsAt, ownsHero, ownsSkin, upgradeCost, upgradeHero } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, h, modal, toast } from '../dom';
import { rarityBadge } from './boxes';
import type { Screen } from './index';
import { enableDragScroll } from './shop';

/** Где взять закрытого героя. */
export function howToGet(heroId: string) {
  const road = TROPHY_ROAD.find((m) => m.reward.kind === 'hero' && m.reward.heroId === heroId);
  const ways = ['⭐ Старр-дропы за победы', '📦 ящики'];
  if (road) ways.push(`🏆 Дорога трофеев: ${road.at} трофеев`);
  return ways;
}

export function heroesScreen(app: App, focus?: string): Screen {
  const s = store.data;
  const grid = h('div.hero-row');
  const all = playableHeroes();
  const owned = all.filter((d) => ownsHero(s, d.id)).length;
  for (const d of all) {
    const has = ownsHero(s, d.id);
    const hp = heroProgress(s, d.id);
    const cost = upgradeCost(hp.level);
    const canUp = has && cost !== null && s.coins >= cost;
    const rar = RARITY[d.rarity ?? 'common'];
    const card = h('div.hero-card' + (s.selectedHero === d.id ? '.selected' : '') + (has ? '' : '.locked'), {
      onclick: () => heroDetail(app, d.id), style: { '--hc': d.color, '--rc': rar.color } as any,
    },
      has ? h('div.hc-top', h('span.lvl-badge', 'Ур. ' + hp.level), h('span.hc-trophies.t', '🏆 ' + hp.trophies)) : h('div.hc-top', h('span.hc-lock', '🔒'), null),
      h('img.hc-img', { src: app.portrait(d.id, has && ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default') }),
      h('div.hc-name.t', d.name),
      h('div.hc-role', has ? d.role : 'Ещё не открыт'),
      s.selectedHero === d.id ? h('div.hc-sel', '✔ Выбран') : null,
      canUp ? h('div.hc-up', '⬆ Прокачка!') : null,
      h('div.hc-rarity.t', rar.name),
    );
    grid.appendChild(card);
  }
  grid.appendChild(h('div.hero-card.soon', h('div.soon-q', '?'), h('div.hc-name.t', `Герой №${all.length + 1}`), h('div.hc-role', 'Скоро! Автор уже придумывает…')));
  const scroller = h('div.hscroll.hero-scroll', grid);
  const el = h('div.screen.panel-screen', topBar(app, { title: `Герои ${owned}/${all.length}`, back: true }), scroller);
  if (focus) setTimeout(() => heroDetail(app, focus), 50);
  return { el, onShow: () => enableDragScroll(scroller) };
}

function statRow(label: string, a: number | string, b?: number | string) {
  return h('div.stat', h('span.st-l', label), h('span.st-v.t', String(a)), b !== undefined ? h('span.st-up.t', '→ ' + b) : null);
}

export function heroDetail(app: App, heroId: string) {
  const s = store.data;
  const d = getHero(heroId);
  let close = () => {};
  // справа две вкладки: «Герой» (характеристики) и «Скины» (лента вбок) — без прокрутки вниз
  let tab: 'info' | 'skins' = 'info';
  const render = (upgraded = false) => {
    const has = ownsHero(s, heroId);
    const hp = heroProgress(s, heroId);
    const st = heroStatsAt(heroId, hp.level);
    const prev = upgraded ? heroStatsAt(heroId, hp.level - 1) : null;
    const cost = upgradeCost(hp.level);
    const skins = skinsOf(heroId);
    const skinList = h('div.skin-list.hscroll', ...skins.map((sk) => {
      const owned = ownsSkin(s, heroId, sk.id);
      const active = hp.skin === sk.id || (!ownsSkin(s, heroId, hp.skin) && sk.id === 'default');
      let action: HTMLElement;
      if (!has) action = h('div.sk-tag', '🔒');
      else if (owned) action = active ? h('div.sk-tag', 'Надет') : btn('Надеть', () => { hp.skin = sk.id; store.commit(); sfx('tab'); refresh(); }, 'btn-blue', { class: 'btn-sm' });
      else if (sk.exclusive) action = h('div.sk-tag.ex', '🎟️ Пропуск');
      else action = btn([sk.currency === 'gems' ? '💎' : '✨', String(sk.price)], () => {
        if (buySkin(s, heroId, sk.id)) { hp.skin = sk.id; store.commit(); sfx('buy'); toast('Новый скин: ' + sk.name + '!', 'good'); refresh(); }
        else toast(sk.currency === 'gems' ? 'Не хватает кристаллов' : 'Не хватает блингов', 'bad');
      }, sk.currency === 'gems' ? 'btn-green' : 'btn-purple', { class: 'btn-sm' });
      return h('div.skin-card' + (active && has ? '.active' : '') + (owned ? '' : '.locked'), { style: { '--sc': sk.cardColor } as any },
        h('img', { src: app.portrait(heroId, sk.id) }),
        h('div.sk-name.t', sk.name),
        action,
      );
    }));
    const upBtn = cost === null
      ? h('div.max-tag.t', 'Максимальный уровень!')
      : btn(['Прокачать ', h('span', '🪙 ' + cost)], () => {
        if (upgradeHero(s, heroId)) {
          store.commit();
          sfx('levelup');
          refresh(true);
        } else toast('Не хватает монет', 'bad');
      }, s.coins >= (cost ?? 0) ? 'btn-green' : 'btn-gray', { class: s.coins >= (cost ?? 0) ? '' : 'disabled' });
    const left = has
      ? [
        h('div.hd-lvl', h('span.lvl-badge.big', 'Уровень ' + hp.level + (upgraded ? ' ⬆' : '')), h('span.t', ' 🏆 ' + hp.trophies)),
        upBtn,
        btn(s.selectedHero === heroId ? '✔ Выбран' : 'Выбрать', () => { s.selectedHero = heroId; store.commit(); sfx('tab'); close(); app.toLobby(); }, 'btn-yellow'),
      ]
      : [
        h('div.hd-locked.t', '🔒 Ещё не открыт'),
        h('div.hd-how', h('div.small', 'Как получить:'), ...howToGet(heroId).map((x) => h('div.hd-way', x))),
        h('div.small', 'Попробовать можно на Полигоне — там доступны все герои.'),
      ];
    return h('div.hero-detail' + (upgraded ? '.flash' : ''), { style: { '--hc': d.color } as any },
      h('div.hd-left',
        h('img.hd-img' + (has ? '' : '.dim'), { src: app.portrait(heroId, has && ownsSkin(s, heroId, hp.skin) ? hp.skin : 'default') }),
        h('div.hd-name.t', d.name),
        rarityBadge(d.rarity ?? 'common'),
        ...left,
      ),
      h('div.hd-right',
        h('div.hd-tabs',
          btn('📊 Герой', () => { tab = 'info'; sfx('tab'); refresh(); }, tab === 'info' ? 'btn-yellow' : 'btn-gray', { class: 'btn-xs' }),
          btn(`👕 Скины (${skins.length})`, () => { tab = 'skins'; sfx('tab'); refresh(); }, tab === 'skins' ? 'btn-yellow' : 'btn-gray', { class: 'btn-xs' }),
        ),
        tab === 'info' ? h('div.hd-info',
          h('p.hd-desc', d.description),
          h('div.stats',
            statRow('❤️ Здоровье', prev ? prev.hp : st.hp, prev ? st.hp : undefined),
            statRow('⚔️ ' + d.attackName, prev ? prev.damage : st.damage, prev ? st.damage : undefined),
            statRow('⭐ ' + d.superName, prev ? prev.superDamage : st.superDamage, prev ? st.superDamage : undefined),
            statRow('🔄 Перезарядка', d.stats.reload + ' с'),
          ),
          h('div.abil', h('b', '⚔️ ' + d.attackName + ': '), d.attackDesc),
          h('div.abil', h('b', '⭐ ' + d.superName + ': '), d.superDesc),
          h('div.abil.small', `Каждый уровень: +8% к здоровью и урону. Максимум — ${ECONOMY.maxLevel}.`),
        ) : skinList,
      ),
    );
  };
  const wrap = h('div', render());
  const refresh = (upgraded = false) => {
    wrap.innerHTML = '';
    wrap.appendChild(render(upgraded));
    const list = wrap.querySelector('.skin-list') as HTMLElement | null;
    if (list) enableDragScroll(list);
  };
  close = modal(wrap, { cls: 'wide', onClose: () => app.refresh() });
}
