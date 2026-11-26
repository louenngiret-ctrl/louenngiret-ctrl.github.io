// Dossiers épinglés : les dossiers et fichiers de l'appareil (PC, et téléphone avec Chrome 132 ou plus), ouverts
// directement dans My memories grâce à l'API File System Access. Sans serveur : chaque appareil voit ses propres
// épingles ; pour passer un fichier d'un appareil à l'autre, on le copie dans une page puis on fait un échange
// (Administration, Sauvegardes). Voir docs/DECISIONS.md (D13) et docs/SYNCHRO.md.
//
// Les poignées (handles) sont gardées dans la meta « pc.epingles » : elles sont propres à l'appareil et ne partent
// jamais dans les sauvegardes. Avant d'écraser ou de jeter un fichier du disque, sa version précédente est gardée
// dans My memories (versions « pc:… » ou corbeille), pour pouvoir la récupérer.
import * as store from './store.js';
import * as fichiers from './fichiers.js';

export const possible = () => 'showDirectoryPicker' in window;
const CLE = 'pc.epingles';
const GARDER = 10;
// Un File lu sur le disque reste lié au fichier : s'il est modifié ou jeté, la copie devient illisible.
// Tout ce que My memories garde est donc recopié en mémoire d'abord.
const enMemoire = async (f) => new File([await f.arrayBuffer()], f.name, { type: f.type, lastModified: f.lastModified });

export async function epingles() { return (await store.lireMeta(CLE).catch(() => null)) || []; }
async function ranger(l) { await store.ecrireMeta(CLE, l); }
export async function epingle(id) { return (await epingles()).find((e) => e.id === id) || null; }

export async function epinglerDossier() {
  const h = await window.showDirectoryPicker({ id: 'my-memories-epingles', mode: 'readwrite' });
  const l = await epingles();
  for (const e of l) if (e.genre === 'dossier' && (await e.handle.isSameEntry(h).catch(() => false))) return e;
  const e = { id: store.nouvelId(), nom: h.name, genre: 'dossier', handle: h, ajoute: Date.now() };
  await ranger([...l, e]);
  return e;
}
export async function epinglerFichiers() {
  const hs = await window.showOpenFilePicker({ id: 'my-memories-epingles', multiple: true });
  const l = await epingles(), neufs = [];
  for (const h of hs) {
    let deja = false;
    for (const e of l) if (e.genre === 'fichier' && (await e.handle.isSameEntry(h).catch(() => false))) deja = true;
    if (!deja) neufs.push({ id: store.nouvelId(), nom: h.name, genre: 'fichier', handle: h, ajoute: Date.now() });
  }
  await ranger([...l, ...neufs]);
  return neufs;
}
/** Retire l'épingle seulement : rien n'est touché sur le disque. */
export async function retirer(id) { await ranger((await epingles()).filter((e) => e.id !== id)); }

/** 'granted', 'prompt' ou 'denied'. demander=true seulement depuis un clic. */
export async function acces(h, demander = false) {
  let p = 'prompt';
  try { p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && demander) p = await h.requestPermission({ mode: 'readwrite' }); } catch (e) { p = 'denied'; }
  return p;
}

/** Le dossier au bout d'un chemin (noms séparés par /) à partir d'une épingle. */
export async function dossierAu(e, chemin) {
  let d = e.handle;
  for (const nom of chemin.split('/').filter(Boolean)) d = await d.getDirectoryHandle(nom);
  return d;
}
export const MAX = 600;
export async function entrees(dossier) {
  const l = [];
  for await (const [nom, h] of dossier.entries()) {
    if (l.length >= MAX + 1) break;
    if (h.kind === 'directory') l.push({ nom, genre: 'dossier', handle: h });
    else { let f = null; try { f = await h.getFile(); } catch (e) { /* fichier verrouillé */ } l.push({ nom, genre: 'fichier', handle: h, taille: f?.size ?? 0, modifie: f?.lastModified ?? 0, mime: f?.type || '' }); }
  }
  return l.sort((a, b) => (a.genre === b.genre ? a.nom.localeCompare(b.nom, 'fr', { numeric: true }) : a.genre === 'dossier' ? -1 : 1));
}

async function garderVersion(cible, fichier, raison) {
  await store.ecrire('versions', { id: store.nouvelId(), cible, date: Date.now(), raison, donnees: { nom: fichier.name, mime: fichier.type, blob: await enMemoire(fichier), modifie: fichier.lastModified } });
  const l = (await store.parIndex('versions', 'cible', cible)).sort((a, b) => b.date - a.date);
  if (l.length > GARDER) await store.lot(l.slice(GARDER).map((v) => ({ store: 'versions', op: 'del', cle: v.id })));
}
export const cibleDe = (epingleId, chemin) => `pc:${epingleId}:${chemin}`;
/** Écrit un contenu dans un fichier du disque ; l'ancien contenu est gardé dans My memories. */
export async function ecrire(fh, contenu, cible) {
  if ((await acces(fh, true)) !== 'granted') throw new Error('Accès refusé par le navigateur.');
  const avant = await fh.getFile().catch(() => null);
  if (avant && cible) await garderVersion(cible, avant, 'avant modification depuis My memories');
  const w = await fh.createWritable();
  await w.write(contenu); await w.close();
}
export async function versions(cible) { return (await store.parIndex('versions', 'cible', cible).catch(() => [])).sort((a, b) => b.date - a.date); }

const nomLibre = async (dossier, nom) => {
  const [b, ext] = /^(.*?)(\.[^.]*)?$/.exec(nom).slice(1);
  let n = nom, k = 2;
  for (;;) {
    try { await dossier.getFileHandle(n); } catch (e) { try { await dossier.getDirectoryHandle(n); } catch (e2) { return n; } }
    n = `${b} ${k++}${ext || ''}`;
  }
};
export async function creerFichier(dossier, nom, contenu = '') {
  const fh = await dossier.getFileHandle(await nomLibre(dossier, nom), { create: true });
  const w = await fh.createWritable(); await w.write(contenu); await w.close();
  return fh;
}
export async function creerDossier(dossier, nom) { return dossier.getDirectoryHandle(await nomLibre(dossier, nom), { create: true }); }
/** Copie des fichiers (File) dans un dossier du disque, sans jamais écraser : un nom pris reçoit un numéro. */
export async function deposer(dossier, liste) {
  const faits = [];
  for (const f of liste) faits.push(await creerFichier(dossier, f.name, f));
  return faits;
}
export const renommerPossible = (fh) => typeof fh.move === 'function';
export async function renommer(dossier, fh, nom) {
  const propre = String(nom).trim().replace(/[\\/:*?"<>|]/g, ' ').slice(0, 120);
  if (!propre) throw new Error('Nom vide.');
  let existe = false;
  try { await dossier.getFileHandle(propre); existe = true; } catch (e) { /* nom libre */ }
  if (existe) throw new Error(`« ${propre} » existe déjà ici.`);
  await fh.move(propre);
  return propre;
}
/** Jette un fichier du disque : une copie part d'abord dans la corbeille de My memories (récupérable). */
export async function jeter(dossier, nom) {
  const fh = await dossier.getFileHandle(nom);
  const f = await enMemoire(await fh.getFile());
  const copie = await fichiers.ajouterFichier('pc', f, 'jeté depuis un dossier épinglé');
  await fichiers.jeter(copie.id);
  await dossier.removeEntry(nom);
}
/** Copie un fichier du disque dans une page de My memories (il voyage alors avec les sauvegardes et les échanges). */
export async function copierDansPage(fh, pageId) { return fichiers.ajouterFichier(pageId, await enMemoire(await fh.getFile()), 'copié depuis un dossier épinglé'); }
