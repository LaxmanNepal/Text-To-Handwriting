const CACHE = 'tth-pwa-v20';
const APP_SCOPE = '/Text-To-Handwriting/';
const APP_SHELL = [
  APP_SCOPE,
  APP_SCOPE + 'index.html', APP_SCOPE + 'manifest.webmanifest', APP_SCOPE + 'mobile-responsive.css',
  APP_SCOPE + 'studio-v2.js', APP_SCOPE + 'handwriting-engine.js', APP_SCOPE + 'pagination.js',
  APP_SCOPE + 'export-engine.js', APP_SCOPE + 'project-manager.js', APP_SCOPE + 'pwa.js',
  APP_SCOPE + 'offline-storage.js', APP_SCOPE + 'documents.js', APP_SCOPE + 'page-history.js',
  APP_SCOPE + 'icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tth-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function cacheResponse(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function appFallback(request) {
  return (await caches.match(request)) || (await caches.match(request, {ignoreSearch:true})) || caches.match(new Request(APP_SCOPE + 'index.html'));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, {cache:'no-store'}).then(response => cacheResponse(request, response)).catch(() => appFallback(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response))));
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});