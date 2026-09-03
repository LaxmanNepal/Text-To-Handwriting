const CACHE = 'tth-pwa-v13';
const APP_SCOPE = '/Text-To-Handwriting/';
const APP_SHELL = [
  `${APP_SCOPE}`,`${APP_SCOPE}index.html`,`${APP_SCOPE}manifest.webmanifest`,
  `${APP_SCOPE}mobile-responsive.css`,`${APP_SCOPE}studio-v2.js`,
  `${APP_SCOPE}handwriting-engine.js`,`${APP_SCOPE}pagination.js`,`${APP_SCOPE}pwa.js`,
  `${APP_SCOPE}offline-storage.js`,`${APP_SCOPE}documents.js`,`${APP_SCOPE}page-history.js`,`${APP_SCOPE}icons/icon.svg`
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tth-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function cacheResponse(request,response){if(response?.ok&&response.type==='basic'){const c=await caches.open(CACHE);await c.put(request,response.clone())}return response}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith(APP_SCOPE))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(r=>cacheResponse(event.request,r)).catch(()=>caches.match(event.request).then(x=>x||caches.match(`${APP_SCOPE}index.html`))));return}event.respondWith(caches.match(event.request).then(c=>c||fetch(event.request).then(r=>cacheResponse(event.request,r))))});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING'||event.data?.type==='SKIP_WAITING')self.skipWaiting()});
