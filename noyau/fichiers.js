// Les fichiers rangés dans les pages : importer, ouvrir, télécharger, renommer, modifier (texte), jeter.
// Gardés dans IndexedDB (store « fichiers », le contenu en Blob). Chaque modification ou suppression garde
// l'ancienne version dans « versions » (cible « fichier:<id> »), pour pouvoir revenir en arrière.
import * as store from './store.js';

export const TEXTE = /^(text\/|application\/(json|xml|javascript))|\.(txt|md|csv|json|html?|css|js|mjs|xml|svg|srt|vtt|ini|log)$/i;
export const estTexte = (f) => TEXTE.test(f.mime || '') || TEXTE.test(f.nom || '');
export const GARDER = 15; // anciennes versions gardées par fichier

const maintenant = () => Date.now();
async function garderVersion(f, raison) {
  await store.ecrire('versions', { id: store.nouvelId(), cible: `fichier:${f.id}`, date: maintenant(), raison, donnees: f });
  const l = (await store.parIndex('versions', 'cible', `fichier:${f.id}`)).sort((a, b) => b.date - a.date);
  if (l.length > GARDER) await store.lot(l.slice(GARDER).map((v) => ({ store: 'versions', op: 'del', cle: v.id })));
}
export async function lister(parent, { corbeille = false } = {}) {
  return (await store.parIndex('fichiers', 'parent', parent).catch(() => [])).filter((f) => !!f.corbeille === corbeille).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
export async function ajouterFichier(parent, fichier, source = 'import') {
  const t = maintenant();
  let nom = fichier.name || 'fichier';
  const deja = new Set((await lister(parent)).map((f) => f.nom));
  if (deja.has(nom)) { const [b, e] = /^(.*?)(\.[^.]*)?$/.exec(nom).slice(1); let k = 2; while (deja.has(`${b} ${k}${e || ''}`)) k++; nom = `${b} ${k}${e || ''}`; }
  const f = { id: store.nouvelId(), parent, nom, mime: fichier.type || '', taille: fichier.size, blob: fichier, source, cree: t, modifie: t };
  await store.ecrire('fichiers', f);
  return f;
}
export async function creerTexte(parent, nom, contenu = '') {
  const n = /\.[a-z0-9]{1,5}$/i.test(nom) ? nom : `${nom}.txt`;
  return ajouterFichier(parent, new File([contenu], n, { type: n.endsWith('.md') ? 'text/markdown' : 'text/plain' }), 'créé');
}
export async function renommer(id, nom) {
  const f = await store.lire('fichiers', id); if (!f) throw new Error('Fichier introuvable');
  await garderVersion(f, 'avant renommage');
  await store.ecrire('fichiers', { ...f, nom: String(nom).trim().slice(0, 120) || f.nom, modifie: maintenant() });
}
export async function remplacerContenu(id, contenu, mime) {
  const f = await store.lire('fichiers', id); if (!f) throw new Error('Fichier introuvable');
  await garderVersion(f, 'avant modification');
  const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type: mime || f.mime || 'text/plain' });
  await store.ecrire('fichiers', { ...f, blob, taille: blob.size, mime: blob.type || f.mime, modifie: maintenant() });
}
export async function jeter(id) {
  const f = await store.lire('fichiers', id); if (!f) return;
  await store.ecrire('fichiers', { ...f, corbeille: true, modifie: maintenant() });
}
export async function recuperer(id) {
  const f = await store.lire('fichiers', id); if (!f) return;
  const { corbeille: _c, ...propre } = f;
  await store.ecrire('fichiers', { ...propre, modifie: maintenant() });
}
export async function effacerDefinitivement(id) {
  const f = await store.lire('fichiers', id); if (!f || !f.corbeille) throw new Error('Seul un fichier de la corbeille peut être effacé');
  const vs = await store.parIndex('versions', 'cible', `fichier:${id}`);
  await store.lot([{ store: 'fichiers', op: 'del', cle: id }, ...vs.map((v) => ({ store: 'versions', op: 'del', cle: v.id }))]);
}
export async function corbeille() { return (await store.lireTout('fichiers').catch(() => [])).filter((f) => f.corbeille).sort((a, b) => b.modifie - a.modifie); }
export async function versions(id) { return (await store.parIndex('versions', 'cible', `fichier:${id}`).catch(() => [])).sort((a, b) => b.date - a.date); }
export async function revenirA(versionId) {
  const v = await store.lire('versions', versionId); if (!v) throw new Error('Version introuvable');
  const actuel = await store.lire('fichiers', v.donnees.id);
  if (actuel) await garderVersion(actuel, 'avant retour en arrière');
  await store.ecrire('fichiers', { ...v.donnees, corbeille: actuel?.corbeille, modifie: maintenant() });
}
export function telecharger(f) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f.blob); a.download = f.nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
export const poids = (o) => (o < 1024 ? `${o} o` : o < 1048576 ? `${Math.round(o / 1024)} Ko` : `${(o / 1048576).toFixed(1)} Mo`);
