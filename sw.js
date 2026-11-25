// Service worker du Grenier : hors connexion + mises à jour.
// À CHAQUE NOUVELLE VERSION : changer VERSION ici ET dans version.json.
const VERSION = '0.3.0';
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
  const url = new URL(req.url);

  // Partage reçu depuis une autre appli (manifeste : share_target, action ./partage).
  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/partage')) {
    e.respondWith(recevoirPartage(req));
    return;
  }

  if (req.method !== 'GET') return;
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

/* ---------- Partage reçu : rangé dans la Boîte à trier ---------- */

// Ouvre la base « grenier » SANS numéro de version : si elle existe déjà, on la prend telle
// quelle (son schéma et ses migrations sont gérés par noyau/store.js). Si elle n'existe pas
// encore, on crée exactement l'étape 1 de store.js, pour que l'appli la retrouve ensuite.
function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('grenier');
    r.onupgradeneeded = (ev) => {
      if (ev.oldVersion < 1) {
        const db = r.result;
        const el = db.createObjectStore('elements', { keyPath: 'id' });
        el.createIndex('malle', 'malle');
        el.createIndex('modifie', 'modifie');
        db.createObjectStore('meta', { keyPath: 'cle' });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const nouvelId = () => (self.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Photos réduites à 1600 px de côté en JPEG, pour épargner le téléphone. Si le navigateur
// ne sait pas faire dans le service worker, on garde la photo d'origine.
async function compresser(fichier) {
  try {
    if (!self.OffscreenCanvas || !self.createImageBitmap) return fichier;
    const img = await createImageBitmap(fichier);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    img.close && img.close();
    const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    return b.size < fichier.size ? b : fichier;
  } catch (err) { return fichier; }
}

async function recevoirPartage(req) {
  let n = 0;
  try {
    const f = await req.formData();
    const titre = (f.get('titre') || '').toString().trim();
    const texte = (f.get('texte') || '').toString().trim();
    const lien = (f.get('lien') || '').toString().trim();
    const photos = f.getAll('fichiers').filter((x) => x && typeof x === 'object' && x.size && /^image\//.test(x.type || 'image/'));
    // Beaucoup d'applis mettent le lien dans le texte : on le repère.
    const lienTrouve = lien || (texte.match(/https?:\/\/\S+/) || [])[0] || '';
    const mots = [titre, texte.replace(lienTrouve, '').trim()].filter(Boolean).join('\n');
    const maintenant = Date.now();
    const base = { malle: 'boite', etiquettes: ['partage'], liens: [], cree: maintenant, modifie: maintenant };
    const elements = [];
    for (const p of photos) {
      const fichier = await compresser(p);
      elements.push({ ...base, id: nouvelId(), type: 'photo', titre: titre || 'Photo partagée', texte: mots, fichier, cree: maintenant + elements.length, modifie: maintenant + elements.length });
    }
    if (!photos.length && (lienTrouve || mots)) {
      const estLien = Boolean(lienTrouve) && !mots;
      elements.push({ ...base, id: nouvelId(), type: lienTrouve ? 'lien' : 'note', titre: (titre || mots || lienTrouve).split('\n')[0].slice(0, 80), texte: estLien ? lienTrouve : [mots, lienTrouve].filter(Boolean).join('\n'), url: lienTrouve || undefined });
    }
    if (elements.length) {
      const db = await ouvrirBase();
      await new Promise((resolve, reject) => {
        const t = db.transaction('elements', 'readwrite');
        elements.forEach((el) => t.objectStore('elements').put(el));
        t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
      });
      db.close();
      n = elements.length;
    }
  } catch (err) { n = -1; }
  return Response.redirect(new URL(`./?recu=${n}#/boite`, self.registration.scope).href, 303);
}
