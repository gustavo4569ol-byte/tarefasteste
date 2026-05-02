/* ============================================================================
   TaskMaster PWA - Service Worker
   Suporte offline e cache de assets
   ============================================================================ */

const CACHE_NAME = 'taskmaster-v6';

const urlsToCache = [
  '/tarefasteste/',
  '/tarefasteste/index.html',
  '/tarefasteste/styles.css',
  '/tarefasteste/script.js',
  '/tarefasteste/manifest.json'
];

// Instalação
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Ativação
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

// Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(networkResponse => {
        // Cache das requisições GET bem-sucedidas
        if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Offline - retorna index.html
      return caches.match('/tarefasteste/index.html');
    })
  );
});
