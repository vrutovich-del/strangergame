// Главные настройки игры. Название игры задаётся только здесь.
export const GAME_NAME = 'Игра странностей';
export const GAME_VERSION = '1.0.0';

/** Префикс ID комнат на публичном брокере PeerJS (чтобы не пересекаться с чужими играми). */
export const PEER_PREFIX = 'igra-strannostey-v1-';

/**
 * Серверы для WebRTC. STUN помогает найти адрес, TURN нужен для строгих NAT мобильных операторов.
 * Чтобы добавить TURN в будущем, впишите сюда объект { urls: 'turn:…', username: '…', credential: '…' }.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
export const TURN_SERVERS: RTCIceServer[] = [];

/** Частота симуляции боя (тиков в секунду). */
export const SIM_HZ = 30;
