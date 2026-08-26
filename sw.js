const CACHE = 'tth-pwa-v7';
const APP_SCOPE = '/Text-To-Handwriting/';
const APP_SHELL = [
  `${APP_SCOPE}`, `${APP_SCOPE}index.html`, `${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}mobile-responsive.css`, `${APP_SCOPE}studio-v2.js`, `${APP_SCOPE}pwa.js`,
  `${APP_SCOPE}offline.js`, `${APP_SCOPE}icons/icon.svg`
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tth-pwa-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function save(req, res) { if (res?.ok) { const c = await caches.open(CACHE); await c.put(req, res.clone()); } return res; }
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(APP_SCOPE)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => save(e.request, r)).catch(() => caches.match(e.request).then(r => r || caches.match(`${APP_SCOPE}index.html`))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => save(e.request, x))));
  }
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING' || e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
