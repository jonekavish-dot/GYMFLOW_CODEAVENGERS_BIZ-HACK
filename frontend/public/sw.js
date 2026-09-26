/* GymFlow service worker.
 *
 * Deliberately narrow: this app's value is live data, so the worker never touches /api.
 * It keeps the static shell so the app opens instantly and installs cleanly, serving it
 * network-first so a new deploy is picked up on the next load rather than a later visit.
 * Bump CACHE if the caching strategy itself changes.
 */
const CACHE = 'gymflow-shell-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'].map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return; // never cache data or auth

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => {
          if (hit) return hit;
          // A page navigation may fall back to the SPA shell; a script or stylesheet must fail cleanly.
          if (request.mode === 'navigate') return caches.match('/');
          return Response.error();
        })),
    );
    return;
  }

  // Google Fonts: the URLs are versioned, so cache-first is safe.
  if (/(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
  }
});
