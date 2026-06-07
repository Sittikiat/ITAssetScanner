const CACHE_NAME = 'asset-scanner-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached version if available
      if (response) return response;

      // Otherwise fetch from network
      return fetch(event.request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses (except for external CDNs)
        if (event.request.url.includes(self.location.origin) || 
            event.request.url.includes('fonts.googleapis.com')) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    }).catch(() => {
      // Return offline page if both cache and network fail
      // Could return a custom offline page here
      return new Response('Offline - App will work with cached data', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain'
        })
      });
    })
  );
});

// Background sync for cloud backup
self.addEventListener('sync', event => {
  if (event.tag === 'sync-backup') {
    event.waitUntil(
      // Trigger backup when back online
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_BACKUP',
            message: 'Time to sync backup to cloud'
          });
        });
      })
    );
  }
});

// Handle push notifications for backups
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Asset Scanner';
  const options = {
    body: data.message || 'Backup synced successfully',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23C8102E" width="192" height="192" rx="30"/><text x="96" y="96" fill="white" text-anchor="middle" dominant-baseline="middle" font-size="100" font-weight="bold">A</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%23C8102E"/></svg>'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
