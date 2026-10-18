// «Подбор игроков» (3–5 секунд, пустые места занимают роботы) и экран команд «СИНИЕ vs КРАСНЫЕ».
import { sfx } from '../../audio/sfx';
import { getHero } from '../../heroes/registry';
import { getSkin } from '../../heroes/skins';
import { mapById } from '../../maps';
import { MODE_INFO } from '../../modes';
import type { MatchConfig, PlayerSlot } from '../../sim/types';
import type { App } from '../app';
import { btn, h } from '../dom';
import type { Screen } from './index';

export function matchmaking(app: App, cfg: MatchConfig, next: () => void): Screen {
  const total = cfg.players.length;
  const mi = MODE_INFO[cfg.mode];
  const slots = h('div.mm-slots', ...cfg.players.map(() => h('div.mm-slot', h('div.mm-spin'))));
  const counter = h('div.mm-count.t', `1 / ${total}`);
  let cancelled = false;
  const el = h('div.screen.mm',
    h('div.mm-mode.t', mi.icon + ' ' + mi.name),
    h('div.mm-title.t', 'Подбор игроков…'),
    slots, counter,
    btn('Отмена', () => { cancelled = true; app.toLobby(); }, 'btn-red', { class: 'btn-sm mm-cancel' }),
  );
  const timers: number[] = [];
  const duration = 3000 + Math.random() * 2000;
  const order = cfg.players.map((_, i) => i).sort((a, b) => (cfg.players[a].isBot ? 1 : 0) - (cfg.players[b].isBot ? 1 : 0));
  order.forEach((idx, k) => {
    const t = k === 0 ? 150 : (duration * k) / total;
    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      const p = cfg.players[idx];
      const slot = slots.children[k] as HTMLElement;
      slot.innerHTML = '';
      slot.classList.add('filled', p.team === cfg.players[order[0]].team ? 'ally' : 'enemy');
      slot.append(h('img', { src: app.portrait(p.heroId, p.skinId, p.isBot ? (p.team === cfg.players[order[0]].team ? 'blue' : 'red') : 'blue') }), h('div.mm-name.t', p.name));
      counter.textContent = `${k + 1} / ${total}`;
      sfx('tick');
    }, t));
  });
  timers.push(window.setTimeout(() => { if (!cancelled) next(); }, duration + 600));
  return { el, dispose() { timers.forEach(clearTimeout); } };
}

function fighterCard(app: App, p: PlayerSlot, team: 'blue' | 'red', me: boolean) {
  const robot = p.heroId.startsWith('robo_');
  return h('div.vs-card.' + team + (me ? '.me' : ''),
    h('img', { src: app.portrait(p.heroId, p.skinId, robot ? team : 'blue') }),
    h('div.vs-name.t', p.name),
    h('div.vs-hero', robot ? getHero(p.heroId).name : getSkin(p.heroId, p.skinId).name),
    h('span.lvl-badge', 'Ур. ' + p.level),
  );
}

/** Экран команд перед боем. owner — чей это клиент ('local' или ID пира). */
export function versus(app: App, cfg: MatchConfig, owner: string, next: () => void, ms = 2800): Screen {
  const me = cfg.players.find((p) => p.owner === owner) ?? cfg.players[0];
  const myTeam = me.team;
  const mi = MODE_INFO[cfg.mode];
  const map = mapById(cfg.mapId);
  let content: HTMLElement;
  if (cfg.mode === 'showdown') {
    const mine = cfg.players.filter((p) => p.team === myTeam);
    const others = cfg.players.filter((p) => p.team !== myTeam);
    content = h('div.vs-row',
      h('div.vs-team.blue', ...mine.map((p) => fighterCard(app, p, 'blue', p === me))),
      h('div.vs-mid.t', 'VS'),
      h('div.vs-team.red.many', ...others.map((p) => fighterCard(app, p, 'red', false))),
    );
  } else {
    const blue = cfg.players.filter((p) => p.team === myTeam);
    const red = cfg.players.filter((p) => p.team !== myTeam);
    content = h('div.vs-row',
      h('div.vs-team.blue', h('div.vs-label.t', 'СИНИЕ'), ...blue.map((p) => fighterCard(app, p, 'blue', p === me))),
      h('div.vs-mid.t', 'VS'),
      h('div.vs-team.red', h('div.vs-label.t', 'КРАСНЫЕ'), ...red.map((p) => fighterCard(app, p, 'red', false))),
    );
  }
  const el = h('div.screen.vs', h('div.vs-mode.t', `${mi.icon} ${mi.name} · ${map.name}`), content);
  sfx('announce');
  const t = window.setTimeout(next, ms);
  return { el, dispose() { clearTimeout(t); } };
}
