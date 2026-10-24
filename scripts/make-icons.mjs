// Рисует иконки приложения из знака «Странняшка» (src/ui/logo.ts) и сохраняет PNG:
// public/icons — для PWA, resources/icon.png (1024×1024) — для магазинов приложений.
import fs from 'fs';
import { buildSync } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';

const code = buildSync({ entryPoints: ['src/ui/logo.ts'], bundle: true, format: 'esm', platform: 'neutral', write: false }).outputFiles[0].text;
const { appIconSvg } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: '#0f7f86' }).render().asPng();
const icon = appIconSvg(false), mask = appIconSvg(true);
fs.mkdirSync('public/icons', { recursive: true });
fs.mkdirSync('resources', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', png(icon, 192));
fs.writeFileSync('public/icons/icon-512.png', png(icon, 512));
fs.writeFileSync('public/icons/maskable-512.png', png(mask, 512));
fs.writeFileSync('public/icons/apple-touch-icon.png', png(icon, 180));
fs.writeFileSync('resources/icon.png', png(icon, 1024));
console.log('Иконки готовы: public/icons, resources/icon.png');
