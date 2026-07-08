/* Star-Lord Command service worker
   Strategy:
   - App page (navigations): network-first, cached copy as offline fallback.
     Pushing a new index.html shows up on next load, no cache-busting needed.
   - Everything else same-origin (icons, manifest, R1 template): cache-first.
   - Cross-origin (Google Fonts, Drive APIs): untouched, straight to network.
*/
const CACHE = 'slc-v1';
const PRECACHE = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './r1-template.xlsx',
  './mountain.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // r1 template may not exist yet on first deploys — don't fail install over it
      Promise.allSettled(PRECACHE.map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts, Drive etc. pass through

  // The app itself: network-first so GitHub pushes land immediately
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Assets: cache-first, backfill on miss
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
