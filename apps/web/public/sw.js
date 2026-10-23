const CACHE = 'nsr-impulse-v2';
const PRECACHE = [
	'/manifest.webmanifest',
	'/images/campus/campus-building.jpg',
	'/images/campus/classroom.jpg',
	'/images/campus/library.jpg'
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((key) => key.startsWith('nsr-impulse-') && key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).then((response) => {
				if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
				return response;
			}).catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => cached || fetch(request).then((response) => {
			if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
			return response;
		}))
	);
});
