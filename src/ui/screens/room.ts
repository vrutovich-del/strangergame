// Друзья: комната создаётся сразу — остаётся сказать код. Или ввести код друга: вход сам, без лишних кнопок.
// До 3 игроков в одной команде, пустые места — роботы. Хост жмёт «ИГРАТЬ», остальным ничего нажимать не надо.
// Безопасность: нет случайного подбора с незнакомцами и нет текстового чата — только код от друга.
import { sfx } from '../../audio/sfx';
import { randomSeed } from '../../core/rng';
import { playableHeroes } from '../../heroes/registry';
import { getSkin, skinsOf } from '../../heroes/skins';
import type { ModeId } from '../../maps/types';
import { MODE_INFO } from '../../modes';
import { buildLineup } from '../../modes/lineup';
import { ClientSource, HostSource } from '../../net/netBattle';
import { MAX_PLAYERS, normalizeCode, Room } from '../../net/room';
import { difficultyFor, heroProgress, ownsHero, ownsSkin } from '../../meta/progress';
import { store } from '../../meta/store';
import { Match } from '../../sim/match';
import type { MatchConfig } from '../../sim/types';
import type { App } from '../app';
import { topBar } from '../common';
import { btn, h, toast } from '../dom';
import type { Screen } from './index';
import { versus } from './matchmaking';

function meInfo(app: App) {
  const lo = app.selectedLoadout();
  return { nick: store.data.nick || 'Игрок', hero: lo.heroId, skin: lo.skinId, level: lo.level };
}

const roomMode = (): ModeId => (store.data.selectedMode === 'training' ? 'gemgrab' : store.data.selectedMode);

export function roomScreen(app: App, arg?: { join?: string; back?: boolean }): Screen {
  const el = h('div.screen.panel-screen.room');
  let disposed = false;
  let busy = false;
  const room: Room | null = app.room && app.room.alive ? app.room : null;

  /** Поле «код друга»: как только набраны 5 символов — сразу входим. */
  const codeField = () => {
    const input = h('input.code-input', { maxLength: 5, placeholder: 'КОД', autocapitalize: 'characters', autocomplete: 'off', spellcheck: false, inputMode: 'text' }) as HTMLInputElement;
    input.addEventListener('input', () => {
      input.value = normalizeCode(input.value);
      if (input.value.length === 5) join(input.value);
    });
    return h('div.join-box', h('div.t', '🔑 Или введи код друга:'), input);
  };

  const renderError = (err: string) => {
    el.innerHTML = '';
    el.append(
      topBar(app, { title: 'Игра с друзьями', back: true }),
      h('div.scroll.room-start',
        h('div.room-error', err),
        h('div.room-cards',
          h('div.room-card', h('div.rc-big', '🏠'), h('div.t', 'Своя комната'), btn('СОЗДАТЬ', () => create(), 'btn-yellow')),
          h('div.room-card', codeField()),
        ),
      ),
    );
  };

  const renderWait = (text: string) => {
    el.innerHTML = '';
    el.append(topBar(app, { title: 'Игра с друзьями', back: true }), h('div.room-wait', h('div.mm-spin.big'), h('div.t', text)));
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
    } catch (e: any) { if (!disposed) renderError(e?.message || 'Не получилось создать комнату.'); }
    finally { busy = false; }
  };

  const join = async (code: string) => {
    code = normalizeCode(code);
    if (code.length !== 5) { toast('Код — это 5 символов', 'bad'); return; }
    const cur: Room | null = app.room && app.room.alive ? app.room : null;
    if (cur?.code === code) return;
    if (busy) return;
    busy = true;
    // своя пустая комната больше не нужна
    if (cur) { offs.forEach((f) => f()); offs.length = 0; cur.leave(); app.room = null; }
    renderWait('Заходим в комнату ' + code + '…');
    try {
      const r = await Room.join(code, meInfo(app));
      if (disposed) { r.leave(); return; }
      app.room = r;
      wire(r);
      sfx('reward');
      renderRoom(r);
    } catch (e: any) { if (!disposed) renderError(e?.message || 'Не получилось войти.'); }
    finally { busy = false; }
  };

  const offs: (() => void)[] = [];
  const wire = (r: Room) => {
    let count = r.players.length;
    offs.push(r.on('roster', () => {
      if (r.role === 'host' && r.players.length > count) { sfx('reward'); toast('Друг в комнате!', 'good'); }
      count = r.players.length;
      if (!disposed && !r.inGame) renderRoom(r);
    }));
    offs.push(r.on('closed', (why) => { app.room = null; if (!disposed) renderError(why); }));
    offs.push(r.on('error', (msg) => { if (!disposed) toast(msg, 'bad'); }));
    offs.push(r.on('start', (cfg) => startGame(r, cfg)));
  };

  const startGame = (r: Room, cfg: MatchConfig) => {
    app.requestFullscreen();
    app.showcaseOn = false;
    const vs = versus(app, cfg, r.myId, () => {
      if (r.role === 'host') {
        const match = new Match(cfg);
        const me = match.fighterOf(r.myId)!;
        app.startBattle(new HostSource(match, me.id, r));
      } else {
        app.startBattle(new ClientSource(r, cfg));
      }
    }, 3000);
    el.innerHTML = '';
    el.appendChild(vs.el);
    stopVs = vs.dispose ?? (() => {});
  };
  let stopVs = () => {};

  const renderRoom = (r: Room) => {
    el.innerHTML = '';
    const isHost = r.role === 'host';
    const me = r.players.find((p) => p.id === r.myId);
    const host = r.players.find((p) => p.host);
    const alone = r.players.length <= 1;
    const slots: HTMLElement[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = r.players[i];
      slots.push(p
        ? h('div.room-slot' + (p.id === r.myId ? '.me' : ''),
          h('img', { src: app.portrait(p.hero, p.skin) }),
          h('div.t', (p.host ? '👑 ' : '') + p.nick),
          h('div.small', `${getSkin(p.hero, p.skin).name} · ур. ${p.level}`))
        : h('div.room-slot.empty', h('div.rc-big', '🤖'), h('div.small', isHost && i === 1 ? 'Скажи другу код — он появится здесь' : 'Здесь будет робот-напарник')));
    }
    // выбор своего героя и скина (только открытые герои)
    const s = store.data;
    const heroBtns = playableHeroes().filter((d) => ownsHero(s, d.id)).map((d) => {
      const hp = heroProgress(s, d.id);
      return h('div.pick' + (me?.hero === d.id ? '.on' : ''), {
        onclick: () => {
          s.selectedHero = d.id; store.commit(); sfx('tab');
          r.setMe({ hero: d.id, skin: ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default', level: hp.level });
          if (isHost) renderRoom(r);
        },
      }, h('img', { src: app.portrait(d.id, ownsSkin(s, d.id, hp.skin) ? hp.skin : 'default') }), h('div.t', d.name));
    });
    const myHero = me?.hero ?? s.selectedHero;
    const mySkins = skinsOf(myHero).filter((k) => ownsSkin(s, myHero, k.id));
    const skinBtns = mySkins.length > 1 ? mySkins.map((k) => h('div.pick.small' + (me?.skin === k.id ? '.on' : ''), {
      onclick: () => { heroProgress(s, myHero).skin = k.id; store.commit(); sfx('tab'); r.setMe({ skin: k.id }); if (isHost) renderRoom(r); },
    }, h('img', { src: app.portrait(myHero, k.id) }))) : [];
    const modes = (['gemgrab', 'showdown', 'knockout'] as ModeId[]).map((m) => isHost
      ? btn(MODE_INFO[m].icon + ' ' + MODE_INFO[m].name, () => { r.setMode(m); s.selectedMode = m; store.commit(); sfx('tab'); }, r.mode === m ? 'btn-yellow' : 'btn-gray', { class: 'btn-sm' })
      : h('div.mode-chip.t' + (r.mode === m ? '.on' : ''), MODE_INFO[m].icon + ' ' + MODE_INFO[m].name));
    const share = async () => {
      const text = `Заходи ко мне в «Игру странностей»! Код комнаты: ${r.code}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Игра странностей', text, url: r.link });
        else { await navigator.clipboard.writeText(r.link); toast('Ссылка скопирована!', 'good'); }
      } catch { /* отменили */ }
    };
    const play = isHost
      ? btn(alone ? 'ИГРАТЬ С РОБОТАМИ' : 'ИГРАТЬ!', () => {
        const humans = r.players.map((p) => ({ name: p.nick, heroId: p.hero, skinId: p.skin, level: p.level, owner: p.id }));
        const cfg = buildLineup({ mode: r.mode, humans, difficulty: difficultyFor(s, me?.hero ?? 'smile'), seed: randomSeed() });
        r.start(cfg);
      }, 'btn-yellow', { class: 'btn-play' + (alone ? ' small-play' : '') })
      : h('div.room-waiting.t', h('div.mm-spin'), `Ждём, когда ${host?.nick ?? 'хост'} нажмёт «Играть»`);
    el.append(
      topBar(app, { title: isHost ? 'Твоя комната' : 'Комната друга', back: true }),
      h('div.scroll.room-body',
        h('div.room-top',
          h('div.room-code-box',
            h('div.col', h('div.small', isHost ? 'Скажи друзьям код:' : 'Код комнаты'), h('div.room-code.t', r.code)),
            isHost ? btn('📤 Позвать', share, 'btn-blue', { class: 'btn-sm' }) : null,
          ),
          isHost && alone ? codeField() : null,
        ),
        h('div.room-slots', ...slots),
        h('div.row.room-actions', play),
        h('div.sec-title.t', 'Твой герой'),
        h('div.row', ...heroBtns, ...skinBtns),
        h('div.sec-title.t', isHost ? 'Режим' : 'Режим (выбирает хост)'),
        h('div.row', ...modes),
        h('div.row', btn(isHost ? 'Закрыть комнату' : 'Выйти из комнаты', () => { offs.forEach((f) => f()); offs.length = 0; r.leave(); app.room = null; app.toLobby(); }, 'btn-red', { class: 'btn-sm' })),
        h('p.small', 'Пустые места в команде займут роботы-напарники. Соперники — роботы. Чата нет — только эмоции.'),
      ),
    );
  };

  if (room) {
    wire(room);
    if (arg?.back) room.backToLobby();
    renderRoom(room);
  } else if (arg?.join) {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => join(arg.join!), 50);
    renderWait('Заходим в комнату…');
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
