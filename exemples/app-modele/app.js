// L'app modèle de My memories. Tout passe par l'objet global « mm » (le SDK), fourni par My memories.
// Chaque appel renvoie une promesse ; une action non permise est refusée avec une erreur claire.
import { formater } from './outils/format.js';

const $ = (s) => document.querySelector(s);

async function majCompteur() {
  $('#compte').value = (await mm.stockage.lire('compte')) ?? 0;
}
$('#plus').addEventListener('click', async () => {
  const n = ((await mm.stockage.lire('compte')) ?? 0) + 1;
  await mm.stockage.ecrire('compte', n);
  await majCompteur();
  if (n % 5 === 0) mm.ui.toast(`${n} fois, bravo`);
});
$('#zero').addEventListener('click', async () => { await mm.stockage.effacer('compte'); await majCompteur(); });

async function majPages() {
  const pages = (await mm.arbre.lister()).filter((n) => n.type === 'page');
  $('#page').innerHTML = pages.map((p) => `<option value="${p.id}">${p.nom}</option>`).join('');
  await majNotes();
}
async function majNotes() {
  const id = $('#page').value;
  if (!id) return;
  const notes = await mm.notes.lister(id);
  $('#notes').innerHTML = notes.slice(0, 5).map((n) => `<li>${formater(n.texte)}</li>`).join('') || '<li>Aucune note dans cette page.</li>';
}
$('#page').addEventListener('change', majNotes);
$('#noter').addEventListener('click', async () => {
  const t = $('#note').value.trim();
  if (!t) return;
  await mm.notes.ajouter($('#page').value, t);
  $('#note').value = '';
  mm.ui.toast('Note rangée par l’app modèle');
  await majNotes();
});
mm.ecouter('arbre', majPages); // l'arborescence a changé dans l'administration

$('#infos').textContent = JSON.stringify({ app: mm.app, permissions: await mm.permissions(), theme: await mm.theme() }, null, 2);
await majCompteur();
await majPages();
