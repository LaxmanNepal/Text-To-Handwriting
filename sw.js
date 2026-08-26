const CACHE = 'tth-pwa-v4';
const APP_SCOPE = '/Text-To-Handwriting/';
const APP_SHELL = [
  APP_SCOPE,
  `${APP_SCOPE}index.html`,
  `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}mobile-responsive.css`,
  `${APP_SCOPE}studio-v2.js`,
  `${APP_SCOPE}pwa.js`,
  `${APP_SCOPE}icons/icon.svg`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('tth-pwa-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const cacheResponse = async (request, response) => {
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;

  // Offline-first app shell. A previously installed app must open without network.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then(cached => cached || caches.match(`${APP_SCOPE}index.html`))
        .then(cached => {
          const network = fetch(event.request).then(response => cacheResponse(event.request, response));
          return cached || network;
        })
        .catch(() => caches.match(`${APP_SCOPE}index.html`))
    );
    return;
  }

  // Cache-first for local application resources; network refreshes only when needed.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => cacheResponse(event.request, response));
    }).catch(() => Response.error())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
