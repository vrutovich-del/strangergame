// Общие элементы меню: верхняя панель с валютами, заголовок экрана, карточки наград.
import { GAME_NAME } from '../config';
import { rewardLabel, totalTrophies } from '../meta/progress';
import type { Reward } from '../meta/economy';
import { store } from '../meta/store';
import { btn, h } from './dom';

export interface Nav {
  open(screen: string, arg?: any): void;
  back(): void;
  portrait(heroId: string, skinId?: string, team?: 'blue' | 'red' | 'orange'): string;
}

/** Валюта с кнопкой «+» (ведёт в магазин). */
function currency(icon: string, value: number, cls: string, onPlus: () => void) {
  return h('div.cur.' + cls, h('span.cur-ico', icon), h('span.cur-val', String(value)), btn('+', onPlus, 'btn-green', { class: 'cur-plus' }));
}

export function topBar(nav: Nav, opts: { title?: string; back?: boolean } = {}) {
  const s = store.data;
  const bar = h('div.topbar');
  const left = h('div.tb-left');
  if (opts.back) left.appendChild(btn('◀', () => nav.back(), 'btn-icon', { class: 'tb-back' }));
  if (opts.title) left.appendChild(h('div.tb-title.t', opts.title));
  else {
    left.appendChild(h('div.profile-chip', { onclick: () => nav.open('profile') },
      h('div.avatar', s.avatar.startsWith('hero:') ? h('img', { src: nav.portrait(s.avatar.slice(5)) }) : s.avatar),
      h('div.pc-text', h('div.pc-nick.t', s.nick || 'Игрок'), h('div.pc-trophies.t', '🏆 ' + totalTrophies(s))),
    ));
  }
  const right = h('div.tb-right',
    currency('🪙', s.coins, 'coins', () => nav.open('shop', 'gems')),
    currency('💎', s.gems, 'gems', () => nav.open('shop', 'gems')),
    currency('✨', s.bling, 'bling', () => nav.open('shop', 'emotes')),
  );
  bar.append(left, right);
  return bar;
}

export function rewardCard(r: Reward, extra = '') {
  const l = rewardLabel(r);
  return h('div.reward-card.' + r.kind + (extra ? '.' + extra : ''), h('div.rc-icon', l.icon), h('div.rc-text.t', l.text));
}

export const gameTitle = () => GAME_NAME;
