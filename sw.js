// Service worker: makes About Me open offline.
//
// It only ever caches the app's own files (the "shell"). Personal data and
// photos are never handled here; they live in the storage layer.
//
// Change VERSION whenever any file below changes, so installed copies update.

const VERSION = '1.3.2';
const SHELL = 'iom-shell-' + VERSION;
const ASSETS = [
  './',
  './css/styles.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './js/app.js',
  './js/attachments.js',
  './js/config.js',
  './js/domain/model.js',
  './js/domain/reminders.js',
  './js/domain/search.js',
  './js/lock.js',
  './js/platform.js',
  './js/router.js',
  './js/storage/backup.js',
  './js/storage/db.js',
  './js/storage/files.js',
  './js/storage/index.js',
  './js/storage/opfs-worker.js',
  './js/storage/prefs.js',
  './js/theme-boot.js',
  './js/theme.js',
  './js/ui/components.js',
  './js/ui/dom.js',
  './js/ui/lockscreen.js',
  './js/util.js',
  './js/views/care.js',
  './js/views/home.js',
  './js/views/inventory.js',
  './js/views/me.js',
  './js/views/records.js',
  './js/views/reminders.js',
  './js/views/search.js',
  './js/views/settings.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove older shells only. The photo store ('iom-files-…') is left alone.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('iom-shell-') && n !== SHELL).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./index.html') : null);

    // Serve from the cache straight away and refresh it in the background.
    const refresh = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
