/**
 * Service worker: кэш оболочки и статики + оффлайн-показ последнего меню.
 *
 * Стратегии:
 *  - статика оболочки (HTML/CSS/JS/иконки): cache-first;
 *  - GET к API: network-first с откатом в кэш (оффлайн видно последнее меню);
 *  - остальные запросы (POST/PATCH/DELETE): только сеть.
 */
const SHELL_CACHE = 'nutri-shell-v13';
const API_CACHE = 'nutri-api-v13';

const SHELL_ASSETS = [
  '/app/',
  '/app/index.html',
  '/app/styles.css',
  '/app/app.js',
  '/app/manifest.json',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return; // мутации только по сети
  }

  // API: network-first, откат в кэш.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Оболочка/статика: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
      const copy = resp.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      return resp;
    }).catch(() => caches.match('/app/index.html')))
  );
});
