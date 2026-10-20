// Комнаты по коду через PeerJS (WebRTC, публичный брокер — свой сервер не нужен).
// Хост держит комнату и ведёт симуляцию боя, друзья подключаются по коду из 5 символов.
import Peer, { type DataConnection } from 'peerjs';
import { ICE_SERVERS, PEER_PREFIX, TURN_SERVERS } from '../config';
import { Emitter } from '../core/events';
import type { ModeId } from '../maps/types';
import type { MatchConfig } from '../sim/types';
import { PROTOCOL_VERSION, type NetMsg, type RoomPlayer } from './protocol';

import { randomCode } from './code';
export { CODE_ALPHABET, normalizeCode, randomCode } from './code';

export const MAX_PLAYERS = 3;

export const NET_ERRORS = {
  connect: 'Не получилось соединиться. Попробуйте подключиться к одной Wi‑Fi сети.',
  notFound: 'Комната не найдена. Проверь код — может, друг уже вышел?',
  full: 'В комнате уже 3 игрока.',
  broker: 'Нет связи с сервером комнат. Проверь интернет и попробуй ещё раз.',
  old: 'У друга другая версия игры. Обновите страницу у всех.',
};

interface RoomEvents {
  roster: RoomPlayer[];
  start: MatchConfig;
  msg: { from: string; msg: NetMsg };
  left: string;
  error: string;
  closed: string;
}

export interface MeInfo { nick: string; hero: string; skin: string; level: number }

export class Room extends Emitter<RoomEvents> {
  role: 'host' | 'client';
  code = '';
  peer: Peer | null = null;
  myId = '';
  players: RoomPlayer[] = [];
  mode: ModeId = 'gemgrab';
  alive = true;
  inGame = false;
  private conns = new Map<string, DataConnection>();
  private hostConn: DataConnection | null = null;

  private constructor(role: 'host' | 'client', private me: MeInfo) {
    super();
    this.role = role;
  }

  private static makePeer(id?: string): Peer {
    const opts = { debug: 0, config: { iceServers: [...ICE_SERVERS, ...TURN_SERVERS] } } as any;
    return id ? new Peer(id, opts) : new Peer(opts);
  }

  /** Создать комнату. */
  static async create(me: MeInfo, mode: ModeId): Promise<Room> {
    const room = new Room('host', me);
    room.mode = mode;
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = randomCode();
      try {
        const peer = await room.openPeer(PEER_PREFIX + code);
        room.peer = peer;
        room.code = code;
        room.myId = peer.id;
        break;
      } catch (e: any) {
        if (e?.type !== 'unavailable-id') throw new Error(NET_ERRORS.broker);
      }
    }
    if (!room.peer) throw new Error(NET_ERRORS.broker);
    room.players = [{ id: room.myId, nick: me.nick, hero: me.hero, skin: me.skin, level: me.level, ready: true, host: true }];
    room.peer.on('connection', (c) => room.acceptClient(c));
    room.peer.on('disconnected', () => room.peer?.reconnect());
    return room;
  }

  /** Войти в комнату по коду. */
  static async join(code: string, me: MeInfo): Promise<Room> {
    const room = new Room('client', me);
    room.code = code;
    room.peer = await room.openPeer();
    room.myId = room.peer.id;
    await room.connectToHost();
    return room;
  }

  private openPeer(id?: string): Promise<Peer> {
    return new Promise((res, rej) => {
      const p = Room.makePeer(id);
      const t = setTimeout(() => { p.destroy(); rej(new Error(NET_ERRORS.broker)); }, 12000);
      p.on('open', () => { clearTimeout(t); res(p); });
      p.on('error', (e: any) => {
        clearTimeout(t);
        if (!this.peer) { p.destroy(); rej(e); return; }
        if (e?.type === 'peer-unavailable') this.emit('error', NET_ERRORS.notFound);
        else if (e?.type === 'network' || e?.type === 'server-error' || e?.type === 'socket-error') this.emit('error', NET_ERRORS.broker);
      });
    });
  }

  private connectToHost(): Promise<void> {
    return new Promise((res, rej) => {
      const c = this.peer!.connect(PEER_PREFIX + this.code, { reliable: true, serialization: 'json' });
      let done = false;
      const fail = (msg: string) => { if (done) return; done = true; clearTimeout(t); try { c.close(); } catch { /* уже закрыто */ } rej(new Error(msg)); };
      const t = setTimeout(() => fail(NET_ERRORS.connect), 15000);
      this.peer!.on('error', (e: any) => {
        if (e?.type === 'peer-unavailable') fail(NET_ERRORS.notFound);
      });
      c.on('open', () => {
        this.hostConn = c;
        c.send({ t: 'hello', v: PROTOCOL_VERSION, nick: this.me.nick, hero: this.me.hero, skin: this.me.skin, level: this.me.level });
      });
      c.on('data', (d: any) => {
        const msg = d as NetMsg;
        if (!done) {
          if (msg.t === 'full') { fail(NET_ERRORS.full); return; }
          if (msg.t === 'old') { fail(NET_ERRORS.old); return; }
          if (msg.t === 'roster') { done = true; clearTimeout(t); res(); }
        }
        this.onClientMsg(msg);
      });
      c.on('close', () => {
        if (!done) { fail(NET_ERRORS.connect); return; }
        this.alive = false;
        this.emit('closed', 'Хост закрыл комнату.');
      });
      c.on('error', () => fail(NET_ERRORS.connect));
      // ICE не прошёл (строгий NAT) — понятное сообщение
      c.on('iceStateChanged' as any, (st: string) => { if (st === 'failed' || st === 'disconnected') { if (!done) fail(NET_ERRORS.connect); } });
    });
  }

  private onClientMsg(msg: NetMsg) {
    if (msg.t === 'roster') { this.players = msg.players; this.mode = msg.mode; this.emit('roster', msg.players); }
    else if (msg.t === 'start') { this.inGame = true; this.emit('start', msg.cfg); }
    else this.emit('msg', { from: 'host', msg });
  }

  private acceptClient(c: DataConnection) {
    c.on('data', (d: any) => {
      const msg = d as NetMsg;
      if (msg.t === 'hello') {
        if (msg.v !== PROTOCOL_VERSION) { c.send({ t: 'old' }); setTimeout(() => c.close(), 300); return; }
        if (this.players.length >= MAX_PLAYERS || this.inGame) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
        this.conns.set(c.peer, c);
        this.players.push({ id: c.peer, nick: String(msg.nick).slice(0, 14), hero: msg.hero, skin: msg.skin, level: Math.max(1, Math.min(9, msg.level | 0)), ready: true, host: false });
        this.broadcastRoster();
        return;
      }
      if (msg.t === 'me') {
        const p = this.players.find((x) => x.id === c.peer);
        if (p) { p.hero = msg.hero; p.skin = msg.skin; p.level = Math.max(1, Math.min(9, msg.level | 0)); p.ready = !!msg.ready; this.broadcastRoster(); }
        return;
      }
      this.emit('msg', { from: c.peer, msg });
    });
    c.on('close', () => this.dropClient(c.peer));
    c.on('error', () => this.dropClient(c.peer));
    c.on('iceStateChanged' as any, (st: string) => { if (st === 'failed' || st === 'closed') this.dropClient(c.peer); });
  }

  private dropClient(id: string) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.players = this.players.filter((p) => p.id !== id);
    this.broadcastRoster();
    this.emit('left', id);
  }

  broadcastRoster() {
    const msg: NetMsg = { t: 'roster', players: this.players, mode: this.mode };
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    this.emit('roster', this.players);
  }

  /** Поменять своего героя/скин/готовность. */
  setMe(me: Partial<MeInfo> & { ready?: boolean }) {
    Object.assign(this.me, me);
    if (this.role === 'host') {
      const p = this.players.find((x) => x.host);
      if (p) { Object.assign(p, { hero: this.me.hero, skin: this.me.skin, level: this.me.level }); this.broadcastRoster(); }
    } else {
      const p = this.players.find((x) => x.id === this.myId);
      this.hostConn?.send({ t: 'me', hero: this.me.hero, skin: this.me.skin, level: this.me.level, ready: me.ready ?? p?.ready ?? false });
    }
  }

  setMode(mode: ModeId) {
    this.mode = mode;
    if (this.role === 'host') this.broadcastRoster();
  }

  /** Хост запускает бой. */
  start(cfg: MatchConfig) {
    this.inGame = true;
    for (const c of this.conns.values()) if (c.open) c.send({ t: 'start', cfg });
    this.emit('start', cfg);
  }

  /** Отправить хосту (клиент) или всем (хост). */
  send(msg: NetMsg, to?: string) {
    if (this.role === 'client') { if (this.hostConn?.open) this.hostConn.send(msg); return; }
    if (to) { const c = this.conns.get(to); if (c?.open) c.send(msg); return; }
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  get clientIds() { return [...this.conns.keys()]; }

  backToLobby() {
    this.inGame = false;
    if (this.role === 'host') this.broadcastRoster();
  }

  leave() {
    this.alive = false;
    for (const c of this.conns.values()) c.close();
    this.hostConn?.close();
    this.peer?.destroy();
    this.peer = null;
  }

  /** Ссылка-приглашение. */
  get link() {
    const base = location.href.split('#')[0].split('?')[0];
    return `${base}#room=${this.code}`;
  }
}
