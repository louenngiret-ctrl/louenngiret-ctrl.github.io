// Service worker du Grenier : hors connexion + mises à jour.
// À CHAQUE NOUVELLE VERSION : changer VERSION ici ET dans version.json.
const VERSION = '0.9.0';
const CACHE = `grenier-${VERSION}`;
// Gros fichiers (Carnet, Suite BTS, moteur et modèles d'essayage) : dans un cache à part,
// gardé d'une version à l'autre. Changer LOURDS seulement quand Carnet ou la Suite changent.
const LOURDS = 'grenier-lourds-3';
const FICHIERS_LOURDS = [
  './malles/carnet/index.html', './malles/cours/suite/index.html',
  // décor de la Loge (images de Louenn découpées) : rarement modifié
  './assets/loge/assiette.webp',
  './assets/loge/atomiseur.webp',
  './assets/loge/bobine.webp',
  './assets/loge/boite-coeur.webp',
  './assets/loge/boite-papillon.webp',
  './assets/loge/boite-papillons.webp',
  './assets/loge/bougeoir-serpent.webp',
  './assets/loge/bougie.webp',
  './assets/loge/buffet.webp',
  './assets/loge/buste.webp',
  './assets/loge/cadre-fleuri.webp',
  './assets/loge/champignon.webp',
  './assets/loge/charniere.webp',
  './assets/loge/cle.webp',
  './assets/loge/coin-laiton.webp',
  './assets/loge/collier-soleil.webp',
  './assets/loge/commode.webp',
  './assets/loge/coussin.webp',
  './assets/loge/crane.webp',
  './assets/loge/epingle.webp',
  './assets/loge/etoile-or.webp',
  './assets/loge/etoile-spirale.webp',
  './assets/loge/faons.webp',
  './assets/loge/feuille-chene.webp',
  './assets/loge/flacon-bleu.webp',
  './assets/loge/flacon-rose.webp',
  './assets/loge/lampe-champignon.webp',
  './assets/loge/lampe-lotus.webp',
  './assets/loge/lampe-lune.webp',
  './assets/loge/lampe-pied.webp',
  './assets/loge/lampe-tiffany.webp',
  './assets/loge/lanterne-bleue.webp',
  './assets/loge/lanterne-orange.webp',
  './assets/loge/lanterne-rose.webp',
  './assets/loge/lit.webp',
  './assets/loge/livre.webp',
  './assets/loge/lune-chat.webp',
  './assets/loge/lustre-dore.webp',
  './assets/loge/lustre-roses.webp',
  './assets/loge/marteau.webp',
  './assets/loge/massicot.webp',
  './assets/loge/metier-a-tisser.webp',
  './assets/loge/murs/mur-coiffure.webp',
  './assets/loge/murs/mur-makeup.webp',
  './assets/loge/murs/mur-ongles.webp',
  './assets/loge/murs/mur-piercing.webp',
  './assets/loge/murs/mur-soins.webp',
  './assets/loge/murs/mur-tatouage.webp',
  './assets/loge/papillon-nuit.webp',
  './assets/loge/patchwork.webp',
  './assets/loge/peigne.webp',
  './assets/loge/pichet.webp',
  './assets/loge/pinceau.webp',
  './assets/loge/plaid.webp',
  './assets/loge/plante.webp',
  './assets/loge/plioir.webp',
  './assets/loge/poincon.webp',
  './assets/loge/pot-cire.webp',
  './assets/loge/presse.webp',
  './assets/loge/regle.webp',
  './assets/loge/rideaux.webp',
  './assets/loge/roulette.webp',
  './assets/loge/serpent.webp',
  './assets/loge/suspension-verte.webp',
  './assets/loge/tableau.webp',
  './assets/loge/tapis-rond.webp',
  './assets/loge/tasse.webp',
  './assets/loge/tete-mannequin.webp',
  './assets/loge/trousse.webp',
  './assets/loge/vase-haut.webp',
  './assets/loge/vase-rond.webp',
  './assets/loge/verres.webp',
  './assets/loge/vis/vis-00.webp',
  './assets/loge/vis/vis-01.webp',
  './assets/loge/vis/vis-02.webp',
  './assets/loge/vis/vis-03.webp',
  './assets/loge/vis/vis-04.webp',
  './assets/loge/vis/vis-05.webp',
  './assets/loge/vis/vis-06.webp',
  './assets/loge/vis/vis-07.webp',
  './assets/loge/vis/vis-08.webp',
  './assets/loge/vis/vis-09.webp',
  './assets/loge/vis/vis-10.webp',
  './assets/loge/vis/vis-11.webp',
  './assets/loge/vis/vis-12.webp',
  './assets/loge/vis/vis-13.webp',
  './assets/loge/vis/vis-14.webp',
  './assets/loge/vis/vis-15.webp',
  './assets/loge/vis/vis-16.webp',
  './assets/loge/vis/vis-17.webp',
  './assets/loge/vis/vis-18.webp',
  './assets/loge/vis/vis-19.webp',
  './assets/loge/vis/vis-20.webp',
  './assets/loge/vis/vis-21.webp',
  './assets/loge/vis/vis-22.webp',
  './assets/loge/vis/vis-23.webp',
  // décor de l'accueil (planches de Louenn découpées) : attaches, fenêtre, cadrans, objets à trouver
  './assets/deco/washi/w0.webp',
  './assets/deco/washi/w1.webp',
  './assets/deco/washi/w10.webp',
  './assets/deco/washi/w11.webp',
  './assets/deco/washi/w12.webp',
  './assets/deco/washi/w13.webp',
  './assets/deco/washi/w2.webp',
  './assets/deco/washi/w3.webp',
  './assets/deco/washi/w4.webp',
  './assets/deco/washi/w5.webp',
  './assets/deco/washi/w6.webp',
  './assets/deco/washi/w7.webp',
  './assets/deco/washi/w8.webp',
  './assets/deco/washi/w9.webp',
  './assets/deco/pinces/p0.webp',
  './assets/deco/pinces/p1.webp',
  './assets/deco/pinces/p10.webp',
  './assets/deco/pinces/p11.webp',
  './assets/deco/pinces/p12.webp',
  './assets/deco/pinces/p13.webp',
  './assets/deco/pinces/p2.webp',
  './assets/deco/pinces/p3.webp',
  './assets/deco/pinces/p4.webp',
  './assets/deco/pinces/p5.webp',
  './assets/deco/pinces/p6.webp',
  './assets/deco/pinces/p7.webp',
  './assets/deco/pinces/p8.webp',
  './assets/deco/pinces/p9.webp',
  './assets/deco/papiers/epicerie-2.webp',
  './assets/deco/papiers/epicerie.webp',
  './assets/deco/papiers/etiquette-large.webp',
  './assets/deco/papiers/etiquette-longue.webp',
  './assets/deco/papiers/etiquette-porte.webp',
  './assets/deco/papiers/fanion-1.webp',
  './assets/deco/papiers/fanion-2.webp',
  './assets/deco/papiers/fanion-3.webp',
  './assets/deco/papiers/fanion-4.webp',
  './assets/deco/papiers/sceau-1.webp',
  './assets/deco/papiers/sceau-2.webp',
  './assets/deco/papiers/sceau-3.webp',
  './assets/deco/papiers/ticket-horloge.webp',
  './assets/deco/papiers/ticket.webp',
  './assets/deco/fenetre/carillon.webp',
  './assets/deco/fenetre/lierre.webp',
  './assets/deco/horloges/atelier.webp',
  './assets/deco/horloges/bistrot.webp',
  './assets/deco/horloges/chateau.webp',
  './assets/deco/horloges/engrenages.webp',
  './assets/deco/horloges/gare.webp',
  './assets/deco/horloges/squelette.webp',
  './assets/deco/calendrier/plaque.webp',
  './assets/deco/bordures/b0.webp',
  './assets/deco/bordures/b1.webp',
  './assets/deco/bordures/b2.webp',
  './assets/deco/bordures/b3.webp',
  './assets/deco/bordures/b4.webp',
  './assets/deco/bordures/b5.webp',
  './assets/deco/bordures/b6.webp',
  './assets/deco/bordures/b7.webp',
  './assets/deco/curios/aigle.webp',
  './assets/deco/curios/bocal-des.webp',
  './assets/deco/curios/boite-laiton.webp',
  './assets/deco/curios/boite-papillon.webp',
  './assets/deco/curios/bouteille-poire.webp',
  './assets/deco/curios/calice.webp',
  './assets/deco/curios/chat-violet.webp',
  './assets/deco/curios/chaton.webp',
  './assets/deco/curios/coffret-argent.webp',
  './assets/deco/curios/crapaud.webp',
  './assets/deco/curios/fiole-fleurs.webp',
  './assets/deco/curios/flacon-chat.webp',
  './assets/deco/curios/flacon-etoile.webp',
  './assets/deco/curios/grimoire.webp',
  './assets/deco/curios/lapin.webp',
  './assets/deco/curios/loupe.webp',
  './assets/deco/curios/medaillon-pensee.webp',
  './assets/deco/curios/poudrier-lune.webp',
  './assets/deco/curios/theiere.webp',
  './assets/deco/stickers/aile-fee.webp',
  './assets/deco/stickers/bouton-brun.webp',
  './assets/deco/stickers/bouton-creme.webp',
  './assets/deco/stickers/champignon.webp',
  './assets/deco/stickers/crapaud-fee.webp',
  './assets/deco/stickers/etoile-brodee.webp',
  './assets/deco/stickers/etoile-filante.webp',
  './assets/deco/stickers/etoile-or.webp',
  './assets/deco/stickers/etoile-perlee.webp',
  './assets/deco/stickers/faon.webp',
  './assets/deco/stickers/marguerite.webp',
  './assets/deco/stickers/monarque.webp',
  './assets/deco/stickers/nuage.webp',
  './assets/deco/stickers/papillon-vert.webp',
  './assets/deco/stickers/soleil.webp',
  // vues fixes, cartes, planches et papiers peints (les vues animées se gardent à la première visite)
  './assets/deco/vues/cactus-fixe.webp',
  './assets/deco/vues/etoiles-fixe.webp',
  './assets/deco/vues/lune-fixe.webp',
  './assets/deco/vues/phalene-fixe.webp',
  './assets/deco/vues/tourbillon-fixe.webp',
  './assets/deco/tarot/t00.webp',
  './assets/deco/tarot/t01.webp',
  './assets/deco/tarot/t02.webp',
  './assets/deco/tarot/t03.webp',
  './assets/deco/tarot/t04.webp',
  './assets/deco/tarot/t05.webp',
  './assets/deco/tarot/t06.webp',
  './assets/deco/tarot/t07.webp',
  './assets/deco/tarot/t08.webp',
  './assets/deco/tarot/t09.webp',
  './assets/deco/tarot/t10.webp',
  './assets/deco/tarot/t11.webp',
  './assets/deco/tarot/t12.webp',
  './assets/deco/tarot/t13.webp',
  './assets/deco/tarot/t14.webp',
  './assets/deco/tarot/t15.webp',
  './assets/deco/tarot/t16.webp',
  './assets/deco/tarot/t17.webp',
  './assets/deco/tarot/t18.webp',
  './assets/deco/tarot/t19.webp',
  './assets/deco/tarot/t20.webp',
  './assets/deco/tarot/t21.webp',
  './assets/deco/haeckel/h008.webp',
  './assets/deco/haeckel/h028.webp',
  './assets/deco/haeckel/h049.webp',
  './assets/deco/haeckel/h058.webp',
  './assets/deco/haeckel/h062.webp',
  './assets/deco/haeckel/h072.webp',
  './assets/deco/haeckel/h074.webp',
  './assets/deco/haeckel/h099.webp',
  './assets/deco/fonds/foret.webp',
  './assets/deco/fonds/grunge.webp',
  './assets/deco/fonds/patchwork.webp',
  './assets/deco/fonds/reverie.webp',
  // My memories : stickers, collages et dentelles des menus
  './assets/memoires/collage/ange-paon.webp',
  './assets/memoires/collage/azulejo.webp',
  './assets/memoires/collage/carreau-rouge.webp',
  './assets/memoires/collage/frise-pommes.webp',
  './assets/memoires/collage/frise-souris.webp',
  './assets/memoires/collage/mosaique.webp',
  './assets/memoires/collage/nenuphars.webp',
  './assets/memoires/collage/ornements.webp',
  './assets/memoires/collage/retro.webp',
  './assets/memoires/collage/tapis.webp',
  './assets/memoires/collage/timbre-bresil.webp',
  './assets/memoires/collage/timbre-chats.webp',
  './assets/memoires/collage/timbre-klimt.webp',
  './assets/memoires/collage/vitraux.webp',
  './assets/memoires/dentelles/d0.webp',
  './assets/memoires/dentelles/d1.webp',
  './assets/memoires/dentelles/d2.webp',
  './assets/memoires/dentelles/d3.webp',
  './assets/memoires/dentelles/d4.webp',
  './assets/memoires/dentelles/d5.webp',
  './assets/memoires/dentelles/d6.webp',
  './assets/memoires/dentelles/d7.webp',
  './assets/memoires/dentelles/d8.webp',
  './assets/memoires/stickers/bourdon-the.webp',
  './assets/memoires/stickers/bourdon.webp',
  './assets/memoires/stickers/champi-fantome.webp',
  './assets/memoires/stickers/champi-fraise.webp',
  './assets/memoires/stickers/chat-aile.webp',
  './assets/memoires/stickers/chat-bocal.webp',
  './assets/memoires/stickers/chat-nouilles.webp',
  './assets/memoires/stickers/chat-sorcier.webp',
  './assets/memoires/stickers/chat-tasse.webp',
  './assets/memoires/stickers/colibri.webp',
  './assets/memoires/stickers/crapaud-chambre.webp',
  './assets/memoires/stickers/crapaud-sorcier.webp',
  './assets/memoires/stickers/crapaud.webp',
  './assets/memoires/stickers/croissant.webp',
  './assets/memoires/stickers/faon-tachete.webp',
  './assets/memoires/stickers/fees.webp',
  './assets/memoires/stickers/grenouille-amanite.webp',
  './assets/memoires/stickers/grenouille-chapeau.webp',
  './assets/memoires/stickers/herisson-fleur.webp',
  './assets/memoires/stickers/herisson-livre.webp',
  './assets/memoires/stickers/jonquille.webp',
  './assets/memoires/stickers/nuage-pleure.webp',
  './assets/memoires/stickers/oie.webp',
  './assets/memoires/stickers/papillon-bleu.webp',
  './assets/memoires/stickers/pie-robe.webp',
  './assets/memoires/stickers/pleine-lune.webp',
  './assets/memoires/stickers/ronde-fees.webp',
  './assets/memoires/stickers/soleil-rouge.webp',
  './assets/memoires/stickers/souris-archer.webp',
  './assets/memoires/stickers/souris-champi.webp',
  './assets/memoires/stickers/souris-escargot.webp',
];

const COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './noyau/style.css',
  './noyau/app.js',
  './noyau/store.js',
  './noyau/malles.js',
  './noyau/outils.js',
  './noyau/accueil.js',
  './noyau/accueil.css',
  './noyau/meteo.js',
  './noyau/decor.js',
  './noyau/decor.css',
  './noyau/curiosites.js',
  './noyau/atelier.js',
  './noyau/navigation.js',
  './noyau/plan.js',
  './noyau/menus.js',
  './noyau/menus.css',
  './noyau/navigation.css',
  './assets/fonts/unifraktur-maguntia.woff2',
  './malles/loge/index.html',
  './malles/loge/loge.css',
  './malles/loge/loge.js',
  './malles/loge/donnees.js',
  './malles/loge/essayage.js',
  './malles/loge/filtre.js',
  './malles/loge/cheveux.js',
  './malles/loge/visage.js',
  './malles/cours/index.html',
  './assets/textures/plaster.png',
  './assets/textures/woodfloor.png',
  './assets/textures/rug.png',
  './assets/fonts/bodoni-moda-italic.woff2',
  './assets/fonts/bodoni-moda-600.woff2',
  './assets/fonts/special-elite.woff2',
  './assets/fonts/permanent-marker.woff2',
  './assets/fonts/patrick-hand.woff2',
  './assets/icons/grenier-192.png',
  './assets/icons/grenier-512.png',
  './assets/icons/favicon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' pour ne pas reprendre une vieille copie gardée par le navigateur.
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(COQUILLE.map((u) => new Request(u, { cache: 'reload' })));
    const l = await caches.open(LOURDS);
    for (const u of FICHIERS_LOURDS) {
      if (!(await l.match(u))) await l.add(new Request(u, { cache: 'reload' }));
    }
  })());
  // Pas de skipWaiting automatique : l'appli propose « Recharger » à Louenn.
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((k) => k.startsWith('grenier-') && k !== CACHE && k !== LOURDS).map((k) => caches.delete(k)));
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

  // Moteur d'essayage (vendor/) et modèles MediaPipe : cache d'abord, gardé entre les versions.
  const modele = url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/mediapipe-models/');
  // Les images du décor (assets/deco/) aussi : vues animées, tarot, planches, papiers peints chargés à la demande.
  if (modele || (url.origin === location.origin && (url.pathname.includes('/vendor/') || url.pathname.includes('/assets/deco/') || url.pathname.includes('/assets/memoires/')))) {
    e.respondWith((async () => {
      const l = await caches.open(LOURDS);
      const deja = await l.match(req);
      if (deja) return deja;
      const rep = await fetch(req);
      if (rep.ok) l.put(req, rep.clone());
      return rep;
    })());
    return;
  }

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
