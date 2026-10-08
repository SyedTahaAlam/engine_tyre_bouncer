const CACHE = 'etb-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.svg', 'src/main.js', 'src/util.js', 'src/meter.js', 'src/levels.js', 'src/upgrades.js', 'src/engine.js', 'src/workers.js', 'src/scoring.js', 'src/session.js', 'src/save.js', 'src/particles.js', 'src/audio.js', 'src/render.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); });
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
