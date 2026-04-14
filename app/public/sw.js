/**
 * PicMachina Service Worker
 *
 * Strategy: network-first with no aggressive caching.
 *
 * This app is local-first (File System Access API + IndexedDB) — there is no
 * server-side data to sync. The service worker exists purely to satisfy the
 * PWA installability requirement. We do not cache WASM chunks, AI models, or
 * large media blobs, as those are managed by the browser and would bloat the
 * cache needlessly.
 *
 * On network failure (offline), the shell HTML is served from a minimal cache
 * so the app can at least open and show a meaningful message.
 */

const CACHE_NAME = 'picmachina-shell-v1';

// Only cache the bare minimum needed to open the app offline
const SHELL_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Remove any old caches from previous versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests — let cross-origin CDN requests pass through
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful shell responses for offline fallback
        if (response.ok && SHELL_URLS.some(u => url.pathname === u || url.pathname === '/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached ?? Response.error()))
  );
});
