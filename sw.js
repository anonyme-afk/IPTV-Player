// ── IPTV Player - Service Worker v1 ──
const CACHE_NAME = 'iptv-player-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/parser.js',
    '/js/player.js',
    '/js/nav.js',
    '/js/i18n.js',
    '/js/storage.js',
    '/assets/favicon.ico',
    'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js',
    'https://unpkg.com/lucide@latest',
];

// Install: cache les assets critiques
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: nettoie les vieux caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: stratégie network-first puis cache
self.addEventListener('fetch', event => {
    // Ne pas intercepter les requêtes vers des APIs externes (fetch proxies)
    const url = new URL(event.request.url);
    if (url.hostname !== self.location.hostname && url.hostname !== 'cdnjs.cloudflare.com' && url.hostname !== 'unpkg.com') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Mettre en cache les réponses valides
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
