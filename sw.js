const CACHE_NAME = 'box-jardim-silvina-v2';
const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './aluno.html',
  './admin.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './assets/images/kettlebell.png',
  './assets/images/logo-box.png',
  './css/tokens.css',
  './css/global.css',
  './css/auth.css',
  './css/components.css',
  './css/dashboard.css',
  './css/admin.css',
  './css/polish.css',
  './js/motion.js',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/attendance.js',
  './js/dates.js',
  './js/events.js',
  './js/gamification.js',
  './js/profile.js',
  './js/store.js',
  './js/student-app.js',
  './js/admin.js',
  './js/ui.js',
  './js/uploads.js',
  './js/workouts.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('box-jardim-silvina-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Não intercepta o Supabase nem outros serviços externos; a autenticação e os dados
  // continuam dependentes de rede e nunca são gravados pelo cache do app shell.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && request.mode !== 'navigate') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await cache.match('./login.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
