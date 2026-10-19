// QR-код ссылки на игру (для README): node scripts/make-qr.mjs
import QRCode from 'qrcode';
const url = process.argv[2] ?? 'https://vrutovich-del.github.io/strangergame/';
await QRCode.toFile('docs/qr.png', url, { width: 360, margin: 2, color: { dark: '#2b1a5e', light: '#ffffff' } });
console.log('QR готов:', url);
