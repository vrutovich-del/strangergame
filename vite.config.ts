import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';

/** Генерирует sw.js со списком файлов сборки — игра кэшируется и открывается без интернета. */
function serviceWorker(): Plugin {
  return {
    name: 'igra-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const list = [...new Set([...extra, ...files])];
      const version = createHash('sha1').update(list.join('|') + Date.now()).digest('hex').slice(0, 10);
      const code = `// Сгенерировано при сборке. Кэш игры для работы без интернета.
const CACHE = 'igra-${version}';
const PRECACHE = ${JSON.stringify(list)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('igra-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (url.origin !== location.origin && !fonts) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

// base './' — игра работает из любой подпапки (GitHub Pages: /strangergame/)
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
