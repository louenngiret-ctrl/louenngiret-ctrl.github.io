// Service worker du Grenier : hors connexion + mises à jour.
// À CHAQUE NOUVELLE VERSION : changer VERSION ici ET dans version.json.
const VERSION = '0.2.0';
const CACHE = `grenier-${VERSION}`;

const COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './noyau/style.css',
  './noyau/app.js',
  './noyau/store.js',
  './noyau/malles.js',
  './malles/carnet/index.html',
  './assets/fonts/special-elite.woff2',
  './assets/fonts/permanent-marker.woff2',
  './assets/fonts/patrick-hand.woff2',
  './assets/icons/grenier-192.png',
  './assets/icons/grenier-512.png',
  './assets/icons/favicon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' pour ne pas reprendre une vieille copie gardée par le navigateur.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE.map((u) => new Request(u, { cache: 'reload' })))));
  // Pas de skipWaiting automatique : l'appli propose « Recharger » à Louenn.
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((k) => k.startsWith('grenier-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // version.json : toujours le réseau d'abord, pour voir les nouveautés.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  // Pages : chaque page (le grenier, Carnet…) depuis le cache, même hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const page = await caches.match(req, { ignoreSearch: true });
      if (page) return page;
      try { return await fetch(req); } catch (err) {
        const racine = url.pathname === '/' || url.pathname.endsWith('/index.html') && !url.pathname.includes('/malles/');
        return (racine && await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Le reste : cache d'abord, puis réseau (et on garde une copie).
  e.respondWith((async () => {
    const enCache = await caches.match(req);
    if (enCache) return enCache;
    const rep = await fetch(req);
    if (rep.ok) {
      const c = await caches.open(CACHE);
      c.put(req, rep.clone());
    }
    return rep;
  })());
});
