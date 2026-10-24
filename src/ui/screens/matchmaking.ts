// «Подбор игроков» (3–5 секунд, места заполняются по одному, пустые займут роботы) и экран «СИНИЕ vs КРАСНЫЕ».
import { sfx } from '../../audio/sfx';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { mapById } from '../../maps';
import { MODE_INFO } from '../../modes';
import type { MatchConfig, PlayerSlot } from '../../sim/types';
import type { App } from '../app';
import { btn, h } from '../dom';
import { icon, sideShape } from '../icons';
import type { Screen } from './index';

const R4 = ['14px 10px 16px 12px', '10px 14px 12px 16px', '16px 12px 14px 10px', '12px 16px 10px 14px'];
const TEAM = [['#5fe05a', 'self'], ['#3f8cff', 'ally'], ['#ff4b55', 'enemy'], ['#ffb21f', 'square']] as const;
const robot = (p: PlayerSlot) => p.heroId.startsWith('robo_');

export function matchmaking(app: App, cfg: MatchConfig, next: () => void): Screen {
  const total = cfg.players.length;
  const mi = MODE_INFO[cfg.mode];
  const sd = cfg.mode === 'showdown';
  const order = cfg.players.map((_, i) => i).sort((a, b) => (cfg.players[a].isBot ? 1 : 0) - (cfg.players[b].isBot ? 1 : 0));
  const myTeam = cfg.players[order[0]].team;
  const slots = h('div.mm-grid' + (sd ? '.sd' : ''), ...cfg.players.map((_, i) => h('div.mm-slot', { style: { borderRadius: R4[i % 4] } }, h('div.mm-q.ds', '?'))));
  const title = h('div.mm-title.ds.on-sea', 'Ищем игроков…');
  const sub = h('div.mm-sub.num', `1 из ${total} · 0:00`);
  let cancelled = false;
  const t0 = performance.now();
  const el = h('div.screen.mm',
    h('div.mm-mode', { style: { background: mi.color } }, icon(mi.icon, 'b'), `${mi.name} · ${sd ? `${total} игроков` : mi.short}`),
    h('div.mm-head', title, sub),
    slots,
    btn('Отмена', () => { cancelled = true; app.toLobby(); }, 'paper mm-cancel'),
  );
  let found = 0;
  const tick = window.setInterval(() => {
    const s = Math.floor((performance.now() - t0) / 1000);
    sub.textContent = found >= total ? 'Начинаем' : `${found} из ${total} · 0:${String(s).padStart(2, '0')}`;
  }, 250);
  const timers: number[] = [];
  const duration = 3000 + Math.random() * 2000;
  order.forEach((idx, k) => {
    const t = k === 0 ? 150 : (duration * k) / total;
    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      const p = cfg.players[idx];
      const slot = slots.children[k] as HTMLElement;
      const ally = p.team === myTeam;
      const col = sd ? '#47d24a' : ally ? '#3f8cff' : '#ff4b55';
      slot.replaceChildren(h('img', { src: app.portrait(p.heroId, p.skinId, robot(p) ? (ally ? 'blue' : 'red') : 'blue'), alt: '' }), h('div.mm-nick', p.name));
      slot.classList.add('filled');
      slot.style.background = `var(--dots), ${col}`;
      slot.style.rotate = ['-1deg', '1deg', '-.5deg', '.8deg'][k % 4];
      found = k + 1;
      if (found >= total) title.textContent = 'Нашли всех!';
      sfx('tick');
    }, t));
  });
  timers.push(window.setTimeout(() => { if (!cancelled) next(); }, duration + 600));
  return { el, dispose() { timers.forEach(clearTimeout); clearInterval(tick); } };
}

/** Экран команд перед боем. owner — чей это клиент ('local' или ID пира). */
export function versus(app: App, cfg: MatchConfig, owner: string, next: () => void, ms = 2800): Screen {
  const me = cfg.players.find((p) => p.owner === owner) ?? cfg.players[0];
  const myTeam = me.team;
  const mi = MODE_INFO[cfg.mode];
  const map = mapById(cfg.mapId);
  const portrait = (p: PlayerSlot, ally: boolean) => app.portrait(p.heroId, p.skinId, robot(p) ? (ally ? 'blue' : 'red') : 'blue');
  let el: HTMLElement;
  if (cfg.mode === 'showdown') {
    // каждый сам за себя: 10 бойцов; с друзьями — команды по 3
    const groups = cfg.teamShowdown
      ? [...new Set(cfg.players.map((p) => p.team))].sort((a, b) => (a === myTeam ? -1 : b === myTeam ? 1 : a - b)).map((t) => cfg.players.filter((p) => p.team === t))
      : null;
    const card = (p: PlayerSlot, i: number, color: string, shape: 'self' | 'ally' | 'enemy' | 'square') => h('div.vs-sd' + (p === me ? '.me' : ''), { style: { background: `var(--dots), ${color}`, borderRadius: R4[i % 4] } },
      h('img', { src: portrait(p, p.team === myTeam), alt: '' }),
      h('div.vs-sd-n', sideShape(shape, color), p === me ? 'Ты' : p.name));
    const grid = groups
      ? h('div.vs-sd-grid.teams', { style: { gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` } }, ...groups.map((g, t) => {
        const [c, sh] = TEAM[Math.min(t, 3)];
        return h('div.vs-sd-team', { style: { borderColor: c } }, ...g.map((p, i) => card(p, i, c, sh)));
      }))
      : h('div.vs-sd-grid', ...cfg.players.map((p, i) => card(p, i, p === me ? '#5fe05a' : '#ff4b55', p === me ? 'self' : 'enemy')));
    el = h('div.screen.vs.vs-showdown',
      h('div.vs-sd-title.ds', icon('showdown', 'b'), cfg.teamShowdown ? `Выживание · ${groups!.length} команды по 3` : 'Выживание · каждый сам за себя'),
      grid,
      h('div.vs-map', icon('poison'), `${map.name} · облако сжимается через 30 с`),
    );
  } else {
    const blue = cfg.players.filter((p) => p.team === myTeam);
    const red = cfg.players.filter((p) => p.team !== myTeam);
    const team = (list: PlayerSlot[], side: 'blue' | 'red') => h('div.vs-team.' + side,
      h('div.vs-name.ds', sideShape(side === 'blue' ? 'ally' : 'enemy', side === 'blue' ? '#3f8cff' : '#ff4b55'), side === 'blue' ? 'СИНИЕ' : 'КРАСНЫЕ'),
      h('div.vs-heroes', ...list.map((p) => h('div.vs-hero',
        h('img', { src: portrait(p, side === 'blue'), alt: '' }),
        h('div.vs-nick' + (p === me ? '.me' : ''), p.name),
        h('div.vs-sub.on-sea', robot(p) ? getHero(p.heroId).name : `${getSkin(p.heroId, p.skinId).name} · ур. ${p.level}`)))));
    el = h('div.screen.vs.vs-3',
      h('div.vs-bg.blue'), h('div.vs-bg.red'), h('div.vs-split'),
      team(blue, 'blue'), team(red, 'red'),
      h('div.vs-mark.ds', 'VS'),
      h('div.vs-map', icon(mi.icon, 'b'), `${mi.name} · ${map.name}`),
    );
  }
  sfx('announce');
  const t = window.setTimeout(next, ms);
  return { el, dispose() { clearTimeout(t); } };
}
