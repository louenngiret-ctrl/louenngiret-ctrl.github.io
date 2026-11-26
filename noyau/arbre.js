// L'arborescence de My memories : toutes les pages, dossiers, liens et applications, rangés en arbre.
// Gardée dans IndexedDB (store « noeuds »), modifiable dans l'administration (#/admin), lue par les menus,
// l'Explorer, Rechercher et Ressources. Chaque modification garde l'ancienne version (store « versions »).
//
// Un nœud : { id, parent, ordre, type, nom, desc, sticker?, icone?, couleur?, encre?, taille?, fond?, dentelle?,
//             deco?, lien?, app?, epingle?, corbeille?, parentAvant?, systeme?, cree, modifie }
//   type « dossier » : un menu de sous-pages ; « page » : une page (carnet de notes, blocs plus tard) ;
//   « lien » : renvoie vers une adresse (#/… ou page de l'appli) ; « app » : ouvre une application (noyau/apps.js).
import * as store from './store.js';
import { GRAINE, APPS_DE_GRAINE } from './plan.js';

export const RACINE = 'racine';
const VERSION_GRAINE = 2;
let cache = null; // Map id -> nœud

const maintenant = () => Date.now();
const prevenir = () => window.dispatchEvent(new CustomEvent('mm:arbre'));

function graine() {
  const t = maintenant(), l = [{ id: RACINE, parent: null, ordre: 0, type: 'dossier', nom: 'My memories', systeme: true, cree: t, modifie: t }];
  GRAINE.forEach((sec, i) => {
    const { sous, ...reste } = sec;
    l.push({ ...reste, parent: RACINE, ordre: i, type: 'dossier', cree: t, modifie: t });
    sous.forEach((so, j) => {
      const id = `${sec.id}/${so.id}`, app = APPS_DE_GRAINE[id];
      const n = { id, parent: sec.id, ordre: j, nom: so.nom, desc: so.desc, sticker: so.sticker, cree: t, modifie: t };
      if (app) Object.assign(n, { type: 'app', app });
      else if (so.lien) Object.assign(n, { type: 'lien', lien: so.lien });
      else n.type = 'page';
      l.push(n);
    });
  });
  return l;
}

/** Charge l'arbre (et le crée à partir de la graine la première fois). */
export async function charger(force = false) {
  if (cache && !force) return cache;
  let l = await store.lireTout('noeuds').catch(() => []);
  if (!l.length) {
    const g = graine();
    await store.lot(g.map((obj) => ({ store: 'noeuds', op: 'put', obj })));
    await store.ecrireMeta('arbre.graine', VERSION_GRAINE);
    l = g;
  }
  cache = new Map(l.map((n) => [n.id, n]));
  await completerGraine();
  return cache;
}
/** Les ajouts de la graine après la 1.0 arrivent chez qui a déjà son arborescence, sans rien déplacer. */
async function completerGraine() {
  const v = (await store.lireMeta('arbre.graine').catch(() => 1)) || 1;
  if (v >= VERSION_GRAINE) return;
  const t = maintenant(), ops = [];
  // 1.1 : Dossiers épinglés, dans Gestion et administration (si ce dossier existe encore)
  if (v < 2 && !cache.has('gestion/dossiers') && cache.get('gestion') && !cache.get('gestion').corbeille) {
    ops.push({ store: 'noeuds', op: 'put', obj: { id: 'gestion/dossiers', parent: 'gestion', ordre: enfants('gestion').length, type: 'lien', lien: '#/pc', nom: 'Dossiers épinglés', desc: 'Les dossiers et fichiers de cet appareil, ouverts depuis My memories.', sticker: 'chat-aile', cree: t, modifie: t } });
  }
  if (ops.length) await store.lot(ops);
  await store.ecrireMeta('arbre.graine', VERSION_GRAINE);
  if (ops.length) cache = new Map((await store.lireTout('noeuds')).map((n) => [n.id, n]));
}
export const pret = () => !!cache;
export const noeud = (id) => cache?.get(id) || null;
export const tous = () => [...(cache?.values() || [])];
const parOrdre = (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.nom).localeCompare(String(b.nom), 'fr');
export const enfants = (id, avecCorbeille = false) => tous().filter((n) => n.parent === id && (avecCorbeille || !n.corbeille)).sort(parOrdre);
export const corbeille = () => tous().filter((n) => n.corbeille).sort((a, b) => b.modifie - a.modifie);
/** Les ancêtres, de la racine (exclue) au nœud (inclus). */
export function chemin(id) {
  const l = []; let n = noeud(id), garde = 0;
  while (n && n.id !== RACINE && garde++ < 50) { l.unshift(n); n = noeud(n.parent); }
  return l;
}
/** La grande page (premier niveau) qui contient ce nœud. */
export const grandePage = (id) => chemin(id)[0] || null;
/** Couleurs héritées : un nœud sans couleur prend celle de son parent. */
export function couleurs(id) {
  for (const n of chemin(id).reverse()) if (n.couleur) return { couleur: n.couleur, encre: n.encre || encreSur(n.couleur) };
  return { couleur: '#5d4a3b', encre: '#fff3dc' };
}
/** Texte clair ou foncé selon la couleur de fond (contraste lisible). */
export function encreSur(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff3dc';
  const v = parseInt(m[1], 16), c = [v >> 16, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return L > 0.36 ? '#231a1f' : '#fff3dc';
}
export const descendants = (id) => { const l = []; const f = (p) => enfants(p, true).forEach((n) => { l.push(n); f(n.id); }); f(id); return l; };
/** L'adresse d'un nœud dans l'appli. */
export function lienDe(n) {
  if (!n) return '#/accueil';
  if (n.type === 'lien') return n.lien || '#/accueil';
  if (n.type === 'app') return `#/app/${encodeURIComponent(n.app)}`;
  return `#/n/${n.id}`;
}

/* ---------- Modifier (chaque changement garde l'ancienne version) ---------- */
function versionDe(n, raison) { return { store: 'versions', op: 'put', obj: { id: store.nouvelId(), cible: `noeud:${n.id}`, date: maintenant(), raison, donnees: n } }; }
async function enregistrer(ops) { await store.lot(ops); await charger(true); prevenir(); }

const slug = (s) => String(s || 'page').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'page';
export async function creer(champs) {
  const parent = champs.parent || RACINE;
  if (!noeud(parent)) throw new Error('Dossier parent introuvable');
  let base = `${parent === RACINE ? '' : `${parent}/`}${slug(champs.nom)}`, id = base, k = 2;
  while (noeud(id)) id = `${base}-${k++}`;
  const t = maintenant();
  const n = { type: 'page', ...champs, id, parent, ordre: enfants(parent).length, cree: t, modifie: t };
  await enregistrer([{ store: 'noeuds', op: 'put', obj: n }]);
  return n;
}
export async function modifierNoeud(id, patch, raison = 'modification') {
  const n = noeud(id); if (!n) throw new Error('Page introuvable');
  const nv = { ...n, ...patch, id: n.id, modifie: maintenant() };
  await enregistrer([versionDe(n, raison), { store: 'noeuds', op: 'put', obj: nv }]);
  return nv;
}
/** Déplace un nœud dans un autre dossier (à la fin) ou à une position donnée. */
export async function deplacer(id, parent, position = null) {
  const n = noeud(id); if (!n || n.systeme) throw new Error('Impossible de déplacer cet élément');
  if (id === parent || descendants(id).some((d) => d.id === parent)) throw new Error('Une page ne peut pas aller dans ses propres sous-pages');
  const freres = enfants(parent).filter((x) => x.id !== id);
  const pos = position == null ? freres.length : Math.max(0, Math.min(position, freres.length));
  freres.splice(pos, 0, { ...n, parent });
  const ops = [versionDe(n, 'déplacement')];
  // la date suit l'ordre : un réordonnancement passe aussi dans les échanges
  freres.forEach((f, i) => { const o = f.id === id ? { ...n, parent, ordre: i, modifie: maintenant() } : { ...f, ordre: i, modifie: maintenant() }; if (f.id === id || f.ordre !== i) ops.push({ store: 'noeuds', op: 'put', obj: o }); });
  await enregistrer(ops);
}
export async function decaler(id, sens) {
  const n = noeud(id); if (!n) return;
  const freres = enfants(n.parent), i = freres.findIndex((x) => x.id === id);
  await deplacer(id, n.parent, Math.max(0, i + sens));
}
export async function mettreCorbeille(id) {
  const n = noeud(id); if (!n || n.systeme) throw new Error('Impossible de supprimer cet élément');
  await enregistrer([versionDe(n, 'corbeille'), { store: 'noeuds', op: 'put', obj: { ...n, corbeille: true, parentAvant: n.parent, modifie: maintenant() } }]);
}
export async function restaurer(id) {
  const n = noeud(id); if (!n) return;
  const parent = noeud(n.parentAvant || n.parent) && !noeud(n.parentAvant || n.parent).corbeille ? (n.parentAvant || n.parent) : RACINE;
  const { corbeille: _c, parentAvant: _p, ...propre } = n;
  await enregistrer([{ store: 'noeuds', op: 'put', obj: { ...propre, parent, ordre: enfants(parent).length, modifie: maintenant() } }]);
}
/** Efface pour de bon un nœud de la corbeille et ses sous-pages. Les notes et fichiers des pages restent dans Ressources. */
export async function effacerDefinitivement(id) {
  const n = noeud(id); if (!n || !n.corbeille) throw new Error('Seul un élément de la corbeille peut être effacé');
  const l = [n, ...descendants(id)];
  await enregistrer([...l.map((x) => versionDe(x, 'effacement')), ...l.map((x) => ({ store: 'noeuds', op: 'del', cle: x.id }))]);
}
/** Les anciennes versions d'un nœud, la plus récente d'abord. */
export async function versions(id) {
  const l = await store.parIndex('versions', 'cible', `noeud:${id}`).catch(() => []);
  return l.sort((a, b) => b.date - a.date);
}
export async function revenirA(versionId) {
  const v = await store.lire('versions', versionId); if (!v) throw new Error('Version introuvable');
  const actuel = noeud(v.donnees.id);
  const ops = [{ store: 'noeuds', op: 'put', obj: { ...v.donnees, modifie: maintenant() } }];
  if (actuel) ops.unshift(versionDe(actuel, 'avant retour en arrière'));
  await enregistrer(ops);
}
/** Remet l'arborescence de départ. L'arbre actuel est gardé en version (store « versions », cible « arbre »). */
export async function remettreGraine() {
  const actuel = tous();
  await store.ecrire('versions', { id: store.nouvelId(), cible: 'arbre', date: maintenant(), raison: 'avant retour à l’arborescence de départ', donnees: actuel });
  const g = graine();
  await enregistrer([...actuel.map((n) => ({ store: 'noeuds', op: 'del', cle: n.id })), ...g.map((obj) => ({ store: 'noeuds', op: 'put', obj }))]);
}
export async function arbresGardes() {
  return (await store.parIndex('versions', 'cible', 'arbre').catch(() => [])).sort((a, b) => b.date - a.date);
}
export async function remettreArbre(versionId) {
  const v = await store.lire('versions', versionId); if (!v || v.cible !== 'arbre') throw new Error('Arborescence introuvable');
  const actuel = tous();
  await store.ecrire('versions', { id: store.nouvelId(), cible: 'arbre', date: maintenant(), raison: 'avant retour à une arborescence gardée', donnees: actuel });
  await enregistrer([...actuel.map((n) => ({ store: 'noeuds', op: 'del', cle: n.id })), ...v.donnees.map((obj) => ({ store: 'noeuds', op: 'put', obj }))]);
}

/** La page où vit un élément (sa « malle ») : pour Rechercher et Ressources. */
const AUTRES = { pc: { nom: 'Dossiers épinglés', lien: '#/pc' }, boite: { nom: 'Boîte à trier', lien: '#/boite' }, agenda: { nom: 'Tableau de bord', lien: '#/' }, capture: { nom: 'Boîte à trier', lien: '#/boite' } };
export function pageDe(malle) {
  const n = noeud(malle);
  if (n && !n.corbeille) return { nom: n.nom, lien: lienDe(n), noeud: n };
  if (String(malle).startsWith('app:')) { const id = malle.slice(4); const a = tous().find((x) => x.type === 'app' && x.app === id); return { nom: a?.nom || id, lien: `#/app/${encodeURIComponent(id)}`, noeud: a || null }; }
  return AUTRES[malle] || { nom: 'Boîte à trier', lien: '#/boite' };
}
export const grandePageDe = (malle) => (noeud(malle) ? grandePage(malle) : null);
export const epingles = () => tous().filter((n) => n.epingle && !n.corbeille).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
