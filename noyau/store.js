// Stockage du Grenier : une base IndexedDB « grenier ».
// Chaque élément rangé suit le modèle commun décrit dans la Bible :
// { id, malle, type, titre, texte, cree, modifie, etiquettes: [], liens: [] }

const NOM = 'grenier';
const VERSION_SCHEMA = 1;

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
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return ouvrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let res;
    Promise.resolve(fn(s)).then((v) => { res = v; });
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

export const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export async function ajouter(partiel) {
  const maintenant = Date.now();
  const el = { id: nouvelId(), type: 'note', titre: '', texte: '', etiquettes: [], liens: [], cree: maintenant, modifie: maintenant, ...partiel };
  await tx('elements', 'readwrite', (s) => s.put(el));
  return el;
}

export async function modifier(id, changements) {
  return tx('elements', 'readwrite', async (s) => {
    const el = await req(s.get(id));
    if (!el) return null;
    const maj = { ...el, ...changements, modifie: Date.now() };
    s.put(maj);
    return maj;
  });
}

export const supprimer = (id) => tx('elements', 'readwrite', (s) => s.delete(id));

export async function parMalle(malle) {
  const liste = await tx('elements', 'readonly', (s) => req(s.index('malle').getAll(malle)));
  return (liste || []).sort((a, b) => b.cree - a.cree);
}

export const tout = () => tx('elements', 'readonly', (s) => req(s.getAll()));

export const lireMeta = (cle) => tx('meta', 'readonly', (s) => req(s.get(cle))).then((r) => (r ? r.valeur : undefined));
export const ecrireMeta = (cle, valeur) => tx('meta', 'readwrite', (s) => s.put({ cle, valeur }));

export async function exporter() {
  const [elements, meta] = await Promise.all([tout(), tx('meta', 'readonly', (s) => req(s.getAll()))]);
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
