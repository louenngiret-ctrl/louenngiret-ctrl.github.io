// Les applications de My memories : celles qui sont livrées avec l'appli (intégrées) et celles que Louenn ajoute.
// Une app ajoutée = un dossier (ou un .zip) avec un manifeste « app.json » et ses fichiers. Elle est gardée dans
// IndexedDB (store « apps », fichiers compris) et tourne isolée dans un cadre (noyau/hote.js) : elle ne voit les
// données de My memories qu'à travers le SDK, et seulement ce que ses permissions autorisent. Voir docs/APPS.md.
import * as store from './store.js';

/** Applications livrées avec My memories (pages existantes du dépôt). Elles s'ouvrent en pleine page. */
export const INTEGREES = [
  { id: 'achats', nom: 'Achats et courses', description: 'Listes, panier, envies (Carnet).', entree: 'malles/carnet/index.html#/home', icone: 'i080' },
  { id: 'armoire', nom: 'Armoire', description: 'Vêtements, tenues, atelier (Carnet).', entree: 'malles/carnet/index.html#/armoire', icone: 'i094' },
  { id: 'loge', nom: 'Loge', description: 'Coiffure, make-up, soins, ongles, piercings.', entree: 'malles/loge/index.html#soin', icone: 'i091' },
  { id: 'cours', nom: 'Cours', description: 'Le BTS Audiovisuel et la Suite de cours.', entree: 'malles/cours/index.html', icone: 'i108' },
].map((a) => ({ ...a, integree: true, version: 'livrée', permissions: [] }));

/** Ce que chaque permission autorise, en clair : c'est ce que Louenn lit avant d'installer. */
export const PERMISSIONS = {
  'notes:lire': 'lire les notes des pages',
  'notes:ecrire': 'ajouter, modifier et jeter des notes dans les pages',
  'arbre:lire': 'voir la liste des pages et des dossiers',
  'fichiers:lire': 'ouvrir les fichiers rangés dans les pages',
  'fichiers:ecrire': 'ranger de nouveaux fichiers dans les pages',
  reseau: 'se connecter à internet',
};
export const MATERIEL = { camera: 'utiliser la caméra', micro: 'utiliser le micro' };
const ID_OK = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RESERVES = new Set([...INTEGREES.map((a) => a.id), 'admin', 'accueil', 'modele-vide']);
const MIME = {
  html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', wasm: 'application/wasm', glb: 'model/gltf-binary',
};
export const mimeDe = (chemin) => MIME[(chemin.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
export const TAILLE_MAX = 60 * 1024 * 1024; // une app au-delà de 60 Mo n'a rien à faire dans le stockage du navigateur

export async function installees() { return (await store.lireTout('apps').catch(() => [])).sort((a, b) => a.manifeste.nom.localeCompare(b.manifeste.nom, 'fr')); }
export async function trouver(id) {
  const i = INTEGREES.find((a) => a.id === id);
  if (i) return { id, integree: true, manifeste: i };
  return store.lire('apps', id).catch(() => null);
}
/** Toutes les apps (intégrées puis ajoutées), sous une forme simple pour les listes. */
export async function toutes() {
  return [...INTEGREES.map((m) => ({ id: m.id, integree: true, manifeste: m })), ...(await installees())];
}

/* ---------- Lire un paquet : un .zip ou les fichiers d'un dossier ---------- */
/** fichiers : [{ chemin, blob }] ; retourne { manifeste, fichiers, erreurs, avertissements }. */
export async function lirePaquet(fichiers) {
  const erreurs = [], avertissements = [];
  // retirer le dossier commun (« mon-app/app.json » → « app.json »)
  const propres = fichiers.filter((f) => f.chemin && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/.test(f.chemin)).map((f) => ({ ...f, chemin: f.chemin.replace(/\\/g, '/').replace(/^\.?\//, '') }));
  const man = propres.filter((f) => /(^|\/)app\.json$/.test(f.chemin)).sort((a, b) => a.chemin.split('/').length - b.chemin.split('/').length)[0];
  if (!man) return { erreurs: ['Le paquet n’a pas de fichier app.json : c’est lui qui présente l’app (voir l’app modèle).'], avertissements, fichiers: [] };
  const prefixe = man.chemin.slice(0, man.chemin.length - 'app.json'.length);
  const garde = propres.filter((f) => f.chemin.startsWith(prefixe)).map((f) => ({ chemin: f.chemin.slice(prefixe.length), blob: f.blob }));
  let m;
  try { m = JSON.parse(await man.blob.text()); } catch (e) { return { erreurs: [`app.json est illisible : ${e.message}`], avertissements, fichiers: [] }; }
  if (!m || typeof m !== 'object') return { erreurs: ['app.json doit contenir un objet.'], avertissements, fichiers: [] };
  const id = String(m.id || '').trim();
  if (!ID_OK.test(id)) erreurs.push('« id » doit faire 2 à 40 caractères : lettres minuscules, chiffres et tirets (ex. « mon-armoire »).');
  if (RESERVES.has(id)) erreurs.push(`L’identifiant « ${id} » est déjà pris par My memories.`);
  if (!String(m.nom || '').trim()) erreurs.push('« nom » manque : c’est le nom affiché dans les menus.');
  const entree = String(m.entree || 'index.html').replace(/^\.?\//, '');
  if (!garde.some((f) => f.chemin === entree)) erreurs.push(`Le fichier d’entrée « ${entree} » n’est pas dans le paquet.`);
  const permissions = Array.isArray(m.permissions) ? m.permissions : [];
  permissions.filter((p) => !PERMISSIONS[p]).forEach((p) => avertissements.push(`Permission inconnue ignorée : « ${p} ».`));
  const materiel = Array.isArray(m.materiel) ? m.materiel : [];
  materiel.filter((p) => !MATERIEL[p]).forEach((p) => avertissements.push(`Matériel inconnu ignoré : « ${p} ».`));
  const taille = garde.reduce((s, f) => s + f.blob.size, 0);
  if (taille > TAILLE_MAX) erreurs.push(`L’app pèse ${(taille / 1048576).toFixed(1)} Mo : 60 Mo au plus.`);
  if (m.icone && !/^i\d{3}$/.test(m.icone) && !garde.some((f) => f.chemin === m.icone)) avertissements.push(`L’icône « ${m.icone} » n’est pas dans le paquet : l’icône par défaut sera utilisée.`);
  const manifeste = {
    id, nom: String(m.nom || '').trim().slice(0, 60), version: String(m.version || '1.0.0').slice(0, 20), entree,
    description: String(m.description || '').slice(0, 240), icone: m.icone || null, categorie: m.categorie || null,
    permissions: permissions.filter((p) => PERMISSIONS[p]), materiel: materiel.filter((p) => MATERIEL[p]),
  };
  return { manifeste, fichiers: garde.map((f) => ({ chemin: f.chemin, mime: f.blob.type && f.blob.type !== 'application/octet-stream' ? f.blob.type : mimeDe(f.chemin), blob: f.blob })), erreurs, avertissements, taille };
}

/** Lit un .zip (fflate, embarqué dans vendor/). */
export async function lireZip(fichier) {
  const { unzipSync } = await import('../vendor/fflate/fflate.js');
  const brut = unzipSync(new Uint8Array(await fichier.arrayBuffer()));
  return Object.entries(brut).filter(([chemin]) => !chemin.endsWith('/')).map(([chemin, octets]) => ({ chemin, blob: new Blob([octets], { type: mimeDe(chemin) }) }));
}

/** Installe (ou met à jour) une app. L'ancienne version est gardée dans « versions » pour pouvoir y revenir. */
export async function installer(paquet) {
  const { manifeste, fichiers } = paquet;
  const avant = await store.lire('apps', manifeste.id).catch(() => null);
  const t = Date.now();
  const rec = { id: manifeste.id, manifeste, fichiers, permissions: manifeste.permissions, installe: avant?.installe || t, modifie: t };
  const ops = [{ store: 'apps', op: 'put', obj: rec }];
  if (avant) ops.unshift({ store: 'versions', op: 'put', obj: { id: store.nouvelId(), cible: `app:${manifeste.id}`, date: t, raison: `avant la version ${manifeste.version}`, donnees: avant } });
  await store.lot(ops);
  window.dispatchEvent(new CustomEvent('mm:apps'));
  return { rec, miseAJour: !!avant };
}
/** Désinstalle : l'app part dans les versions (récupérable), ses données restent sauf demande contraire. */
export async function desinstaller(id, { effacerDonnees = false } = {}) {
  const avant = await store.lire('apps', id);
  if (!avant) return;
  const ops = [
    { store: 'versions', op: 'put', obj: { id: store.nouvelId(), cible: `app:${id}`, date: Date.now(), raison: 'désinstallation', donnees: avant } },
    { store: 'apps', op: 'del', cle: id },
  ];
  if (effacerDonnees) (await store.parMalle(`app:${id}`)).forEach((e) => ops.push({ store: 'elements', op: 'del', cle: e.id }));
  await store.lot(ops);
  window.dispatchEvent(new CustomEvent('mm:apps'));
}
export async function anciennesVersions(id) { return (await store.parIndex('versions', 'cible', `app:${id}`).catch(() => [])).sort((a, b) => b.date - a.date); }
export async function remettreVersion(versionId) {
  const v = await store.lire('versions', versionId);
  if (!v || !String(v.cible).startsWith('app:')) throw new Error('Version introuvable');
  const actuelle = await store.lire('apps', v.donnees.id).catch(() => null);
  const ops = [{ store: 'apps', op: 'put', obj: { ...v.donnees, modifie: Date.now() } }];
  if (actuelle) ops.unshift({ store: 'versions', op: 'put', obj: { id: store.nouvelId(), cible: v.cible, date: Date.now(), raison: 'avant retour en arrière', donnees: actuelle } });
  await store.lot(ops);
  window.dispatchEvent(new CustomEvent('mm:apps'));
}
/** Refait un .zip d'une app installée (pour la modifier sur le PC ou la donner). */
export async function exporterZip(id) {
  const a = await store.lire('apps', id);
  const { zipSync, strToU8 } = await import('../vendor/fflate/fflate.js');
  const contenu = {};
  for (const f of a.fichiers) contenu[f.chemin] = new Uint8Array(await f.blob.arrayBuffer());
  if (!contenu['app.json']) contenu['app.json'] = strToU8(JSON.stringify(a.manifeste, null, 2));
  return new Blob([zipSync(contenu, { level: 6 })], { type: 'application/zip' });
}
/** L'app modèle, livrée dans le dépôt (exemples/app-modele) : l'installer montre tout le système en vrai. */
export const MODELE = ['app.json', 'index.html', 'app.js', 'outils/format.js', 'style.css', 'icone.svg', 'LISEZMOI.md'];
export async function paquetModele() {
  const base = new URL('../exemples/app-modele/', import.meta.url);
  const fichiers = await Promise.all(MODELE.map(async (chemin) => {
    const r = await fetch(new URL(chemin, base));
    if (!r.ok) throw new Error(`${chemin} introuvable (${r.status})`);
    return { chemin, blob: await r.blob() };
  }));
  return lirePaquet(fichiers);
}
