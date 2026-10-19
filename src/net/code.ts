// Коды комнат: 5 символов без похожих букв и цифр (нет 0/O и 1/I).
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function randomCode(n = 5) {
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
export function normalizeCode(s: string) {
  return s.toUpperCase().replace(/[^23456789A-HJ-NP-Z]/g, '').slice(0, 5);
}
