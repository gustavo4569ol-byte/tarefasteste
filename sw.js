const CACHE_NAME = 'taskmaster-v5';

const FILES_TO_CACHE = [
  '/tarefasteste/',
  '/tarefasteste/index.html',
  '/tarefasteste/styles.css',
  '/tarefasteste/script.js',
  '/tarefasteste/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
      return caches.match('/tarefasteste/index.html');
    })
  );
});
