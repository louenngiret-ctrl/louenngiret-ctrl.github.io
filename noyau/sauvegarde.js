// Sauvegarde et restauration de My memories.
//  - Archive complète (.zip) : toutes les bases IndexedDB de l'appli (My memories, Carnet…), fichiers et photos compris,
//    plus le localStorage (réglages, Carnet, Loge, Suite). Rien n'est oublié, rien n'est envoyé nulle part.
//  - Points de restauration : des copies de la base principale gardées sur l'appareil (automatiques une fois par jour
//    quand quelque chose a changé, ou à la demande), pour revenir en arrière sans fichier.
//  - Sauvegarde automatique dans un dossier du PC (Chrome et Edge sur ordinateur) : une archive par jour.
// Format de l'archive : docs/SAUVEGARDE.md.
import * as store from './store.js';

const FORMAT = 'my-memories-sauvegarde';
const VERSION_FORMAT = 1;
const SAUTER_LS = new Set(['mm.appareil']); // propre à chaque appareil
const STORES_EXCLUS = { grenier: new Set(['journal']) }; // le journal est local à l'appareil
const AUTO_GARDER = 5;
const LOCALES = /^(pc\.|sauvegarde\.dossier)/; // réglages de la base qui ne quittent jamais l'appareil
const SUIVIS = ['elements', 'noeuds', 'fichiers', 'apps']; // ce que l'échange fusionne // points de restauration automatiques gardés
const DOSSIER_GARDER = 14; // archives gardées dans le dossier du PC
const jourDe = (t) => new Date(t).toISOString().slice(0, 10);
export const nomArchive = (t = Date.now()) => `My memories sauvegarde ${jourDe(t)}.zip`;

/* ---------- Emballer des valeurs IndexedDB en JSON (les Blob et octets partent en fichiers dans l'archive) ---------- */
function emballer(v, sacs) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) return null; // propre à l'appareil
  if (v instanceof Blob) { const ref = `octets/${sacs.length}`; sacs.push([ref, v]); return { $blob: ref, type: v.type, nom: v instanceof File ? v.name : undefined }; }
  if (v instanceof ArrayBuffer) { const ref = `octets/${sacs.length}`; sacs.push([ref, new Blob([v])]); return { $buffer: ref }; }
  if (ArrayBuffer.isView(v)) { const ref = `octets/${sacs.length}`; sacs.push([ref, new Blob([v])]); return { $vue: ref, classe: v.constructor.name }; }
  if (v instanceof Date) return { $date: v.toISOString() };
  if (Array.isArray(v)) return v.map((x) => emballer(x, sacs));
  if (v instanceof Map || v instanceof Set) return { $inconnu: Object.prototype.toString.call(v) };
  const o = {};
  for (const [k, x] of Object.entries(v)) o[k] = emballer(x, sacs);
  if ('$blob' in v || '$date' in v) return { $objet: o };
  return o;
}
const VUES = { Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray };
async function deballer(v, octets) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return Promise.all(v.map((x) => deballer(x, octets)));
  if (v.$blob) { const b = octets(v.$blob); return v.nom ? new File([b], v.nom, { type: v.type || '' }) : new Blob([b], { type: v.type || '' }); }
  if (v.$buffer) return octets(v.$buffer).buffer.slice(0);
  if (v.$vue) { const b = octets(v.$vue); const C = VUES[v.classe] || Uint8Array; return new C(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  if (v.$date) return new Date(v.$date);
  if (v.$objet) return deballerObjet(v.$objet, octets);
  return deballerObjet(v, octets);
}
async function deballerObjet(o, octets) { const r = {}; for (const [k, x] of Object.entries(o)) r[k] = await deballer(x, octets); return r; }

/* ---------- Lire et écrire une base IndexedDB quelconque ---------- */
const ouvrirBrut = (nom, version) => new Promise((ok, ko) => { const r = version ? indexedDB.open(nom, version) : indexedDB.open(nom); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); r.onblocked = () => ko(new Error(`La base « ${nom} » est utilisée par un autre onglet : ferme-le puis recommence.`)); });
async function lireBase(nom, sacs) {
  const db = await ouvrirBrut(nom);
  try {
    const exclus = STORES_EXCLUS[nom] || new Set();
    const noms = [...db.objectStoreNames].filter((s) => !exclus.has(s));
    const sortie = { nom, version: db.version, stores: [] };
    if (!noms.length) return sortie;
    const t = db.transaction(noms, 'readonly');
    for (const s of noms) {
      const os = t.objectStore(s);
      const schema = { nom: s, keyPath: os.keyPath, autoIncrement: os.autoIncrement, index: [...os.indexNames].map((i) => { const x = os.index(i); return { nom: i, keyPath: x.keyPath, unique: x.unique, multiEntry: x.multiEntry }; }), lignes: [] };
      await new Promise((ok, ko) => {
        const c = os.openCursor();
        c.onsuccess = () => { const cur = c.result; if (!cur) return ok(); if (nom === 'grenier' && s === 'versions' && String(cur.value?.cible).startsWith('point:')) { cur.continue(); return; } if (nom === 'grenier' && s === 'meta' && LOCALES.test(String(cur.value?.cle))) { cur.continue(); return; } // les points, les épingles et le dossier de sauvegarde restent sur l'appareil
          schema.lignes.push(os.keyPath == null ? [emballer(cur.key, sacs), emballer(cur.value, sacs)] : [null, emballer(cur.value, sacs)]); cur.continue(); };
        c.onerror = () => ko(c.error);
      });
      sortie.stores.push(schema);
    }
    return sortie;
  } finally { db.close(); }
}
async function ecrireBase(b, octets) {
  // la base principale est ouverte par store.js : on passe par sa connexion pour ne pas se bloquer soi-même
  const db = b.nom === 'grenier' ? null : await ouvrirBrut(b.nom).catch(() => null);
  let cible = db;
  const manquants = (d) => b.stores.filter((s) => !d.objectStoreNames.contains(s.nom));
  if (db && manquants(db).length) {
    const v = db.version + 1; db.close();
    cible = await new Promise((ok, ko) => {
      const r = indexedDB.open(b.nom, v);
      r.onupgradeneeded = () => { for (const s of manquants(r.result)) { const os = r.result.createObjectStore(s.nom, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement }); s.index.forEach((i) => os.createIndex(i.nom, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry })); } };
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  } else if (!db && b.nom !== 'grenier') {
    cible = await new Promise((ok, ko) => {
      const r = indexedDB.open(b.nom, b.version || 1);
      r.onupgradeneeded = () => { for (const s of b.stores) { const os = r.result.createObjectStore(s.nom, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement }); s.index.forEach((i) => os.createIndex(i.nom, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry })); } };
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  // déballer avant la transaction (une transaction IndexedDB ne survit pas à une attente)
  const lignes = [];
  for (const s of b.stores) lignes.push([s, await Promise.all(s.lignes.map(async ([k, v]) => [k == null ? undefined : await deballer(k, octets), await deballer(v, octets)]))]);
  const ecrire = (os, s, l) => { if (!(b.nom === 'grenier' && s.nom === 'versions')) os.clear(); // les anciennes versions et points de cet appareil restent
    for (const [k, v] of l) { if (s.keyPath == null) os.put(v, k); else os.put(v); } };
  if (b.nom === 'grenier') {
    const noms = lignes.map(([s]) => s.nom).filter((n) => store.STORES.includes(n));
    await store.tx(noms, 'readwrite', (ss, t) => { for (const [s, l] of lignes) if (noms.includes(s.nom)) ecrire(t.objectStore(s.nom), s, l); });
    return;
  }
  await new Promise((ok, ko) => {
    const noms = lignes.map(([s]) => s.nom).filter((n) => cible.objectStoreNames.contains(n));
    if (!noms.length) return ok();
    const t = cible.transaction(noms, 'readwrite');
    for (const [s, l] of lignes) if (noms.includes(s.nom)) ecrire(t.objectStore(s.nom), s, l);
    t.oncomplete = ok; t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
  });
  cible.close();
}

/* ---------- L'archive complète ---------- */
async function nomsDesBases() {
  if (indexedDB.databases) { try { return (await indexedDB.databases()).map((d) => d.name).filter(Boolean); } catch (e) { /* rien */ } }
  return ['grenier', 'carnet'];
}
export async function fabriquerArchive() {
  const sacs = [];
  const bases = [];
  for (const nom of await nomsDesBases()) bases.push(await lireBase(nom, sacs));
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!SAUTER_LS.has(k)) ls[k] = localStorage.getItem(k); }
  const version = await fetch('version.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.version).catch(() => '');
  const contenu = { format: FORMAT, versionFormat: VERSION_FORMAT, appli: version, exporte: new Date().toISOString(), appareil: store.appareil(), bases, localStorage: ls, suppressions: await suppressionsLocales() };
  const { zipSync, strToU8 } = await import('../vendor/fflate/fflate.js');
  const fichiers = { 'my-memories.json': strToU8(JSON.stringify(contenu)), 'LISEZMOI.txt': strToU8('Sauvegarde complète de My memories.\nPour la remettre : My memories, Administration, Sauvegardes, « Remettre une sauvegarde ».\nLe détail du format est dans docs/SAUVEGARDE.md du dépôt.\n') };
  for (const [ref, b] of sacs) fichiers[ref] = new Uint8Array(await b.arrayBuffer());
  const zip = zipSync(fichiers, { level: 1 });
  await store.ecrireMeta('sauvegarde.derniere', Date.now());
  return new Blob([zip], { type: 'application/zip' });
}

/** Lit une archive (.zip) ou une ancienne sauvegarde (.json, versions 0.x) et en donne un résumé avant de la remettre. */
export async function lireArchive(fichier) {
  const octetsDe = new Map();
  let contenu;
  if (/\.json$/i.test(fichier.name) || fichier.type === 'application/json') {
    const j = JSON.parse(await fichier.text());
    if (j.app !== 'grenier' || !Array.isArray(j.elements)) throw new Error('Ce fichier JSON n’est pas une sauvegarde My memories.');
    contenu = { format: FORMAT, ancienne: true, exporte: j.exporte, bases: [{ nom: 'grenier', version: 1, stores: [
      { nom: 'elements', keyPath: 'id', lignes: j.elements.map((e) => [null, e]) }, { nom: 'meta', keyPath: 'cle', lignes: (j.meta || []).map((m) => [null, m]) }] }], localStorage: null };
  } else {
    const { unzipSync, strFromU8 } = await import('../vendor/fflate/fflate.js');
    const z = unzipSync(new Uint8Array(await fichier.arrayBuffer()));
    if (!z['my-memories.json']) throw new Error('Cette archive n’est pas une sauvegarde My memories (my-memories.json manque).');
    contenu = JSON.parse(strFromU8(z['my-memories.json']));
    if (contenu.format !== FORMAT) throw new Error('Format de sauvegarde inconnu.');
    if (contenu.versionFormat > VERSION_FORMAT) throw new Error('Cette sauvegarde vient d’une version plus récente de My memories : mets l’appli à jour d’abord.');
    for (const [k, v] of Object.entries(z)) if (k.startsWith('octets/')) octetsDe.set(k, v);
  }
  const compter = (nom, s) => contenu.bases.find((b) => b.nom === nom)?.stores.find((x) => x.nom === s)?.lignes.length || 0;
  return {
    contenu, octets: (ref) => { const o = octetsDe.get(ref); if (!o) throw new Error(`Morceau manquant dans l’archive : ${ref}`); return o; },
    resume: { date: contenu.exporte, appli: contenu.appli, ancienne: !!contenu.ancienne, elements: compter('grenier', 'elements'), pages: compter('grenier', 'noeuds'), fichiers: compter('grenier', 'fichiers'), apps: compter('grenier', 'apps'), bases: contenu.bases.map((b) => b.nom), reglages: contenu.localStorage ? Object.keys(contenu.localStorage).length : 0 },
  };
}
/** Remplace les données de cet appareil par l'archive. Un point de restauration est pris juste avant. */
export async function remettreArchive(lu) {
  await prendrePoint('avant de remettre une sauvegarde', { manuel: true });
  for (const b of lu.contenu.bases) {
    if (lu.contenu.ancienne) {
      // ancienne sauvegarde : seulement les éléments et les réglages, l'arbre et le reste sont gardés
      const [el, me] = b.stores;
      const lignes = { elements: await Promise.all(el.lignes.map(([, v]) => v)), meta: me.lignes.map(([, v]) => v) };
      await store.tx(['elements', 'meta'], 'readwrite', ([se, sm]) => { se.clear(); lignes.elements.forEach((v) => se.put(v)); lignes.meta.forEach((v) => sm.put(v)); });
    } else await ecrireBase(b, lu.octets);
  }
  if (lu.contenu.localStorage) {
    const garder = new Map([...SAUTER_LS].map((k) => [k, localStorage.getItem(k)]));
    localStorage.clear();
    for (const [k, v] of Object.entries(lu.contenu.localStorage)) localStorage.setItem(k, v);
    garder.forEach((v, k) => { if (v != null) localStorage.setItem(k, v); });
  }
}

/* ---------- Points de restauration (sur l'appareil) ---------- */
const STORES_POINT = ['elements', 'meta', 'noeuds', 'fichiers'];
export async function prendrePoint(raison = 'à la demande', { manuel = false } = {}) {
  const donnees = {};
  await store.tx(STORES_POINT, 'readonly', async (ss) => { await Promise.all(ss.map(async (s, i) => { donnees[STORES_POINT[i]] = await store.req(s.getAll()); })); });
  donnees.meta = donnees.meta.filter((m) => !String(m.cle).startsWith('sauvegarde.') && !LOCALES.test(String(m.cle)));
  const seq = await store.tx('journal', 'readonly', (s) => store.req(s.openCursor(null, 'prev')).then((c) => c?.key || 0));
  const p = { id: store.nouvelId(), cible: manuel ? 'point:manuel' : 'point:auto', date: Date.now(), raison, seq, donnees, resume: { notes: donnees.elements.length, pages: donnees.noeuds.length, fichiers: donnees.fichiers.length } };
  await store.ecrire('versions', p);
  if (!manuel) {
    const l = (await store.parIndex('versions', 'cible', 'point:auto')).sort((a, b) => b.date - a.date);
    if (l.length > AUTO_GARDER) await store.lot(l.slice(AUTO_GARDER).map((v) => ({ store: 'versions', op: 'del', cle: v.id })));
  }
  return p;
}
export async function points() {
  const [a, m] = await Promise.all([store.parIndex('versions', 'cible', 'point:auto'), store.parIndex('versions', 'cible', 'point:manuel')]);
  return [...a, ...m].map(({ id, cible, date, raison, resume }) => ({ id, manuel: cible === 'point:manuel', date, raison, resume })).sort((x, y) => y.date - x.date);
}
export async function revenirAuPoint(id) {
  const p = await store.lire('versions', id);
  if (!p || !String(p.cible).startsWith('point:')) throw new Error('Point de restauration introuvable');
  await prendrePoint('avant de revenir à un point de restauration', { manuel: true });
  await store.tx(STORES_POINT, 'readwrite', (ss) => {
    ss.forEach((s, i) => {
      const nom = STORES_POINT[i];
      if (nom === 'meta') { p.donnees.meta.forEach((m) => s.put(m)); return; } // les réglages de sauvegarde restent
      s.clear(); p.donnees[nom].forEach((v) => s.put(v));
    });
  });
}
export const effacerPoint = (id) => store.effacer('versions', id);

/* ---------- Sauvegarde automatique ---------- */
export const dossierPossible = () => 'showDirectoryPicker' in window;
export async function choisirDossier() {
  const h = await window.showDirectoryPicker({ id: 'my-memories-sauvegardes', mode: 'readwrite', startIn: 'documents' });
  await store.ecrireMeta('sauvegarde.dossier', h);
  await store.ecrireMeta('sauvegarde.dossierNom', h.name);
  return h;
}
export async function oublierDossier() { await store.ecrireMeta('sauvegarde.dossier', null); await store.ecrireMeta('sauvegarde.dossierNom', null); }
export async function etatDossier() {
  const h = await store.lireMeta('sauvegarde.dossier').catch(() => null);
  if (!h) return { branche: false };
  let permission = 'prompt';
  try { permission = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { /* navigateur sans File System Access */ }
  return { branche: true, nom: h.name, permission, derniere: await store.lireMeta('sauvegarde.dossierDerniere') };
}
/** Écrit l'archive du jour dans le dossier choisi. demander=true seulement depuis un geste (clic). */
export async function ecrireDansDossier({ demander = false } = {}) {
  const h = await store.lireMeta('sauvegarde.dossier');
  if (!h) throw new Error('Aucun dossier choisi');
  let p = await h.queryPermission({ mode: 'readwrite' });
  if (p !== 'granted' && demander) p = await h.requestPermission({ mode: 'readwrite' });
  if (p !== 'granted') return { ecrit: false, raison: 'permission' };
  const blob = await fabriquerArchive();
  const nom = nomArchive();
  const f = await h.getFileHandle(nom, { create: true });
  const w = await f.createWritable(); await w.write(blob); await w.close();
  await store.ecrireMeta('sauvegarde.dossierDerniere', Date.now());
  // ne garder que les dernières archives de My memories (le reste du dossier n'est jamais touché)
  const miennes = [];
  for await (const [n, x] of h.entries()) if (x.kind === 'file' && /^My memories sauvegarde \d{4}-\d{2}-\d{2}\.zip$/.test(n)) miennes.push(n);
  miennes.sort().reverse().slice(DOSSIER_GARDER).forEach((n) => h.removeEntry(n).catch(() => {}));
  return { ecrit: true, nom, taille: blob.size };
}
/** Au démarrage : un point de restauration par jour si quelque chose a changé, et l'archive du jour dans le dossier du PC. */
export async function auto() {
  try {
    const dernier = (await store.parIndex('versions', 'cible', 'point:auto')).sort((a, b) => b.date - a.date)[0];
    const seq = await store.tx('journal', 'readonly', (s) => store.req(s.openCursor(null, 'prev')).then((c) => c?.key || 0));
    if ((!dernier || Date.now() - dernier.date > 20 * 3600e3) && seq > (dernier?.seq || 0)) await prendrePoint('automatique, une fois par jour');
    const d = await etatDossier();
    if (d.branche && d.permission === 'granted' && (!d.derniere || jourDe(d.derniere) !== jourDe(Date.now()))) await ecrireDansDossier();
  } catch (e) { console.warn('Sauvegarde automatique :', e); }
}

/* ---------- Échange entre appareils, sans serveur : fusionner une archive au lieu de tout remplacer ---------- */
/** Les suppressions faites sur cet appareil (dans le journal), la plus récente par objet. */
async function suppressionsLocales() {
  const j = await store.lireTout('journal').catch(() => []), m = new Map();
  for (const x of j) {
    if (!SUIVIS.includes(x.store)) continue;
    const k = `${x.store}|${x.cle}`;
    if (x.op === 'del') m.set(k, { store: x.store, cle: x.cle, date: x.date });
    else if (m.has(k) && x.date >= m.get(k).date) m.delete(k); // recréé depuis
  }
  return [...m.values()];
}
/** Même contenu à la date près ? (seulement pour ce qui n'a pas de fichier dedans) */
function pareil(nomStore, a, b) {
  if (nomStore === 'fichiers' || nomStore === 'apps' || a.fichier instanceof Blob || b.fichier instanceof Blob) return false;
  const net = (o) => JSON.stringify(Object.keys(o).filter((k) => k !== 'modifie' && k !== 'cree').sort().map((k) => [k, o[k]]));
  return net(a) === net(b);
}
const CIBLE = { elements: 'element', noeuds: 'noeud', fichiers: 'fichier', apps: 'app' };
const APPAREIL_LS = /^(mm\.|grenier\.(barre|ambiance|decor|meteo))/; // réglages d'affichage propres à chaque appareil
/**
 * Fusionne l'archive avec cet appareil : pour chaque page, note, fichier ou app, la version la plus récente gagne
 * (l'autre est gardée dans les anciennes versions) ; ce qui a été supprimé ailleurs après sa dernière modification
 * ici est supprimé (et gardé en version). Rien n'est perdu. Un point de restauration est pris avant.
 * autres=true : Carnet, Loge, Suite et leurs réglages sont pris de l'archive (remplacés, ils ne se fusionnent pas).
 */
export async function fusionnerArchive(lu, { autres = false } = {}) {
  if (lu.contenu.ancienne) throw new Error('Une ancienne sauvegarde (.json) ne peut que remplacer.');
  await prendrePoint('avant un échange', { manuel: true });
  const base = lu.contenu.bases.find((b) => b.nom === 'grenier');
  const bilan = { ajoutes: 0, remplaces: 0, supprimes: 0, gardes: 0 };
  const tombesIci = new Map((await suppressionsLocales()).map((x) => [`${x.store}|${x.cle}`, x]));
  const ops = [], t = Date.now();
  const garder = (nomStore, obj, raison) => ops.push({ store: 'versions', op: 'put', obj: { id: store.nouvelId(), cible: `${CIBLE[nomStore]}:${obj.id}`, date: t, raison, donnees: obj } });
  const locaux = {};
  for (const s of SUIVIS) locaux[s] = new Map((await store.lireTout(s).catch(() => [])).map((x) => [x.id, x]));
  const dejaVersions = new Set((await store.lireTout('versions').catch(() => [])).map((x) => x.id));
  for (const s of base?.stores || []) {
    if (SUIVIS.includes(s.nom)) {
      for (const [, brut] of s.lignes) {
        const v = await deballer(brut, lu.octets), ici = locaux[s.nom].get(v.id);
        if (!ici) {
          const tombe = tombesIci.get(`${s.nom}|${v.id}`);
          if (tombe && tombe.date >= (v.modifie || 0)) { bilan.gardes++; continue; } // supprimé ici après sa dernière modification là-bas
          ops.push({ store: s.nom, op: 'put', obj: v }); bilan.ajoutes++;
        } else if (pareil(s.nom, v, ici)) bilan.gardes++; // même contenu, seule la date diffère (ex. graine copiée sur chaque appareil)
        else if ((v.modifie || 0) > (ici.modifie || 0)) {
          garder(s.nom, ici, 'remplacé par un échange'); ops.push({ store: s.nom, op: 'put', obj: v }); bilan.remplaces++;
        } else bilan.gardes++;
      }
    } else if (s.nom === 'versions') {
      // les anciennes versions venues de l'autre appareil s'ajoutent, sans doublon
      for (const [, brut] of s.lignes) { const v = await deballer(brut, lu.octets); if (!dejaVersions.has(v.id)) ops.push({ store: 'versions', op: 'put', obj: v }); }
    }
  }
  for (const tb of lu.contenu.suppressions || []) {
    if (!SUIVIS.includes(tb.store)) continue;
    const ici = locaux[tb.store].get(tb.cle);
    if (ici && (ici.modifie || 0) <= tb.date) { garder(tb.store, ici, 'supprimé sur l’autre appareil'); ops.push({ store: tb.store, op: 'del', cle: tb.cle }); bilan.supprimes++; }
  }
  if (ops.length) await store.lot(ops);
  if (autres) {
    for (const b of lu.contenu.bases) if (b.nom !== 'grenier') await ecrireBase(b, lu.octets);
    if (lu.contenu.localStorage) for (const [k, v] of Object.entries(lu.contenu.localStorage)) if (!APPAREIL_LS.test(k)) localStorage.setItem(k, v);
  }
  return bilan;
}
