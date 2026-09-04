// Service Worker - Club Al Oussoud
const CACHE_NAME = 'al-oussoud-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Never intercept non-GET, API calls, port 8080 or external schemes
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.port === '8080' ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // 2. Safe fetch with fallback guaranteeing a valid Response object
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        try {
          const cached = await caches.match(event.request);
          if (cached) {
            return cached;
          }
          if (event.request.mode === 'navigate') {
            const indexCached = await caches.match('/');
            if (indexCached) return indexCached;
          }
        } catch {}
        return new Response('Network error', {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
