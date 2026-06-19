// Minimal Service Worker to enable PWA installation
const CACHE_NAME = 'bikepack-boarding-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache same-origin GET requests (local assets).
  // Let the browser handle API calls and cross-origin requests natively —
  // intercepting them here caused POST requests to Supabase to return
  // undefined on catch, which the browser surfaced as "Failed to fetch".
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
