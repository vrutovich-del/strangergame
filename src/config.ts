// Главные настройки игры. Название игры задаётся только здесь.
export const GAME_NAME = 'Игра странностей';
export const GAME_VERSION = '1.3.0';

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

/**
 * Аккаунты и облачное сохранение (Firebase, бесплатно). Пока поля пустые, игра работает как раньше —
 * прогресс хранится только на устройстве, а кнопок входа нет. Как заполнить — docs/АККАУНТЫ.md.
 * apiKey не секрет: это адрес проекта, его видно в любой веб-игре на Firebase. Защиту дают правила базы.
 */
export const CLOUD = {
  apiKey: 'AIzaSyBs-x-kgrv1FYaCW0OjwdQVpq8Fe_aQW8w',
  databaseURL: 'https://stranger-game-ee0cd-default-rtdb.europe-west1.firebasedatabase.app',
  /** Хвост «почты» для логинов. Почта не настоящая, её никто не проверяет и не видит. */
  emailDomain: 'players.igra-strannostey.game',
};

/** Частота симуляции боя (тиков в секунду). */
export const SIM_HZ = 30;
