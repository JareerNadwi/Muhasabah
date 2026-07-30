// Muhasabah — Service Worker
// Strategy: network-first for the app shell (so you always see your latest
// edits when online), cache-first for everything else (data JSON, fonts,
// icons), with a background refresh so cached data stays reasonably fresh.
// Bump CACHE_VERSION whenever you want to force clients to drop old caches.

const CACHE_VERSION = 'muhasabah-v1';
const APP_SHELL = [
  './Muhasabah.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    // Network-first for the HTML itself: get updates when online,
    // fall back to whatever was last cached when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./Muhasabah.html')))
    );
    return;
  }

  // Cache-first for everything else (JSON data, fonts, icons, PDFs),
  // with a silent background refresh so content doesn't go permanently stale.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
