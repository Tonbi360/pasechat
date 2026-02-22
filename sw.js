self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('pase-v1').then((cache) => {
      return cache.addAll(['./', './index.html', './style.css', './app.js']);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
