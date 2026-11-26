// La barre de navigation du Grenier : toujours au même endroit, comme dans un logiciel.
// Accueil en haut, Explorer, Rechercher, Paramètres, et Tableau de bord tout en bas.
// À gauche sur PC, en bas sur téléphone ; déplaçable (poignée ou Paramètres), une place par type d'écran.
// Réglage sur l'appareil : localStorage « grenier.barre » { pc, tel, noms, ouverts }.
import * as store from './store.js';
import { MALLES } from './malles.js';

const CLE = 'grenier.barre';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const large = matchMedia('(min-width: 760px)');
const PLACES = [['gauche', 'À gauche'], ['droite', 'À droite'], ['haut', 'En haut'], ['bas', 'En bas']];

function lire() {
  let r = {};
  try { r = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { r = {}; }
  return { pc: 'gauche', tel: 'bas', noms: true, ouverts: { maison: true }, ...r };
}
function ecrire(patch) {
  const r = { ...lire(), ...patch };
  try { localStorage.setItem(CLE, JSON.stringify(r)); } catch (e) { /* plein */ }
  return r;
}
const placeActuelle = () => { const r = lire(); const p = large.matches ? r.pc : r.tel; return PLACES.some(([id]) => id === p) ? p : (large.matches ? 'gauche' : 'bas'); };
function placer(p) { ecrire(large.matches ? { pc: p } : { tel: p }); appliquer(); }
function appliquer() {
  const h = document.documentElement, r = lire();
  h.dataset.rail = placeActuelle();
  h.dataset.railNoms = r.noms ? '1' : '0';
}

/* ---------- L'arborescence des malles ---------- */
// lien : une malle qui existe ; sinon « à venir ».
const lienMalle = (id) => { const m = MALLES.find((x) => x.id === id); return m ? (m.lien || `#/malle/${id}`) : null; };
const ARBRE = [
  { id: 'maison', nom: 'La maison', couleur: '#6b8f5e', enfants: [
    { nom: 'Achats et courses', lien: lienMalle('achats') }, { nom: 'Garde-robe', lien: lienMalle('garde-robe') },
    { nom: 'Repas et recettes' }, { nom: 'Ménage et lessive' }, { nom: 'Le logement' }] },
  { id: 'moi', nom: 'Moi', couleur: '#8a5a7a', enfants: [
    { nom: 'La Loge', lien: lienMalle('loge') }, { nom: 'Habitudes et humeur' }, { nom: 'Journal' }] },
  { id: 'etudes', nom: 'Les études', couleur: '#4f6e8f', enfants: [
    { nom: 'Cours et Suite BTS', lien: lienMalle('cours') }, { nom: 'Emploi du temps' }, { nom: 'Fiches de révision' }, { nom: 'Films à voir' }] },
  { id: 'creation', nom: 'La création', couleur: '#b3261e', enfants: [{ nom: 'Projets Fragmate' }, { nom: 'Idées et inspirations' }] },
  { id: 'papiers', nom: 'Argent et papiers', couleur: '#9a6a34', enfants: [{ nom: 'Budget du mois' }, { nom: 'Démarches et rendez-vous' }] },
];
const RACINE = [{ nom: 'Boîte à trier', lien: '#/boite' }, { nom: 'Cabinet de curiosités', lien: '#/cabinet' }];

function feuilleArbre(f) {
  return f.lien
    ? `<li><a class="arbre-ligne" href="${esc(f.lien)}"><span class="arbre-malle" aria-hidden="true"></span><span>${esc(f.nom)}</span></a></li>`
    : `<li><span class="arbre-ligne avenir"><span class="arbre-malle" aria-hidden="true"></span><span>${esc(f.nom)}</span><span class="tampon-avenir">à venir</span></span></li>`;
}
function vueExplorer() {
  const ouverts = lire().ouverts || {};
  return `<p class="panneau-note">Toutes tes malles, rangées par pièce du grenier.</p>
  <ul class="arbre">${ARBRE.map((d) => `<li>
    <button type="button" class="arbre-ligne dossier" data-dossier="${d.id}" aria-expanded="${!!ouverts[d.id]}" style="--pastille:${d.couleur}">
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg><span class="arbre-dossier" aria-hidden="true"></span><span>${esc(d.nom)}</span>
    </button>
    <ul ${ouverts[d.id] ? '' : 'hidden'}>${d.enfants.map(feuilleArbre).join('')}</ul></li>`).join('')}
    ${RACINE.map(feuilleArbre).join('')}</ul>`;
}

/* ---------- Rechercher : dans toutes les malles, sur l'appareil ---------- */
const CHAMPS = ['titre', 'nom', 'name', 'title', 'label', 'texte', 'text', 'marque', 'categorie'];
const libelle = (o) => { for (const k of CHAMPS) if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim(); return ''; };
const plat = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
async function sources() {
  const l = [];
  MALLES.filter((m) => m.etat !== 'vide').forEach((m) => l.push({ t: m.nom, ou: 'Malle', lien: m.lien || (m.id === 'boite' ? '#/boite' : `#/malle/${m.id}`) }));
  ARBRE.forEach((d) => d.enfants.filter((f) => !f.lien).forEach((f) => l.push({ t: f.nom, ou: 'Malle à venir', lien: null })));
  const els = await store.tout().catch(() => []);
  els.forEach((e) => {
    const t = libelle(e); if (!t) return;
    const m = MALLES.find((x) => x.id === e.malle);
    l.push({ t, ou: m ? m.nom : (e.malle === 'agenda' ? 'Calendrier' : e.malle), lien: e.malle === 'boite' ? '#/boite' : e.malle === 'agenda' ? '#/' : (m && m.lien) || '#/' });
  });
  try {
    const c = JSON.parse(localStorage.getItem('carnet.state') || 'null');
    if (c) {
      (Array.isArray(c.items) ? c.items : []).forEach((i) => { const t = libelle(i); if (t) l.push({ t, ou: 'Achats et courses', lien: lienMalle('achats') }); });
      (c.wr && Array.isArray(c.wr.pieces) ? c.wr.pieces : []).forEach((i) => { const t = libelle(i); if (t) l.push({ t, ou: 'Garde-robe', lien: lienMalle('garde-robe') }); });
    }
  } catch (e) { /* Carnet illisible */ }
  return l;
}
let cache = null;
async function chercher(q) {
  const p = plat(q.trim());
  const res = $('#rail-resultats');
  if (!res) return;
  if (!p) { res.innerHTML = ''; return; }
  cache ||= await sources();
  const t = cache.filter((x) => plat(x.t).includes(p)).slice(0, 40);
  res.innerHTML = t.length
    ? `<p class="panneau-note" role="status">${t.length === 40 ? 'Les 40 premiers résultats' : `${t.length} trouvé${t.length > 1 ? 's' : ''}`}</p><ul class="resultats">${t.map((x) => `<li>${x.lien ? `<a href="${esc(x.lien)}">` : '<span class="avenir">'}<b>${esc(x.t.length > 80 ? `${x.t.slice(0, 80)}…` : x.t)}</b><small>${esc(x.ou)}</small>${x.lien ? '</a>' : '</span>'}</li>`).join('')}</ul>`
    : `<p class="panneau-note" role="status">Rien ne contient « ${esc(q.trim())} ».</p>`;
}
function vueRecherche() {
  return `<label class="champ-recherche"><span>Chercher dans tout le Grenier</span>
    <input type="search" id="rail-q" autocomplete="off" placeholder="Une course, une pièce, une note…" enterkeyhint="search"></label>
    <div id="rail-resultats"></div>`;
}

/* ---------- Paramètres ---------- */
function vueParametres() {
  const p = placeActuelle(), r = lire();
  return `<fieldset class="rail-places"><legend>La barre ${large.matches ? 'sur cet écran large' : 'sur ce téléphone'}</legend>
    <div class="rail-places-grille">${PLACES.map(([id, nom]) => `<button type="button" data-place="${id}" aria-pressed="${p === id}">${nom}</button>`).join('')}</div></fieldset>
    <button type="button" class="rail-interrupteur" data-noms aria-pressed="${r.noms}"><span>Noms sous les icônes</span><span class="inter" aria-hidden="true"></span></button>
    <ul class="rail-liens">
      <li><a href="#/deco">Atelier de déco</a></li><li><a href="#/reglages">Ambiance, tuiles et sauvegarde</a></li>
      <li><a href="#/cabinet">Cabinet de curiosités</a></li><li><a href="#/nouveautes">Quoi de neuf</a></li>
    </ul>`;
}

/* ---------- Le panneau ---------- */
const TITRES = { explorer: 'Explorer', recherche: 'Rechercher', parametres: 'Paramètres' };
let ouvert = null;
function ouvrir(nom) {
  const pan = $('#panneau');
  if (ouvert === nom) return fermer();
  ouvert = nom;
  pan.innerHTML = `<div class="panneau-tete"><h2 id="panneau-titre">${TITRES[nom]}</h2>
    <button type="button" class="panneau-fermer" data-fermer aria-label="Fermer le panneau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="panneau-corps">${nom === 'explorer' ? vueExplorer() : nom === 'recherche' ? vueRecherche() : vueParametres()}</div>`;
  pan.hidden = false; $('#panneau-fond').hidden = false;
  majOnglets();
  if (nom === 'recherche') { cache = null; setTimeout(() => $('#rail-q')?.focus(), 30); }
  else $('#panneau-titre').tabIndex = -1, $('#panneau-titre').focus({ preventScroll: true });
}
function fermer(rendreFocus = true) {
  const avant = ouvert;
  ouvert = null;
  $('#panneau').hidden = true; $('#panneau-fond').hidden = true;
  majOnglets();
  if (rendreFocus && avant) $(`.rail [data-panneau="${avant}"]`)?.focus();
}
function majOnglets() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0];
  document.querySelectorAll('.rail-onglet').forEach((b) => {
    if (b.dataset.panneau) { b.setAttribute('aria-expanded', String(ouvert === b.dataset.panneau)); b.classList.toggle('actif', ouvert === b.dataset.panneau); return; }
    const ici = !ouvert && (b.dataset.route === 'accueil' ? route === 'accueil' : route === '');
    b.classList.toggle('actif', ici);
    if (ici) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

/* ---------- Déplacer : glisser la poignée vers un bord, ou toucher une des quatre places ---------- */
function montrerPlaces() {
  const v = $('#rail-placer');
  v.innerHTML = `<p>Glisse la barre vers un bord, ou touche une des quatre places.</p>${PLACES.map(([id, nom]) => `<button type="button" class="place-${id}" data-place="${id}" aria-pressed="${placeActuelle() === id}">${nom}</button>`).join('')}
    <button type="button" class="place-annuler" data-place-annuler>Laisser où elle est</button>`;
  v.hidden = false;
  v.querySelector(`[data-place="${placeActuelle()}"]`)?.focus();
}
function cacherPlaces() { $('#rail-placer').hidden = true; }
function brancherPoignee(b) {
  let depart = null, glisse = false;
  b.addEventListener('pointerdown', (e) => { depart = [e.clientX, e.clientY]; glisse = false; b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointermove', (e) => {
    if (!depart) return;
    if (!glisse && Math.hypot(e.clientX - depart[0], e.clientY - depart[1]) > 12) { glisse = true; document.documentElement.classList.add('rail-glisse'); montrerPlaces(); }
    if (glisse) {
      const p = bordProche(e.clientX, e.clientY);
      document.querySelectorAll('#rail-placer [data-place]').forEach((x) => x.classList.toggle('vise', x.dataset.place === p));
    }
  });
  const fin = (e) => {
    if (!depart) return;
    if (glisse) { placer(bordProche(e.clientX, e.clientY)); cacherPlaces(); navigator.vibrate?.(10); }
    document.documentElement.classList.remove('rail-glisse');
    depart = null;
  };
  b.addEventListener('pointerup', fin);
  b.addEventListener('pointercancel', () => { depart = null; document.documentElement.classList.remove('rail-glisse'); });
  b.addEventListener('click', () => { if (!glisse) montrerPlaces(); });
}
function bordProche(x, y) {
  const w = innerWidth, h = innerHeight;
  const d = { gauche: x / w, droite: (w - x) / w, haut: y / h, bas: (h - y) / h };
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
}

/* ---------- Installation ---------- */
const ICONES = {
  accueil: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  explorer: '<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h6"/><path d="M8 14h8M8 17h5"/>',
  recherche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
  parametres: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  tableau: '<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[n]}</svg>`;

export function installerNavigation() {
  appliquer();
  const nav = document.createElement('nav');
  nav.className = 'rail'; nav.setAttribute('aria-label', 'Navigation du Grenier');
  nav.innerHTML = `<button type="button" class="rail-poignee" aria-label="Déplacer la barre"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1.8"/><circle cx="16" cy="6" r="1.8"/><circle cx="8" cy="12" r="1.8"/><circle cx="16" cy="12" r="1.8"/><circle cx="8" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/></svg></button>
    <a class="rail-onglet" data-route="accueil" href="#/accueil">${ico('accueil')}<span>Accueil</span></a>
    <button type="button" class="rail-onglet" data-panneau="explorer" aria-controls="panneau" aria-expanded="false">${ico('explorer')}<span>Explorer</span></button>
    <button type="button" class="rail-onglet" data-panneau="recherche" aria-controls="panneau" aria-expanded="false">${ico('recherche')}<span class="nom-long">Rechercher</span><span class="nom-court" aria-hidden="true">Chercher</span></button>
    <button type="button" class="rail-onglet" data-panneau="parametres" aria-controls="panneau" aria-expanded="false">${ico('parametres')}<span class="nom-long">Paramètres</span><span class="nom-court" aria-hidden="true">Réglages</span></button>
    <span class="rail-espace" aria-hidden="true"></span>
    <a class="rail-onglet" data-route="tableau" href="#/">${ico('tableau')}<span class="nom-long">Tableau de bord</span><span class="nom-court" aria-hidden="true">Tableau</span></a>`;
  const pan = document.createElement('aside');
  pan.id = 'panneau'; pan.className = 'panneau'; pan.hidden = true; pan.setAttribute('aria-labelledby', 'panneau-titre');
  const fond = document.createElement('div');
  fond.id = 'panneau-fond'; fond.className = 'panneau-fond'; fond.hidden = true;
  const placer_ = document.createElement('div');
  placer_.id = 'rail-placer'; placer_.className = 'rail-placer'; placer_.hidden = true; placer_.setAttribute('role', 'dialog'); placer_.setAttribute('aria-label', 'Placer la barre');
  document.body.prepend(nav, pan, fond, placer_);

  brancherPoignee($('.rail-poignee', nav));
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-panneau]');
    if (b) return ouvrir(b.dataset.panneau);
    if (e.target.closest('a.rail-onglet')) fermer(false);
  });
  fond.addEventListener('click', () => fermer());
  pan.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
  placer_.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cacherPlaces(); $('.rail-poignee').focus(); } });
  placer_.addEventListener('click', (e) => {
    const p = e.target.closest('[data-place]');
    if (p) { placer(p.dataset.place); cacherPlaces(); $('.rail-poignee').focus(); return; }
    if (e.target.closest('[data-place-annuler]') || e.target === placer_) { cacherPlaces(); $('.rail-poignee').focus(); }
  });
  pan.addEventListener('click', (e) => {
    if (e.target.closest('[data-fermer]')) return fermer();
    const d = e.target.closest('[data-dossier]');
    if (d) {
      const o = { ...(lire().ouverts || {}) }; o[d.dataset.dossier] = !o[d.dataset.dossier]; ecrire({ ouverts: o });
      d.setAttribute('aria-expanded', String(o[d.dataset.dossier])); d.nextElementSibling.hidden = !o[d.dataset.dossier];
      return;
    }
    const p = e.target.closest('[data-place]');
    if (p) { placer(p.dataset.place); pan.querySelectorAll('[data-place]').forEach((x) => x.setAttribute('aria-pressed', String(x === p))); return; }
    const n = e.target.closest('[data-noms]');
    if (n) { const v = !lire().noms; ecrire({ noms: v }); appliquer(); n.setAttribute('aria-pressed', String(v)); return; }
    if (e.target.closest('a[href]')) fermer(false);
  });
  let attente = 0;
  pan.addEventListener('input', (e) => { if (e.target.id === 'rail-q') { clearTimeout(attente); attente = setTimeout(() => chercher(e.target.value), 140); } });
  large.addEventListener?.('change', () => { appliquer(); if (ouvert === 'parametres') { ouvert = null; ouvrir('parametres'); } });
  window.addEventListener('hashchange', () => { if (ouvert) fermer(false); else majOnglets(); });
  majOnglets();
}
