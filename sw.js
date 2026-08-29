const CACHE = 'tth-pwa-v9';
const APP_SCOPE = '/Text-To-Handwriting/';
const APP_SHELL = [
  `${APP_SCOPE}`,
  `${APP_SCOPE}index.html`,
  `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}mobile-responsive.css`,
  `${APP_SCOPE}studio-v2.js`,
  `${APP_SCOPE}pwa.js`,
  `${APP_SCOPE}offline.js`,
  `${APP_SCOPE}offline-storage.js`,
  `${APP_SCOPE}documents.js`,
  `${APP_SCOPE}page-history.js`,
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
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('tth-pwa-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => cacheResponse(event.request, response))
        .catch(async () => caches.match(event.request) || caches.match(`${APP_SCOPE}index.html`))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => cacheResponse(event.request, response)))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
