// Результат: заголовок-штамп, звёздный игрок на подиуме, статистика, отсчёт трофеев, монеты и очки пропуска,
// выполненные задания, Метеорчик за победу. Порядок появления — 2,4 с, любой тап ускоряет.
import { sfx } from '../../audio/sfx';
import { getHero } from '../../heroes/registry';
import { ECONOMY, TROPHY_ROAD } from '../../meta/economy';
import { questText, totalTrophies, type BattleRewards } from '../../meta/progress';
import { store } from '../../meta/store';
import type { MatchResult } from '../../sim/types';
import type { BattleSource } from '../battle';
import type { App } from '../app';
import { blobColor } from '../common';
import { btn, countUp, fmtNum, h, lessMotion } from '../dom';
import { icon } from '../icons';
import { dropOverlay } from './drop';
import type { Screen } from './index';

export function resultsScreen(app: App, res: MatchResult, src: BattleSource, r: BattleRewards | null, toLobby: () => void, again: () => void): Screen {
  const s = store.data;
  const w = src.world;
  const me = w.findById(src.localId);
  const star = w.findById(res.starPlayerId);
  const hostLeft = res.reason === 'host_left';
  // вид заголовка
  let title = 'Бой окончен', bg = 'var(--paper)', rays = 0, kind: 'win' | 'lose' | 'draw' = 'draw';
  if (hostLeft) { title = 'Хост вышел'; }
  else if (res.mode === 'showdown') {
    const pl = r?.place ?? 0;
    title = pl === 1 ? 'ПОБЕДА!' : `${pl}-е место`;
    kind = pl <= (src.cfg.teamShowdown ? 1 : 4) ? 'win' : 'lose';
    bg = kind === 'win' ? 'var(--lime)' : 'var(--paper)'; rays = kind === 'win' ? 0.8 : 0;
  } else if (r?.won === true) { title = 'ПОБЕДА!'; bg = 'var(--lime)'; rays = 1; kind = 'win'; }
  else if (r?.won === false) { title = 'Поражение'; kind = 'lose'; }
  else { title = 'Ничья'; bg = 'var(--sky)'; rays = 0.4; }
  sfx(kind === 'win' ? 'win' : kind === 'lose' ? 'lose' : 'announce');

  // звёздный игрок радуется на подиуме (робот — в цвете своей стороны)
  const shown = star && !hostLeft ? star : me;
  if (shown) {
    const team = shown.heroId.startsWith('robo_') ? (shown.team === src.localTeam ? 'blue' : 'red') : 'blue';
    app.showcase.set([{ heroId: shown.heroId, skinId: shown.skinId, team }], shown === me && kind === 'lose' ? 'lose' : 'win');
    app.showcase.yaw = 0; app.showcase.offsetX = 0; app.showcase.fit = shown.heroId.startsWith('robo_') ? 0.74 : 0.82;
    app.showcase.setGround(blobColor(getHero(shown.heroId)?.color ?? '#8d5bff'));
  }
  const stage = h('div.stage.rs-stage');
  app.bindSpin(stage);

  const stat = (glyph: string, v: number, label: string) => h('div.rs-stat', icon(glyph), h('div', h('b.num', fmtNum(v)), h('span', label)));
  const third = res.mode === 'gemgrab' ? stat('shard', me?.stats.gems ?? 0, 'собрал') : res.mode === 'showdown' ? stat('cube', me?.stats.cubes ?? 0, 'кубов') : stat('super', me?.stats.supers ?? 0, 'суперов');
  const stats = h('div.rs-stats', stat('ko', me?.stats.kills ?? 0, 'выбил'), stat('damage', Math.round(me?.stats.damage ?? 0), 'урона'), third);

  // трофеи: отсчёт и полоса до следующей награды Дороги
  const after = totalTrophies(s);
  const before = r ? r.trophiesBefore : after;
  const delta = r?.trophies ?? 0;
  const next = TROPHY_ROAD.find((m) => m.at > after);
  const prevAt = [...TROPHY_ROAD].reverse().find((m) => m.at <= after)?.at ?? 0;
  const NEXT_NAME: Record<string, string> = { coins: 'монет', gems: 'кристаллов', bling: 'блингов', box: 'ящика', skin: 'скина' };
  const nextName = next ? (next.reward.kind === 'hero' ? getHero(next.reward.heroId).name : NEXT_NAME[next.reward.kind] ?? 'награды') : '';
  const line = hostLeft ? 'трофеи не потеряны'
    : res.mode === 'showdown' && r ? `Выживание · из ${src.cfg.players.length} бойцов · ${fmtNum(before)} → ${fmtNum(after)}`
      : delta === 0 ? 'трофеи не изменились'
        : `${fmtNum(before)} → ${fmtNum(after)}` + (next ? ` · до ${nextName} ${fmtNum(next.at - after)}` : '') + (delta < 0 ? ' · в следующий раз!' : '');
  const trNum = h('div.rs-tr-n.num' + (delta > 0 ? '.up' : ''), delta > 0 ? '+0' : delta < 0 ? '−0' : '0');
  const fill = h('i', { style: { '--p': String(next ? (before - prevAt) / Math.max(1, next.at - prevAt) : 1) } as any });
  const trophies = h('div.rs-tr', icon('trophy', 'b'), trNum, h('div.rs-tr-l', h('span', line), h('div.bar.rs-bar', fill)));

  // награды
  const chips: HTMLElement[] = [];
  if (r) {
    chips.push(h('div.rs-chip', icon('coin'), h('span.num', `+${r.coins}`)));
    chips.push(h('div.rs-chip', icon('passpt'), h('span.num', `+${r.xp}`)));
    if (r.bling) chips.push(h('div.rs-chip', icon('bling'), h('span.num', `+${r.bling}`), h('small', 'первая победа дня')));
    if (r.tierAfter > r.tierBefore) chips.push(h('div.rs-chip.gum', icon('ticket'), `Уровень пропуска ${r.tierAfter}!`));
    if (r.drop) chips.push(h('div.rs-chip.meteor.ds', icon('meteor', 'b'), '+1'));
    for (const i of r.questsDone) chips.push(h('div.rs-chip.quest', icon('quests'), `${questText(s.quests.list[i])} — готово`));
  }
  if (star && star.id === me?.id && !hostLeft) chips.push(h('div.rs-chip', icon('star'), h('span.num', `+${ECONOMY.starPlayerCoins}`), h('small', 'звёздный игрок')));
  const panel = h('div.rs-panel', stats, trophies, h('div.rs-chips', ...chips));

  // кнопки: сначала открываем Метеорчики
  const withDrops = (f: () => void) => () => (store.data.drops.length ? dropOverlay(app, f) : f());
  const btns = h('div.rs-btns', btn('В лобби', withDrops(toLobby), 'paper'), btn(src.cfg.mode === 'training' ? 'Ещё раз' : 'Играть снова', withDrops(again), 'yolk lg'));
  const titleEl = h('div.rs-title.ds', { style: { background: bg } }, title);
  const starPlate = shown ? h('div.rs-star', icon('star', 'b'), h('div', h('span', shown === star ? 'Звёздный игрок' : 'Твой герой'), h('b.ds', shown.name))) : null;

  const el = h('div.screen.results.' + kind,
    h('div.rs-rays', { style: { opacity: String(rays) } }),
    titleEl, stage, starPlate, panel, btns,
  );
  // поэтапная подача; тап — всё сразу
  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, lessMotion() ? 0 : ms));
  const showAll = () => el.classList.add('all');
  at(1000, () => {
    countUp(trNum, 0, Math.abs(delta), 900, delta > 0 ? '+' : delta < 0 ? '−' : '');
    fill.style.setProperty('--p', String(next ? (after - prevAt) / Math.max(1, next.at - prevAt) : 1));
    if (delta) sfx('coin');
  });
  at(1600, () => { if (r?.coins) sfx('coin'); });
  at(2200, () => { if (r?.drop) sfx('drop'); });
  at(2400, showAll);
  el.addEventListener('pointerdown', () => { if (!el.classList.contains('all')) { timers.forEach(clearTimeout); showAll(); countUp(trNum, Math.abs(delta), Math.abs(delta), 0, delta > 0 ? '+' : delta < 0 ? '−' : ''); fill.style.setProperty('--p', String(next ? (after - prevAt) / Math.max(1, next.at - prevAt) : 1)); } }, { capture: true });
  if (lessMotion()) el.classList.add('all');

  return {
    el, stage,
    back: [h('div.blob.rs-blob', { style: { '--blob': blobColor(shown ? getHero(shown.heroId)?.color ?? '#8d5bff' : '#8d5bff') } as any }), h('div.podium.rs-podium')],
    dispose() { timers.forEach(clearTimeout); },
  };
}
