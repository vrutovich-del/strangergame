// Друзья: создать комнату или войти по коду. До 3 игроков в одной команде, пустые места — роботы.
// Безопасность: нет случайного подбора с незнакомцами и нет текстового чата — только код от друга.
import { sfx } from '../../audio/sfx';
import { randomSeed } from '../../core/rng';
import { getHero, playableHeroes } from '../../heroes/registry';
import { getSkin, skinsOf } from '../../heroes/skins';
import type { ModeId } from '../../maps/types';
import { MODE_INFO } from '../../modes';
import { buildLineup } from '../../modes/lineup';
import { ClientSource, HostSource } from '../../net/netBattle';
import { MAX_PLAYERS, normalizeCode, Room } from '../../net/room';
import { difficultyFor, heroProgress, ownsSkin } from '../../meta/progress';
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

export function roomScreen(app: App, arg?: { join?: string; back?: boolean }): Screen {
  const el = h('div.screen.panel-screen.room');
  let disposed = false;
  const room: Room | null = app.room && app.room.alive ? app.room : null;

  const renderStart = (err = '') => {
    el.innerHTML = '';
    const codeInput = h('input.code-input', { maxLength: 5, placeholder: 'КОД', autocapitalize: 'characters', autocomplete: 'off', spellcheck: false }) as HTMLInputElement;
    codeInput.addEventListener('input', () => { codeInput.value = normalizeCode(codeInput.value); });
    el.append(
      topBar(app, { title: 'Игра с друзьями', back: true }),
      h('div.scroll.room-start',
        h('p.room-info', 'Играйте вместе в одной команде против роботов! Позови до двух друзей.'),
        h('div.room-cards',
          h('div.room-card',
            h('div.rc-big', '🏠'),
            h('div.t', 'Создать комнату'),
            h('div.small', 'Получишь код, который нужно сказать друзьям.'),
            btn('СОЗДАТЬ', () => create(), 'btn-yellow'),
          ),
          h('div.room-card',
            h('div.rc-big', '🔑'),
            h('div.t', 'Войти по коду'),
            codeInput,
            btn('ВОЙТИ', () => join(codeInput.value), 'btn-green'),
          ),
        ),
        err ? h('div.room-error', err) : null,
        h('p.small', 'Чата нет — только эмоции. Играйте с теми, кого знаете.'),
      ),
    );
  };

  const renderWait = (text: string) => {
    el.innerHTML = '';
    el.append(topBar(app, { title: 'Игра с друзьями', back: true }), h('div.room-wait', h('div.mm-spin.big'), h('div.t', text)));
  };

  const create = async () => {
    renderWait('Создаём комнату…');
    try {
      const r = await Room.create(meInfo(app), store.data.selectedMode === 'training' ? 'gemgrab' : store.data.selectedMode);
      if (disposed) { r.leave(); return; }
      app.room = r;
      wire(r);
      renderRoom(r);
    } catch (e: any) { renderStart(e?.message || 'Не получилось создать комнату.'); }
  };

  const join = async (code: string) => {
    code = normalizeCode(code);
    if (code.length !== 5) { toast('Код — это 5 символов', 'bad'); return; }
    renderWait('Подключаемся к комнате ' + code + '…');
    try {
      const r = await Room.join(code, meInfo(app));
      if (disposed) { r.leave(); return; }
      app.room = r;
      wire(r);
      renderRoom(r);
    } catch (e: any) { renderStart(e?.message || 'Не получилось войти.'); }
  };

  const offs: (() => void)[] = [];
  const wire = (r: Room) => {
    offs.push(r.on('roster', () => { if (!disposed && !r.inGame) renderRoom(r); }));
    offs.push(r.on('closed', (why) => { app.room = null; if (!disposed) renderStart(why); }));
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
    const slots: HTMLElement[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = r.players[i];
      slots.push(p
        ? h('div.room-slot' + (p.id === r.myId ? '.me' : ''),
          h('img', { src: app.portrait(p.hero, p.skin) }),
          h('div.t', (p.host ? '👑 ' : '') + p.nick),
          h('div.small', `${getSkin(p.hero, p.skin).name} · ур. ${p.level}`),
          h('div.ready' + (p.ready || p.host ? '.on' : ''), p.host ? 'Хост' : p.ready ? '✔ Готов' : '⏳ Ждём'))
        : h('div.room-slot.empty', h('div.rc-big', '🤖'), h('div.small', 'Здесь будет робот-напарник')));
    }
    // выбор своего героя и скина
    const s = store.data;
    const heroBtns = playableHeroes().map((d) => {
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
    const skinBtns = skinsOf(myHero).filter((k) => ownsSkin(s, myHero, k.id)).map((k) => h('div.pick.small' + (me?.skin === k.id ? '.on' : ''), {
      onclick: () => { heroProgress(s, myHero).skin = k.id; store.commit(); sfx('tab'); r.setMe({ skin: k.id }); if (isHost) renderRoom(r); },
    }, h('img', { src: app.portrait(myHero, k.id) })));
    const modes = (['gemgrab', 'showdown', 'knockout'] as ModeId[]).map((m) => btn(MODE_INFO[m].icon + ' ' + MODE_INFO[m].name, () => { if (isHost) { r.setMode(m); sfx('tab'); } }, r.mode === m ? 'btn-yellow' : 'btn-gray', { class: 'btn-sm' + (isHost ? '' : ' disabled') }));
    const allReady = r.players.every((p) => p.host || p.ready);
    const share = async () => {
      const text = `Заходи ко мне в «Игру странностей»! Код комнаты: ${r.code}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Игра странностей', text, url: r.link });
        else { await navigator.clipboard.writeText(r.link); toast('Ссылка скопирована!', 'good'); }
      } catch { /* отменили */ }
    };
    el.append(
      topBar(app, { title: 'Комната', back: true }),
      h('div.scroll.room-body',
        h('div.room-code-box', h('div.small', 'Код комнаты'), h('div.room-code.t', r.code), btn('📤 Поделиться ссылкой', share, 'btn-blue', { class: 'btn-sm' })),
        h('div.room-slots', ...slots),
        h('div.sec-title.t', 'Твой герой'),
        h('div.row', ...heroBtns, ...skinBtns),
        h('div.sec-title.t', isHost ? 'Режим (выбираешь ты)' : 'Режим (выбирает хост)'),
        h('div.row', ...modes),
        h('div.row.room-actions',
          btn('Выйти', () => { r.leave(); app.room = null; renderStart(); }, 'btn-red'),
          isHost
            ? btn('ИГРАТЬ', () => {
              if (!allReady) { toast('Ждём, пока все нажмут «Готов»', 'bad'); return; }
              const humans = r.players.map((p) => ({ name: p.nick, heroId: p.hero, skinId: p.skin, level: p.level, owner: p.id }));
              const cfg = buildLineup({ mode: r.mode, humans, difficulty: difficultyFor(s, me?.hero ?? 'smile'), seed: randomSeed() });
              r.start(cfg);
            }, allReady ? 'btn-yellow' : 'btn-gray', { class: 'btn-play' + (allReady ? '' : ' disabled') })
            : btn(me?.ready ? '✔ Готов!' : 'Я ГОТОВ', () => { r.setMe({ ready: !me?.ready }); sfx('tab'); }, me?.ready ? 'btn-green' : 'btn-yellow', { class: 'btn-play' }),
        ),
        h('p.small', isHost ? 'Пустые места в команде займут роботы-напарники. Соперники — роботы.' : 'Хост запустит бой, когда все будут готовы.'),
      ),
    );
    void getHero;
  };

  if (room) {
    wire(room);
    if (arg?.back) room.backToLobby();
    renderRoom(room);
  } else if (arg?.join) {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => join(arg.join!), 50);
    renderWait('Подключаемся…');
  } else renderStart();

  return {
    el,
    dispose() {
      disposed = true;
      offs.forEach((f) => f());
      stopVs();
    },
  };
}
