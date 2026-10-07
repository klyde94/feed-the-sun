/* Feed the Sun : fonctionnement hors connexion. Les fichiers du jeu sont gardés en cache, la version en ligne reste prioritaire. */
const CACHE = 'feedthesun-v3-1';
const FILES = ['./', 'index.html', 'style.css', 'data.js', 'i18n.js', 'world.js', 'render.js', 'orbit.js', 'panels.js', 'ui.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
