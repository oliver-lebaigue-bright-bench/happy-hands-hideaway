// ─── PWA Service Worker for Happy Hands Hideaway Admin ───

const CACHE_NAME = 'hhh-admin-v1';

// Core files to cache for offline support & iOS PWA install
const PRECACHE_URLS = [
  '/admin.html',
  '/manifest.json',
  '/images/icon-512x512.svg',
  '/images/logo.jpeg',
  '/resources/favicon.ico'
];

// ─── Install Event: Cache shell & claim all clients immediately ───
// iOS Safari requires this to properly register the SW before offering "Add to Home Screen"
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())  // Activate immediately, don't wait for old SW to die
  );
});

// ─── Activate Event: Clean old caches & take control of all pages ───
// Without clients.claim(), iOS may not register the SW for existing tabs
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())  // Take control of all open pages immediately
  );
});

// ─── Push Event: Display notification when server sends a push ───
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Order Received!', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'Open your dashboard to view order details.',
    icon: '/images/icon-512x512.svg',
    badge: '/images/icon-512x512.svg',
    tag: 'new-order-alert',
    renotify: true,
    vibrate: [200, 100, 200],  // Explicit vibration pattern for mobile devices
    data: {
      url: '/admin.html'
    },
    // Required for iOS Safari to show notification properly
    actions: [
      { action: 'open', title: 'Open Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'New Order!', options)
  );
});

// ─── Notification Click: Open or focus the admin panel ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = '/admin.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the admin panel is already open, just focus it
        for (const client of clientList) {
          if (client.url.includes('/admin.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a fresh window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Fetch Event: Network-first with cache fallback ───
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // For navigation requests, return the cached admin.html
          if (event.request.mode === 'navigate') {
            return caches.match('/admin.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});