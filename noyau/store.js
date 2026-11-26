// Stockage de My memories : une base IndexedDB (nom historique « grenier », gardé pour ne rien perdre).
// La base de chaque appareil est la source de vérité (local d'abord) ; la synchronisation viendra s'y brancher
// en lisant le journal des changements (store « journal »). Voir docs/ARCHITECTURE.md.
//
// Stores :
//   elements  { id, malle, type, titre, texte, cree, modifie, etiquettes: [], liens: [], fichier? }
//             « malle » = l'identifiant du nœud (page) ou de la malle qui possède l'élément.
//   meta      { cle, valeur }                       réglages et petits états
//   noeuds    { id, parent, ordre, type, nom, ... } l'arborescence du site (voir noyau/arbre.js)
//   versions  { id, cible, date, raison, donnees }  anciennes versions (pages, arbre, apps)
//   fichiers  { id, parent, nom, mime, taille, blob, source, cree, modifie } fichiers importés
//   apps      { id, manifeste, fichiers: [{ chemin, mime, taille }], installe, modifie } apps ajoutées
//   journal   { seq, store, cle, op, date, appareil } chaque changement, pour la future synchronisation

const NOM = 'grenier';
export const VERSION_SCHEMA = 2;
export const STORES = ['elements', 'meta', 'noeuds', 'versions', 'fichiers', 'apps', 'journal'];
// stores dont les changements partent dans le journal (meta : seulement certaines clés, voir ecrireMeta)
const SUIVIS = new Set(['elements', 'noeuds', 'fichiers', 'apps']);

let dbPromise = null;

function ouvrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(NOM, VERSION_SCHEMA);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      // Migrations, dans l'ordre. Ne jamais modifier une étape déjà publiée : en ajouter une.
      if (e.oldVersion < 1) {
        const el = db.createObjectStore('elements', { keyPath: 'id' });
        el.createIndex('malle', 'malle');
        el.createIndex('modifie', 'modifie');
        db.createObjectStore('meta', { keyPath: 'cle' });
      }
      if (e.oldVersion < 2) {
        // 1.0.0 : arborescence administrable, versions, fichiers, apps, journal de synchronisation
        const n = db.createObjectStore('noeuds', { keyPath: 'id' });
        n.createIndex('parent', 'parent');
        const v = db.createObjectStore('versions', { keyPath: 'id' });
        v.createIndex('cible', 'cible');
        v.createIndex('date', 'date');
        const f = db.createObjectStore('fichiers', { keyPath: 'id' });
        f.createIndex('parent', 'parent');
        db.createObjectStore('apps', { keyPath: 'id' });
        const j = db.createObjectStore('journal', { keyPath: 'seq', autoIncrement: true });
        j.createIndex('date', 'date');
      }
    };
    r.onsuccess = () => {
      const db = r.result;
      // une autre page a ouvert une version plus récente : on se ferme pour la laisser migrer
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => { /* une ancienne page est encore ouverte ; elle se fermera grâce à onversionchange */ };
  });
  return dbPromise;
}

export function tx(stores, mode, fn) {
  return ouvrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const s = Array.isArray(stores) ? stores.map((x) => t.objectStore(x)) : t.objectStore(stores);
    let res;
    Promise.resolve(fn(s, t)).then((v) => { res = v; }, (err) => { try { t.abort(); } catch (e) { /* déjà fini */ } reject(err); });
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction annulée'));
  }));
}

export const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

export const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/** Identifiant de cet appareil (pour le journal et la future synchronisation). */
export function appareil() {
  try {
    let id = localStorage.getItem('mm.appareil');
    if (!id) { id = nouvelId(); localStorage.setItem('mm.appareil', id); }
    return id;
  } catch (e) { return 'inconnu'; }
}
function noter(t, store, cle, op) {
  if (!SUIVIS.has(store)) return;
  t.objectStore('journal').add({ store, cle, op, date: Date.now(), appareil: appareil() });
}

/* ---------- Accès génériques (utilisés par arbre.js, apps.js, sauvegarde.js) ---------- */
export const lire = (store, cle) => tx(store, 'readonly', (s) => req(s.get(cle)));
export const lireTout = (store) => tx(store, 'readonly', (s) => req(s.getAll()));
export const parIndex = (store, index, valeur) => tx(store, 'readonly', (s) => req(s.index(index).getAll(valeur)));
export function ecrire(store, obj) {
  return tx([store, 'journal'], 'readwrite', ([s], t) => { s.put(obj); noter(t, store, obj[s.keyPath], 'put'); return obj; });
}
export function effacer(store, cle) {
  return tx([store, 'journal'], 'readwrite', ([s], t) => { s.delete(cle); noter(t, store, cle, 'del'); });
}
/** Plusieurs écritures d'un coup, tout ou rien. ops : [{ store, op: 'put'|'del', obj|cle }] */
export function lot(ops) {
  const stores = [...new Set(ops.map((o) => o.store)), 'journal'];
  return tx(stores, 'readwrite', (ss, t) => {
    for (const o of ops) {
      const s = t.objectStore(o.store);
      if (o.op === 'del') { s.delete(o.cle); noter(t, o.store, o.cle, 'del'); }
      else { s.put(o.obj); noter(t, o.store, o.obj[s.keyPath], 'put'); }
    }
  });
}

/* ---------- Éléments (API historique, inchangée) ---------- */
export async function ajouter(partiel) {
  const maintenant = Date.now();
  const el = { id: nouvelId(), type: 'note', titre: '', texte: '', etiquettes: [], liens: [], cree: maintenant, modifie: maintenant, ...partiel };
  await ecrire('elements', el);
  return el;
}

export async function modifier(id, changements) {
  return tx(['elements', 'journal'], 'readwrite', async ([s], t) => {
    const el = await req(s.get(id));
    if (!el) return null;
    const maj = { ...el, ...changements, modifie: Date.now() };
    s.put(maj); noter(t, 'elements', id, 'put');
    return maj;
  });
}

export const supprimer = (id) => effacer('elements', id);

export async function parMalle(malle) {
  const liste = await parIndex('elements', 'malle', malle);
  return (liste || []).sort((a, b) => b.cree - a.cree);
}

export const tout = () => lireTout('elements');

export const lireMeta = (cle) => lire('meta', cle).then((r) => (r ? r.valeur : undefined));
export const ecrireMeta = (cle, valeur) => tx('meta', 'readwrite', (s) => s.put({ cle, valeur }));

/** Compatibilité : ancienne sauvegarde simple (sans fichiers). La sauvegarde complète est dans noyau/sauvegarde.js. */
export async function exporter() {
  const [elements, meta] = await Promise.all([tout(), lireTout('meta')]);
  return { app: 'grenier', schema: VERSION_SCHEMA, exporte: new Date().toISOString(), elements, meta };
}

export async function demanderPersistance() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* rien */ }
  return false;
}
