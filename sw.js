const CACHE_NAME = 'iptv-player-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/player.js',
  './js/parser.js',
  './js/nav.js',
  './js/storage.js',
  './js/i18n.js',
  './js/data.js',
  './manifest.json',
  './assets/favicon.ico'
];

// Install : precache les assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate : nettoyer les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : strategies differentes selon le type de ressource
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Ne jamais cacher : flux video/audio/m3u (trop volumineux ou dynamiques)
  if (url.pathname.match(/\.(m3u8?|ts|aac|mp4|webm|ogg|mp3)$/i)) return;
  if (url.hostname.includes('stream') || url.hostname.includes('live')) return;

  // Images de logos : Stale While Revalidate
  if (request.destination === 'image') {
    e.respondWith(
      caches.open('iptv-logos-v1').then(cache =>
        cache.match(request).then(cached => {
          const network = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Assets statiques : Network First avec fallback cache
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
