/* GymFlow service worker.
 *
 * Deliberately conservative: this app's whole point is live Firestore data, so the
 * worker never touches API traffic. It caches the static shell only, and serves the
 * shell network-first so a deploy is picked up immediately rather than on a later visit.
 *
 * Bump CACHE when shell files change; old caches are dropped on activate.
 */
const CACHE = 'gymflow-shell-v1';

const SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/member.html',
  '/manifest.webmanifest',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/layout.css',
  '/assets/css/ported.css',
  '/assets/css/auth.css',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// Never cache: auth, database, analytics. Stale data here would be actively wrong.
const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebaselogging-pa.googleapis.com',
  'www.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll() rejects the whole batch if one file 404s, so add individually.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
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
  if (BYPASS_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) return;

  // App shell + same-origin assets: network first, cache as backup when offline.
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
          // Only a page navigation may fall back to the shell — handing index.html to a
          // module or stylesheet request would fail on MIME type instead of failing cleanly.
          if (request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        })),
    );
    return;
  }

  // Versioned CDN files (Firebase SDK, fonts, chart/export libs): cache first — the URL
  // changes when the version does, so a hit is never stale.
  if (/(gstatic\.com|jsdelivr\.net|googleapis\.com)$/.test(url.hostname)) {
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
