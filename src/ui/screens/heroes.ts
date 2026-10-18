// Герои: сетка карточек, подробности, прокачка с анимацией, скины.
import { sfx } from '../../audio/sfx';
import { getHero, playableHeroes } from '../../heroes/registry';
import { skinsOf } from '../../heroes/skins';
import { ECONOMY } from '../../meta/economy';
import { buySkin, heroProgress, heroStatsAt, ownsSkin, upgradeCost, upgradeHero } from '../../meta/progress';
import { store } from '../../meta/store';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, h, modal, toast } from '../dom';
import type { Screen } from './index';

export function heroesScreen(app: App, focus?: string): Screen {
  const s = store.data;
  const grid = h('div.hero-grid');
  for (const d of playableHeroes()) {
    const hp = heroProgress(s, d.id);
    const cost = upgradeCost(hp.level);
    const canUp = cost !== null && s.coins >= cost;
    const card = h('div.hero-card' + (s.selectedHero === d.id ? '.selected' : ''), { onclick: () => heroDetail(app, d.id), style: { '--hc': d.color } as any },
      h('div.hc-top', h('span.lvl-badge', 'Ур. ' + hp.level), h('span.hc-trophies.t', '🏆 ' + hp.trophies)),
      h('img.hc-img', { src: app.portrait(d.id, ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default') }),
      h('div.hc-name.t', d.name),
      h('div.hc-role', d.role),
      canUp ? h('div.hc-up', '⬆ Прокачка!') : null,
      s.selectedHero === d.id ? h('div.hc-sel', '✔ Выбран') : null,
    );
    grid.appendChild(card);
  }
  grid.appendChild(h('div.hero-card.soon', h('div.soon-q', '?'), h('div.hc-name.t', 'Герой №3'), h('div.hc-role', 'Скоро! Автор уже придумывает…')));
  const el = h('div.screen.panel-screen', topBar(app, { title: 'Герои', back: true }), h('div.scroll', grid));
  if (focus) setTimeout(() => heroDetail(app, focus), 50);
  return { el };
}

function statRow(label: string, a: number | string, b?: number | string) {
  return h('div.stat', h('span.st-l', label), h('span.st-v.t', String(a)), b !== undefined ? h('span.st-up.t', '→ ' + b) : null);
}

export function heroDetail(app: App, heroId: string) {
  const s = store.data;
  const d = getHero(heroId);
  let close = () => {};
  const render = (upgraded = false) => {
    const hp = heroProgress(s, heroId);
    const st = heroStatsAt(heroId, hp.level);
    const prev = upgraded ? heroStatsAt(heroId, hp.level - 1) : null;
    const cost = upgradeCost(hp.level);
    const skins = skinsOf(heroId);
    const skinList = h('div.skin-list', ...skins.map((sk) => {
      const owned = ownsSkin(s, heroId, sk.id);
      const active = hp.skin === sk.id || (!ownsSkin(s, heroId, hp.skin) && sk.id === 'default');
      return h('div.skin-card' + (active ? '.active' : '') + (owned ? '' : '.locked'), { style: { '--sc': sk.cardColor } as any },
        h('img', { src: app.portrait(heroId, sk.id) }),
        h('div.sk-name.t', sk.name),
        owned
          ? (active ? h('div.sk-tag', 'Надет') : btn('Надеть', () => { hp.skin = sk.id; store.commit(); sfx('tab'); refresh(); }, 'btn-blue', { class: 'btn-sm' }))
          : sk.exclusive ? h('div.sk-tag.ex', '🎟️ Пропуск') : btn([sk.currency === 'gems' ? '💎' : '✨', String(sk.price)], () => {
            if (buySkin(s, heroId, sk.id)) { hp.skin = sk.id; store.commit(); sfx('buy'); toast('Новый скин: ' + sk.name + '!', 'good'); refresh(); }
            else toast(sk.currency === 'gems' ? 'Не хватает кристаллов' : 'Не хватает блингов', 'bad');
          }, sk.currency === 'gems' ? 'btn-green' : 'btn-purple', { class: 'btn-sm' }),
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
    return h('div.hero-detail' + (upgraded ? '.flash' : ''), { style: { '--hc': d.color } as any },
      h('div.hd-left',
        h('img.hd-img', { src: app.portrait(heroId, ownsSkin(s, heroId, hp.skin) ? hp.skin : 'default') }),
        h('div.hd-name.t', d.name),
        h('div.hd-lvl', h('span.lvl-badge.big', 'Уровень ' + hp.level + (upgraded ? ' ⬆' : '')), h('span.t', ' 🏆 ' + hp.trophies)),
        upBtn,
        btn(s.selectedHero === heroId ? '✔ Выбран' : 'Выбрать', () => { s.selectedHero = heroId; store.commit(); sfx('tab'); close(); app.toLobby(); }, 'btn-yellow'),
      ),
      h('div.hd-right',
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
        h('h3.t', 'Скины'),
        skinList,
      ),
    );
  };
  const wrap = h('div', render());
  const refresh = (upgraded = false) => { wrap.innerHTML = ''; wrap.appendChild(render(upgraded)); };
  close = modal(wrap, { cls: 'wide', onClose: () => app.refresh() });
}
