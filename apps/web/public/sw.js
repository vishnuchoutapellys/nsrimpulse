const CACHE = 'nsr-impulse-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/images/campus/campus-building.jpg', '/images/campus/classroom.jpg', '/images/campus/library.jpg']))));
self.addEventListener('fetch', event => { if (event.request.method === 'GET') event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
