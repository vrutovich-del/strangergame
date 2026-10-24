// Друзья: комната создаётся сразу — остаётся сказать код. Или ввести код друга: вход сам после пятого знака.
// До 3 игроков в одной команде, пустые места — роботы. Хост жмёт «ИГРАТЬ», остальным ничего нажимать не надо.
// Безопасность: нет случайного подбора с незнакомцами и нет текстового чата — только код от друга.
import { sfx } from '../../audio/sfx';
import { randomSeed } from '../../core/rng';
import { RARITY } from '../../heroes/rarity';
import { getHero, playableHeroes } from '../../heroes/registry';
import { getSkin, skinsOf } from '../../heroes/skins';
import type { ModeId } from '../../maps/types';
import { MODE_INFO } from '../../modes';
import { buildLineup } from '../../modes/lineup';
import { ClientSource, HostSource } from '../../net/netBattle';
import { MAX_PLAYERS, NET_ERRORS, normalizeCode, Room } from '../../net/room';
import { difficultyFor, heroProgress, ownsHero, ownsSkin } from '../../meta/progress';
import { store } from '../../meta/store';
import { Match } from '../../sim/match';
import type { MatchConfig } from '../../sim/types';
import type { App } from '../app';
import { btn, h, modal, toast } from '../dom';
import { icon } from '../icons';
import type { Screen } from './index';
import { versus } from './matchmaking';
import { enableDragScroll } from './shop';

const R5 = ['13px 10px 14px 11px', '10px 13px 11px 14px', '14px 11px 13px 10px', '11px 14px 10px 13px', '12px 10px 13px 11px'];
const SEAT_R = ['20px 14px 22px 16px', '14px 20px 16px 22px', '18px 22px 14px 20px'];

function meInfo(app: App) {
  const lo = app.selectedLoadout();
  return { nick: store.data.nick || 'Игрок', hero: lo.heroId, skin: lo.skinId, level: lo.level };
}

const roomMode = (): ModeId => (store.data.selectedMode === 'training' ? 'gemgrab' : store.data.selectedMode);

/** Понятная ошибка сети: значок, заголовок, что делать. */
function netError(msg: string) {
  if (msg === NET_ERRORS.notFound) return { glyph: 'ko', t: 'Комната не найдена', d: 'Проверь код у друга — может, он уже закрыл комнату.', retry: 'join' as const };
  if (msg.startsWith('Хост')) return { glyph: 'exit', t: 'Хост вышел', d: 'Комната закрылась. Трофеи за этот бой не отнимаются.', retry: 'lobby' as const };
  if (msg === NET_ERRORS.connect) return { glyph: 'wifi', t: 'Не получилось соединиться', d: 'Подключитесь к одной Wi‑Fi сети и попробуйте ещё раз.', retry: 'again' as const };
  if (msg === NET_ERRORS.broker) return { glyph: 'cloudoff', t: 'Нет связи с сервером комнат', d: 'Проверь интернет и попробуй ещё раз. А пока можно сыграть с роботами.', retry: 'again' as const };
  if (msg === NET_ERRORS.full) return { glyph: 'friends', t: 'Комната заполнена', d: 'В комнате уже 3 игрока. Попроси друга позвать тебя в другую.', retry: 'lobby' as const };
  if (msg === NET_ERRORS.old) return { glyph: 'refresh', t: 'Разные версии игры', d: 'Обновите страницу у всех, кто играет вместе.', retry: 'reload' as const };
  return { glyph: 'ko', t: 'Что-то пошло не так', d: msg, retry: 'again' as const };
}

export function roomScreen(app: App, arg?: { join?: string; back?: boolean }): Screen {
  const el = h('div.screen.room');
  let disposed = false;
  let busy = false;
  const room: Room | null = app.room && app.room.alive ? app.room : null;

  const header = (r: Room | null) => h('div.s-head',
    r ? btn([icon('exit'), r.role === 'host' ? 'Закрыть комнату' : 'Выйти'], () => leave(r), 'paper xs room-leave')
      : btn(icon('back'), () => app.toLobby(), 'sky icon', { 'aria-label': 'Назад' }),
    h('div.s-title.ds.colored', { style: { background: 'var(--sky)' } }, icon('friends'), 'Комната'),
    r ? h('div.room-role.on-sea', icon('info'), r.role === 'host' ? 'Ты хост — меняй режим и жми ИГРАТЬ' : 'Ты гость — режим выбирает хост') : null,
  );

  const leave = (r: Room) => { offs.forEach((f) => f()); offs.length = 0; r.leave(); app.room = null; app.toLobby(); };

  // ── вход по коду ──
  const renderJoin = (state: 'typing' | 'error' | 'joining' = 'typing', typed = '') => {
    el.replaceChildren();
    const input = h('input', { value: typed, maxLength: 5, autocapitalize: 'characters', autocomplete: 'off', spellcheck: false, inputMode: 'text', 'aria-label': 'Код комнаты' }) as HTMLInputElement;
    const cells = h('div.code-cells.join-cells' + (state === 'error' ? '.err' : state === 'joining' ? '.ok' : ''));
    const note = h('div.field-note' + (state === 'error' ? '.bad' : ''));
    const draw = () => {
      const v = input.value;
      cells.querySelectorAll('.code-cell').forEach((c, i) => {
        c.textContent = v[i] ?? '';
        c.className = 'code-cell' + (v[i] ? ' full' : '') + (state === 'typing' && i === v.length ? ' cur' : '');
      });
    };
    for (let i = 0; i < 5; i++) cells.appendChild(h('div.code-cell', { style: { borderRadius: R5[i] } }));
    cells.appendChild(input);
    note.replaceChildren(icon(state === 'error' ? 'close' : state === 'joining' ? 'check' : 'info'),
      state === 'error' ? 'Такой комнаты нет. Проверь код у друга.' : state === 'joining' ? 'Входим в комнату…' : 'Буквы и цифры, как у друга');
    input.addEventListener('input', () => {
      input.value = normalizeCode(input.value);
      if (state !== 'typing') { state = 'typing'; cells.className = 'code-cells join-cells'; note.className = 'field-note'; note.replaceChildren(icon('info'), 'Буквы и цифры, как у друга'); }
      draw();
      if (input.value.length === 5) join(input.value);
    });
    const paste = btn([icon('copy'), 'Вставить'], async () => {
      try { input.value = normalizeCode(await navigator.clipboard.readText()).slice(0, 5); input.dispatchEvent(new Event('input')); }
      catch { input.focus(); toast('Нажми на ячейки и вставь код', 'info'); }
    }, 'paper xs');
    el.append(
      h('div.s-head', btn(icon('back'), () => (app.room?.alive ? renderRoom(app.room) : app.toLobby()), 'sky icon', { 'aria-label': 'Назад' })),
      h('div.join-card', h('div.m-title', 'Введи код друга'), cells, h('div.daily-foot', note, paste)),
      h('div.join-note.on-sea', 'Код из 5 знаков — у друга на экране «Комната». Вход сам после пятого знака.'),
    );
    draw();
    cells.addEventListener('click', () => input.focus());
    // после ошибки код остаётся в ячейках и выделен — новый ввод заменит его
    if (state !== 'joining') setTimeout(() => { input.focus(); if (state === 'error') input.select(); }, 250);
  };

  const renderError = (msg: string) => {
    const e = netError(msg);
    if (e.retry === 'join') { renderJoin('error', lastCode); return; }
    el.replaceChildren(header(null));
    let close = () => {};
    const act = () => {
      close();
      if (e.retry === 'lobby') app.toLobby();
      else if (e.retry === 'reload') location.reload();
      else create();
    };
    close = modal(h('div.col', { style: 'align-items:stretch' },
      h('div.row', { style: 'flex-wrap:nowrap;justify-content:flex-start;gap:16px' }, h('div.m-art', { style: 'transform:rotate(8deg)' }, icon(e.glyph, 'b')),
        h('div.col', { style: 'align-items:flex-start;gap:6px' }, h('div.m-title', e.t), h('div.m-text', e.d))),
      h('div.m-actions',
        e.retry === 'again' ? btn('С роботами', () => { close(); app.toLobby(); }, 'paper sm') : null,
        btn(e.retry === 'lobby' ? 'В лобби' : e.retry === 'reload' ? 'Обновить' : 'Ещё раз', act, (e.retry === 'again' ? 'sky' : 'lime') + ' sm')),
    ), { closable: false });
  };

  const renderWait = (text: string) => {
    el.replaceChildren(header(null), h('div.room-wait', h('div.spinner', icon('friends')), h('div.ds.on-sea', text)));
  };

  const create = async () => {
    if (busy) return;
    busy = true;
    renderWait('Создаём комнату…');
    try {
      const r = await Room.create(meInfo(app), roomMode());
      if (disposed) { r.leave(); return; }
      app.room = r;
      wire(r);
      renderRoom(r);
    } catch (e: any) { if (!disposed) renderError(e?.message || NET_ERRORS.broker); }
    finally { busy = false; }
  };

  let lastCode = '';
  const join = async (code: string) => {
    code = normalizeCode(code);
    if (code.length !== 5) return;
    lastCode = code;
    const cur: Room | null = app.room && app.room.alive ? app.room : null;
    if (cur?.code === code) { renderRoom(cur); return; }
    if (busy) return;
    busy = true;
    renderJoin('joining', code);
    // своя пустая комната больше не нужна
    if (cur) { offs.forEach((f) => f()); offs.length = 0; cur.leave(); app.room = null; }
    try {
      const r = await Room.join(code, meInfo(app));
      if (disposed) { r.leave(); return; }
      app.room = r;
      wire(r);
      sfx('reward');
      renderRoom(r);
    } catch (e: any) { if (!disposed) renderError(e?.message || NET_ERRORS.connect); }
    finally { busy = false; }
  };

  const offs: (() => void)[] = [];
  const wire = (r: Room) => {
    let count = r.players.length;
    offs.push(r.on('roster', () => {
      if (r.role === 'host' && r.players.length > count) { sfx('reward'); toast('Друг в комнате!', 'good', 'friends'); }
      count = r.players.length;
      if (!disposed && !r.inGame) renderRoom(r);
    }));
    offs.push(r.on('closed', (why) => { app.room = null; if (!disposed) renderError(why); }));
    offs.push(r.on('error', (msg) => { if (!disposed) toast(msg, 'bad'); }));
    offs.push(r.on('start', (cfg) => startGame(r, cfg)));
    offs.push(r.on('left', (id) => {
      if (!r.inGame) return;
      const p = r.players.find((x) => x.id === id);
      toast(`${p?.nick ?? 'Друг'} отключился — его заменил робот`, 'info', 'robot');
    }));
  };

  const startGame = (r: Room, cfg: MatchConfig) => {
    app.requestFullscreen();
    const vs = versus(app, cfg, r.myId, () => {
      if (r.role === 'host') {
        const match = new Match(cfg);
        const me = match.fighterOf(r.myId)!;
        app.startBattle(new HostSource(match, me.id, r));
      } else {
        app.startBattle(new ClientSource(r, cfg));
      }
    }, 3000);
    el.replaceChildren(vs.el);
    stopVs = vs.dispose ?? (() => {});
  };
  let stopVs = () => {};

  const renderRoom = (r: Room) => {
    el.replaceChildren();
    const isHost = r.role === 'host';
    const s = store.data;
    const me = r.players.find((p) => p.id === r.myId);
    const alone = r.players.length <= 1;
    // код: 5 ячеек, «Поделиться» и квадратная «Копировать»
    const copyBtn = btn([icon('copy')], async () => {
      try { await navigator.clipboard.writeText(r.code); toast('Код скопирован', 'good', 'copy'); } catch { /* без буфера — просто покажем код */ }
      copyBtn.replaceChildren(icon('check'));
      copyBtn.classList.add('lime');
      sfx('tab');
    }, 'paper xs code-copy');
    copyBtn.setAttribute('aria-label', 'Копировать код');
    copyBtn.title = 'Копировать код';
    const share = async () => {
      const text = `Заходи ко мне в «Игру странностей»! Код комнаты: ${r.code}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Игра странностей', text, url: r.link });
        else { await navigator.clipboard.writeText(r.link); toast('Ссылка-приглашение скопирована!', 'good', 'share'); }
      } catch { /* отменили */ }
    };
    const codeCard = h('div.code-card',
      h('div.label-s', isHost ? 'Код комнаты — скажи его другу' : 'Код комнаты'),
      h('div.code-big', ...r.code.split('').map((ch, i) => h('div', { style: { borderRadius: R5[i], animationDelay: `${i * 60}ms` } }, ch))),
      h('div.row.code-btns', btn([icon('share'), 'Поделиться'], share, 'sky xs'), copyBtn),
    );
    const mi = MODE_INFO[r.mode];
    const modeCard = h('div.mode-card.room-mode' + (isHost ? '' : '.guest'), { style: { '--mc': mi.color } as any, onclick: () => { if (isHost) pickMode(r); else { sfx('tick'); toast('Режим выбирает хост', 'info'); } } },
      icon(mi.icon, 'b'), h('div.mc-text', h('div.mc-name', mi.name), h('div.mc-sub', `${mi.short} · ${isHost ? 'сменить' : 'выбрал хост'}`)), isHost ? icon('chev') : null);
    const seats: HTMLElement[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = r.players[i];
      if (p) {
        const d = getHero(p.hero);
        const mine = p.id === r.myId;
        seats.push(h('div.seat' + (mine ? '.me' : ''), { style: { borderRadius: SEAT_R[i], rotate: ['-1deg', '.8deg', '-.5deg'][i] } },
          h('div.seat-win', { style: { background: `var(--dots), ${d.color}` } },
            h('img', { src: app.portrait(p.hero, p.skin), alt: '' }),
            p.host ? h('div.seat-tag', { style: { background: 'var(--rarity-legend)' } }, icon('r6'), 'Хост') : h('div.seat-tag', { style: { background: 'var(--lime)' } }, icon('check'), 'Готов')),
          h('div.seat-foot', h('div.ds', p.nick), h('span', mine ? (p.host ? 'ты · хост' : 'ты') : `${getSkin(p.hero, p.skin).name} · ур. ${p.level}`))));
      } else {
        seats.push(h('div.seat.empty', { style: { borderRadius: SEAT_R[i] } },
          h('div.seat-win', icon('profile'), h('div', isHost && i === 1 ? 'Ждём друга…' : 'Свободно')),
          h('div.seat-foot', h('div.ds', 'Свободно'), h('span', 'или займёт робот'))));
      }
    }
    const myHero = me?.hero ?? s.selectedHero;
    const mySkin = me?.skin ?? 'default';
    const heroChip = h('button.hero-chip', { onclick: () => { sfx('click'); pickHero(r); } },
      h('div.hc-av', { style: { background: getHero(myHero).color } }, h('img', { src: app.portrait(myHero, mySkin), alt: '' })),
      h('div', h('span', 'Твой герой и скин'), h('b', getSkin(myHero, mySkin).name)), icon('chev'));
    const play = isHost
      ? btn(alone ? 'С РОБОТАМИ' : 'ИГРАТЬ', () => {
        const humans = r.players.map((p) => ({ name: p.nick, heroId: p.hero, skinId: p.skin, level: p.level, owner: p.id }));
        const cfg = buildLineup({ mode: r.mode, humans, difficulty: difficultyFor(s, me?.hero ?? 'smile'), seed: randomSeed() });
        r.start(cfg);
      }, 'yolk play room-play' + (alone ? ' long' : ''))
      : h('div.room-waiting', h('div.wait-dots', h('i'), h('i'), h('i')), h('div.ds', 'Ждём, пока хост начнёт'));
    el.append(
      header(r),
      h('div.room-left',
        codeCard,
        isHost && alone ? btn([icon('friends'), 'У друга есть код'], () => renderJoin(), 'paper xs room-joincode') : null,
        modeCard),
      h('div.room-note.on-sea', icon('emote'), 'Чата нет — в бою только эмоции'),
      h('div.seats', ...seats),
      heroChip,
      play,
    );
  };

  /** Хост выбирает режим (полигон с друзьями не нужен). */
  const pickMode = (r: Room) => {
    let close = () => {};
    close = modal(h('div.col', { style: 'align-items:stretch' }, h('div.m-title', 'Режим для комнаты'),
      h('div.mode-pick', ...(['gemgrab', 'showdown', 'knockout'] as ModeId[]).map((m) => {
        const mi = MODE_INFO[m];
        return h('button.mode-card' + (r.mode === m ? '.on' : ''), { style: { '--mc': mi.color } as any, onclick: () => { r.setMode(m); store.data.selectedMode = m; store.commit(); sfx('tab'); close(); renderRoom(r); } },
          icon(mi.icon, 'b'), h('div.mc-text', h('div.mc-name', mi.name), h('div.mc-sub', mi.short)));
      }))), { cls: 'mode-modal' });
  };

  /** Выбор своего героя и скина (только открытые герои). */
  const pickHero = (r: Room) => {
    const s = store.data;
    let close = () => {};
    const me = r.players.find((p) => p.id === r.myId);
    const heroes = h('div.pick-row.hscroll', ...playableHeroes().map((d, i) => {
      const has = ownsHero(s, d.id);
      const hp = heroProgress(s, d.id);
      return h('div.pick' + (me?.hero === d.id ? '.on' : '') + (has ? '' : '.dim'), {
        style: { '--pc': has ? d.color : '#d6cfbe', borderRadius: R5[i % 5] } as any,
        onclick: () => {
          if (!has) { sfx('tick'); toast('Этот герой ещё закрыт', 'info', 'lock'); return; }
          s.selectedHero = d.id; store.commit(); sfx('tab');
          r.setMe({ hero: d.id, skin: ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default', level: hp.level });
          close(); renderRoom(r);
        },
      }, h('img', { src: app.portrait(d.id), alt: '' }), h('div.pick-n', icon(RARITY[d.rarity ?? 'common'].shape), d.name), has ? null : icon('lock', 'a', 'pick-lock'));
    }));
    const myHero = me?.hero ?? s.selectedHero;
    const skins = skinsOf(myHero).filter((k) => ownsSkin(s, myHero, k.id));
    const skinRow = skins.length > 1 ? h('div.pick-row.hscroll', ...skins.map((k, i) => h('div.pick' + (me?.skin === k.id ? '.on' : ''), {
      style: { '--pc': k.cardColor, borderRadius: R5[i % 5] } as any,
      onclick: () => { heroProgress(s, myHero).skin = k.id; store.commit(); sfx('tab'); r.setMe({ skin: k.id }); close(); renderRoom(r); },
    }, h('img', { src: app.portrait(myHero, k.id), alt: '' }), h('div.pick-n', k.name)))) : null;
    const owned = playableHeroes().filter((d) => ownsHero(s, d.id)).length;
    close = modal(h('div.col', { style: 'align-items:stretch' },
      h('div.row', { style: 'justify-content:flex-start' }, h('div.m-title', 'Выбери героя'), h('div.m-small', `${owned} из ${playableHeroes().length} открыто`)),
      heroes,
      skinRow ? h('div.label-s', 'Скин') : null, skinRow,
    ), { cls: 'wide pick-modal' });
    enableDragScroll(heroes);
    if (skinRow) enableDragScroll(skinRow);
  };

  if (room) {
    wire(room);
    if (arg?.back) room.backToLobby();
    renderRoom(room);
  } else if (arg?.join) {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => join(arg.join!), 50);
    renderJoin('joining', normalizeCode(arg.join));
  } else {
    // комнату создаём сразу — остаётся только сказать код другу
    setTimeout(() => create(), 30);
    renderWait('Создаём комнату…');
  }

  return {
    el,
    dispose() {
      disposed = true;
      offs.forEach((f) => f());
      stopVs();
      // своя пустая комната не нужна, когда ушли с экрана
      const r: Room | null = app.room;
      if (r && r.alive && r.role === 'host' && r.players.length <= 1 && !r.inGame) { r.leave(); app.room = null; }
    },
  };
}
