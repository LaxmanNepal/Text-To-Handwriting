const CACHE = 'tth-pwa-v1';
const APP_SHELL = [
  '/Text-To-Handwriting/',
  '/Text-To-Handwriting/index.html',
  '/Text-To-Handwriting/manifest.webmanifest',
  '/Text-To-Handwriting/icons/icon.svg',
  '/Text-To-Handwriting/pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && (event.request.mode === 'navigate' || url.pathname.startsWith('/Text-To-Handwriting/'))) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/Text-To-Handwriting/')))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
