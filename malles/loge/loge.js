// La Loge : coiffure, make-up, soins, ongles, piercings, tatouages.
// Données : IndexedDB « grenier », malle 'loge', type = id de l'onglet (voir noyau/store.js).
import * as store from '../../noyau/store.js';
import { $, $$, esc, toast, compresserPhoto, urlPhoto, libererPhotos, appliquerAmbiance, JOUR, aujourdhui } from '../../noyau/outils.js';
import { PAO, CATEGORIES, ZONES, ZONES_TATOUAGE, SOURCES } from './donnees.js';

appliquerAmbiance();

/* ---------- Dessins à l'encre (un par rayon) ---------- */
const DESSINS = {
  coiffure: '<path d="M18 12c4 10 4 22-2 34M46 12c-4 10-4 22 2 34"/><circle cx="20" cy="50" r="6"/><circle cx="44" cy="50" r="6"/><path d="M24 46l16-14M40 46L24 32"/>',
  makeup: '<rect x="24" y="34" width="16" height="22" rx="2"/><path d="M26 34V24h12v10"/><path d="M28 24l2-12 6 4-1 8"/><path d="M24 44h16"/>',
  soin: '<path d="M24 26h16v28a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z"/><path d="M28 26v-6h8v6M32 20v-6h10M42 14v4"/><path d="M28 38h8"/>',
  ongles: '<path d="M24 32h16v20a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z"/><path d="M28 32V20h8v12"/><path d="M30 20l2-10 2 10"/><path d="M28 44c2 2 6 2 8 0"/>',
  piercing: '<circle cx="32" cy="34" r="16"/><circle cx="32" cy="18" r="4"/><path d="M20 40c4 6 20 6 24 0"/>',
  tatouage: '<path d="M32 52S14 40 14 26a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 14-18 26-18 26z"/><path d="M8 34h48l-4 6 4 6H8l4-6z"/>',
};

/* ---------- Les six rayons ---------- */
const MATIERES = ['Titane', 'Or 14 carats ou plus', 'Niobium', 'Acier chirurgical', 'Autre'];
const MOMENTS = ['Matin', 'Soir', 'Matin et soir', 'De temps en temps'];
const champsPao = [
  { k: 'typePao', label: 'Type de produit', type: 'select', options: Object.keys(PAO) },
  { k: 'mois', label: 'Durée après ouverture (mois, lire le pot ouvert sur l’emballage)', type: 'number' },
  { k: 'ouverture', label: 'Ouvert le', type: 'date' },
];
const ONGLETS = [
  { id: 'coiffure', nom: 'Coiffure', scene: 'Le miroir', ajouter: 'Ajouter une coiffure', vide: 'Aucune coiffure pour l’instant. Ajoute une inspiration, puis essaie-la sur ton visage.',
    champs: [{ k: 'photo', label: 'Photo', type: 'photo' }, { k: 'titre', label: 'Nom', type: 'text', ph: 'Carré flou, wolf cut…' }, { k: 'categorie', label: 'Rangement', type: 'select', options: CATEGORIES.coiffure }, { k: 'lien', label: 'Lien (tuto, coiffeur…)', type: 'url' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
  { id: 'makeup', nom: 'Make-up', scene: 'L’étagère', ajouter: 'Ajouter un produit', vide: 'L’étagère est vide. Ajoute ton premier produit : mascara, rouge, fond de teint…',
    champs: [{ k: 'titre', label: 'Produit', type: 'text', ph: 'Mascara volume…' }, { k: 'marque', label: 'Marque', type: 'text' }, { k: 'categorie', label: 'Rayon', type: 'select', options: CATEGORIES.makeup }, { k: 'couleur', label: 'Teinte', type: 'color' }, { k: 'nuance', label: 'Nom de la teinte', type: 'text' }, ...champsPao, { k: 'photo', label: 'Photo', type: 'photo' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
  { id: 'soin', nom: 'Soins', scene: 'La routine', ajouter: 'Ajouter un soin', vide: 'Aucun soin pour l’instant. Ajoute tes produits et dis quand tu les utilises : ta routine se range toute seule.',
    champs: [{ k: 'titre', label: 'Produit', type: 'text', ph: 'Crème hydratante…' }, { k: 'marque', label: 'Marque', type: 'text' }, { k: 'categorie', label: 'Type', type: 'select', options: CATEGORIES.soin }, { k: 'moment', label: 'Dans la routine', type: 'select', options: MOMENTS }, ...champsPao, { k: 'photo', label: 'Photo', type: 'photo' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
  { id: 'ongles', nom: 'Ongles', scene: 'Le nuancier', ajouter: 'Ajouter un vernis', vide: 'Le nuancier est vide. Ajoute tes vernis et tes idées de nail art.',
    champs: [{ k: 'titre', label: 'Nom', type: 'text' }, { k: 'marque', label: 'Marque', type: 'text' }, { k: 'categorie', label: 'Rangement', type: 'select', options: CATEGORIES.ongles }, { k: 'couleur', label: 'Couleur', type: 'color' }, { k: 'photo', label: 'Photo', type: 'photo' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
  { id: 'piercing', nom: 'Piercings', scene: 'La carte', ajouter: 'Ajouter un piercing', vide: 'Aucun piercing noté. Ajoute-les pour suivre leur cicatrisation et tes bijoux.',
    champs: [{ k: 'zone', label: 'Emplacement', type: 'select', options: ZONES.map((z) => z.nom) }, { k: 'date', label: 'Fait le', type: 'date' }, { k: 'bijou', label: 'Bijou', type: 'text', ph: 'Anneau 8 mm, labret…' }, { k: 'matiere', label: 'Matière', type: 'select', options: MATIERES }, { k: 'studio', label: 'Studio ou perceur', type: 'text' }, { k: 'photo', label: 'Photo', type: 'photo' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
  { id: 'tatouage', nom: 'Tatouages', scene: 'Le carnet de flash', ajouter: 'Ajouter un tatouage', vide: 'Le carnet de flash est vide. Garde ici tes idées, tes projets et ceux déjà faits.',
    champs: [{ k: 'photo', label: 'Dessin ou photo', type: 'photo' }, { k: 'titre', label: 'Motif', type: 'text', ph: 'Hirondelle, ronces…' }, { k: 'categorie', label: 'Où en est-il', type: 'select', options: CATEGORIES.tatouage }, { k: 'zone', label: 'Emplacement', type: 'select', options: ZONES_TATOUAGE }, { k: 'artiste', label: 'Artiste ou studio', type: 'text' }, { k: 'taille', label: 'Taille', type: 'text', ph: '7 cm…' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }] },
];
const onglet = (id) => ONGLETS.find((o) => o.id === id);

/* ---------- Décor : miroir à ampoules ---------- */
(function ampoules() {
  const s = $('.ampoules');
  const pts = [];
  for (let i = 0; i < 5; i++) pts.push([42 + i * 54, 10]);
  for (let i = 1; i < 4; i++) { pts.push([10, 10 + i * 50]); pts.push([290, 10 + i * 50]); }
  s.innerHTML = pts.map(([x, y]) => `<circle class="halo" cx="${x}" cy="${y}" r="16"/><circle class="ampoule" cx="${x}" cy="${y}" r="6.5"/>`).join('');
})();

/* ---------- Décor de chaque rayon (images de Louenn découpées) ---------- */
const A = (n) => `../../assets/loge/${n}.webp`;
const DECORS = {
  coiffure: { mur: 'mur-coiffure', gauche: [['tete-mannequin', 1.15], ['peigne', 0.38]], droite: [['lampe-champignon', 1], ['boite-coeur', 0.42]], haut: [['lanterne-rose', 0.5, 9], ['suspension-verte', 0.42, 84]], murs: [['lune-chat', 0.62, 6, 30]] },
  makeup: { mur: 'mur-makeup', gauche: [['trousse', 0.5], ['atomiseur', 0.72]], droite: [['lampe-tiffany', 1.05], ['flacon-rose', 0.6], ['boite-papillon', 0.4]], haut: [['lanterne-orange', 0.5, 86]], murs: [['etoile-or', 0.42, 4, 30]] },
  soin: { mur: 'mur-soins', gauche: [['plante', 0.75], ['pichet', 0.62]], droite: [['bougie', 0.5], ['tasse', 0.36], ['vase-rond', 0.6]], haut: [['lanterne-bleue', 0.48, 10]], murs: [['feuille-chene', 0.34, 84, 30]] },
  ongles: { mur: 'mur-ongles', gauche: [['lampe-lotus', 0.85], ['verres', 0.55]], droite: [['assiette', 0.4], ['boite-papillons', 0.42]], haut: [['lustre-dore', 0.62, 88]], murs: [['etoile-spirale', 0.26, 6, 32]] },
  piercing: { mur: 'mur-piercing', gauche: [['buste', 0.85]], droite: [['flacon-bleu', 0.7], ['lampe-pied', 0.9]], haut: [], murs: [['collier-soleil', 0.72, 74, 24], ['cle', 0.36, 8, 30]] },
  tatouage: { mur: 'mur-tatouage', gauche: [['crane', 0.72], ['serpent', 0.55]], droite: [['pot-cire', 0.42], ['poincon', 0.7], ['livre', 0.42]], haut: [['lustre-roses', 0.6, 12]], murs: [['papillon-nuit', 0.34, 80, 30], ['champignon', 0.3, 4, 34]] },
};
function poserDecor(id) {
  const d = DECORS[id];
  if (!d) return;
  $('#papier-peint').src = `../../assets/loge/murs/${d.mur}.webp`;
  // quatre vis différentes par rayon : les 24 têtes de vis de la planche y passent toutes
  const rang = ONGLETS.findIndex((o) => o.id === id);
  ['.coiffeuse .vg', '.coiffeuse .vd', '.miroir .v1', '.miroir .v2'].forEach((sel, k) => { $(sel).src = `../../assets/loge/vis/vis-${String(rang * 4 + k).padStart(2, '0')}.webp`; });
  const objet = ([n, h]) => `<img src="${A(n)}" alt="" style="--h:${h}" class="objet o-${n}">`;
  $('#decor-gauche').innerHTML = d.gauche.map(objet).join('');
  $('#decor-droite').innerHTML = d.droite.map(objet).join('');
  $('#suspensions').innerHTML = d.haut.map(([n, h, x]) => `<span class="suspension" style="--h:${h};--x:${x}%"><i></i><img src="${A(n)}" alt=""></span>`).join('');
  $('#sur-mur').innerHTML = d.murs.map(([n, h, x, y]) => `<img src="${A(n)}" alt="" class="au-mur" style="--h:${h};--x:${x}%;--y:${y}%">`).join('');
  const sc = $('#scene');
  sc.classList.remove('arrive'); void sc.offsetWidth; sc.classList.add('arrive');
}

function dessinMiroir(id) {
  $('#miroir-dessin').innerHTML = `<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${DESSINS[id] || ''}</g>`;
}

$('#onglets').innerHTML = ONGLETS.map((o, i) => `
  <a class="onglet" href="#${o.id}" style="--tourne:${[-2, 1.5, -1, 2, -1.5, 1][i]}deg" data-o="${o.id}">
    <svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${DESSINS[o.id]}</g></svg>
    <span>${o.nom}</span>
  </a>`).join('');

/* ---------- Données ---------- */
let TOUT = [];
async function charger() { TOUT = await store.parMalle('loge').catch(() => []); }
const duRayon = (id) => TOUT.filter((e) => e.type === id);

function finPao(e) {
  if (!e.ouverture || !e.mois) return null;
  const d = new Date(e.ouverture + 'T12:00:00');
  d.setMonth(d.getMonth() + Number(e.mois));
  return d;
}
function tamponPao(e) {
  const fin = finPao(e);
  if (!fin) return '';
  const jours = Math.ceil((fin - Date.now()) / 864e5);
  if (jours < 0) return '<span class="tampon-pao perime">à jeter</span>';
  if (jours <= 30) return `<span class="tampon-pao bientot">plus que ${jours} j</span>`;
  return `<span class="tampon-pao">jusqu’au ${esc(JOUR.format(fin))}</span>`;
}
function vignette(e, cls = '') {
  if (e.fichier instanceof Blob) return `<img class="${cls}" src="${urlPhoto(e.fichier)}" alt="${esc(e.titre || '')}" loading="lazy">`;
  return '';
}

/* ---------- Vues par rayon ---------- */
const VUES = {
  coiffure(items) {
    const filtre = `<a class="carte-filtre" href="#coiffure/filtre">
        <img src="../../assets/loge/tete-mannequin.webp" alt="" class="carte-filtre-tete">
        <span><b>Le filtre</b><small>Des coupes en 3D posées sur ton visage, en direct à la caméra. Ou ta vraie couleur changée.</small></span>
      </a>`;
    const essayer = `<a class="carte-essai" href="#coiffure/essayer">
        <svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><ellipse cx="32" cy="30" rx="18" ry="22"/><path d="M32 52v8M22 60h20"/><path d="M22 18c6-6 14-6 20 0"/></g></svg>
        <span><b>Essayer sur moi</b><small>Ta photo + une coiffure de ta collection : le miroir la pose sur ton visage.</small></span>
      </a>`;
    return `<div class="cartes-miroir">${filtre}${essayer}</div>` + (items.length ? polaroids(items) : '');
  },
  makeup(items) { return etagere(items, CATEGORIES.makeup); },
  soin(items) {
    const etat = routineDuJour();
    const col = (titre, filtre) => {
      const liste = items.filter(filtre).sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
      return `<section class="routine-col"><h3>${titre}</h3>${liste.length ? `<ol>${liste.map((e, i) => `
        <li><label><input type="checkbox" data-coche="${esc(titre + ':' + e.id)}" ${etat.includes(titre + ':' + e.id) ? 'checked' : ''}>
          <span><b>${esc(e.titre || 'Soin')}</b><small>${esc([e.categorie, e.marque].filter(Boolean).join(' · '))}</small></span></label>
          <span class="ordre"><button type="button" data-monter="${esc(e.id)}" data-liste="${titre}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-descendre="${esc(e.id)}" data-liste="${titre}" aria-label="Descendre" ${i === liste.length - 1 ? 'disabled' : ''}>↓</button></span>
        </li>`).join('')}</ol>` : '<p class="petit">Rien encore.</p>'}</section>`;
    };
    return `<div class="routine">${col('Matin', (e) => /Matin/.test(e.moment || ''))}${col('Soir', (e) => /Soir|soir/.test(e.moment || ''))}</div>
      <h3 class="sous-titre">Tous mes soins</h3>${etagere(items, CATEGORIES.soin)}`;
  },
  ongles(items) {
    const vernis = items.filter((e) => e.categorie !== 'Inspiration');
    const idees = items.filter((e) => e.categorie === 'Inspiration');
    return `${vernis.length ? `<ul class="nuancier">${vernis.map((e) => `
      <li><button type="button" class="vernis" data-ouvrir="${esc(e.id)}" style="--c:${esc(e.couleur || '#b3261e')}">
        <span class="ongle" aria-hidden="true"></span><b>${esc(e.titre || 'Vernis')}</b><small>${esc(e.marque || '')}</small></button></li>`).join('')}</ul>` : ''}
      ${idees.length ? `<h3 class="sous-titre">Idées de nail art</h3>${polaroids(idees)}` : ''}`;
  },
  piercing(items) {
    const points = ZONES.filter((z) => z.x !== null).map((z) => {
      const n = items.filter((e) => e.zone === z.nom).length;
      return `<g class="point${n ? ' porte' : ''}"><circle cx="${z.x}" cy="${z.y}" r="${n ? 7 : 4}"/>${n ? `<text x="${z.x + 10}" y="${z.y + 4}">${esc(z.nom)}</text>` : ''}</g>`;
    }).join('');
    const carte = `<figure class="carte-corps"><svg viewBox="0 0 320 200" role="img" aria-label="Oreille et visage, avec tes piercings">
      <g class="trait" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 108c-14-24-6-70 30-86 30-12 52 10 48 40-3 22-24 30-28 52-4 22 4 52-22 58-18 4-26-14-20-30 4-10 2-20-8-34z"/>
        <path d="M62 44c18-10 34 4 28 22M60 70c10 20 30 18 32 0M44 110c6-6 14-4 18 4"/>
        <path d="M200 30c34-6 62 18 62 58 0 24-6 34-4 46 2 10-10 14-12 24-4 14-22 26-42 20"/>
        <path d="M222 54c8-4 22-4 30 2M242 92c6 10 14 18 14 24-6 4-16 4-22 0M206 150c8 4 18 4 24-2"/>
      </g>${points}</svg></figure>`;
    const liste = items.length ? `<ul class="fiches">${items.map((e) => {
      const z = ZONES.find((x) => x.nom === e.zone) || ZONES[ZONES.length - 1];
      let soin = '';
      if (e.date) {
        const debut = new Date(e.date + 'T12:00:00');
        const fin = new Date(debut.getTime() + z.semaines[1] * 7 * 864e5);
        const k = Math.max(0, Math.min(1, (Date.now() - debut) / (fin - debut)));
        soin = `<div class="cicatrisation"><span style="width:${Math.round(k * 100)}%"></span></div>
          <small>${k >= 1 ? 'cicatrisation estimée terminée' : `cicatrisation estimée : ${z.semaines[0]} à ${z.semaines[1]} semaines, jusqu’au ${esc(JOUR.format(fin))} au plus tard`}</small>`;
      }
      return `<li><button type="button" class="fiche-ligne" data-ouvrir="${esc(e.id)}">
        ${vignette(e, 'mini')}<span><b>${esc(e.zone || 'Piercing')}</b><small>${esc([e.bijou, e.matiere].filter(Boolean).join(' · '))}</small>${soin}</span></button></li>`;
    }).join('')}</ul>` : '';
    return carte + liste + '<p class="petit avertissement">Durées indicatives, très variables d’une personne à l’autre : écoute ton perceur avant de changer un bijou.</p>';
  },
  tatouage(items) {
    return `<ul class="flash">${items.map((e, i) => `
      <li style="--tourne:${[-1.2, 1, -0.5, 1.4][i % 4]}deg"><button type="button" data-ouvrir="${esc(e.id)}">
        ${vignette(e) || `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DESSINS.tatouage}</g></svg>`}
        <b>${esc(e.titre || 'Motif')}</b><small>${esc([e.zone, e.artiste].filter(Boolean).join(' · '))}</small>
        <span class="statut statut-${esc((e.categorie || 'Idée').toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''))}">${esc(e.categorie || 'Idée')}</span>
      </button></li>`).join('')}</ul>`;
  },
};

function polaroids(items) {
  return `<ul class="polaroids">${items.map((e, i) => `
    <li style="--tourne:${[-1.5, 1.2, -0.6, 1.8, -1][i % 5]}deg"><button type="button" data-ouvrir="${esc(e.id)}">
      ${vignette(e) || '<span class="sans-photo">sans photo</span>'}
      <b>${esc(e.titre || e.categorie || '')}</b>${e.categorie === 'Essai' ? '<span class="statut">essai</span>' : ''}
    </button></li>`).join('')}</ul>`;
}

function etagere(items, ordre) {
  const groupes = ordre.map((c) => [c, items.filter((e) => (e.categorie || ordre[0]) === c)]).filter(([, l]) => l.length);
  return groupes.map(([c, l]) => `<section class="planche">
    <h3><span>${esc(c)}</span></h3>
    <ul>${l.map((e) => `<li><button type="button" class="flacon" data-ouvrir="${esc(e.id)}" style="--c:${esc(e.couleur || '#d8c3a5')}">
      ${vignette(e, 'flacon-photo') || '<span class="bouchon" aria-hidden="true"></span>'}
      <b>${esc(e.titre || 'Produit')}</b><small>${esc([e.marque, e.nuance].filter(Boolean).join(' · '))}</small>${tamponPao(e)}
    </button></li>`).join('')}</ul></section>`).join('');
}

/* ---------- Routine du jour (cases cochées, remises à zéro chaque jour) ---------- */
let routine = { date: '', faits: [] };
function routineDuJour() { return routine.date === aujourdhui() ? routine.faits : []; }
async function chargerRoutine() { routine = (await store.lireMeta('loge.routine').catch(() => null)) || routine; }

/* ---------- Rendu ---------- */
const vue = $('#vue');
let courant = 'coiffure';
async function rendre() {
  const [a, b] = location.hash.replace(/^#/, '').split('/');
  courant = onglet(a) ? a : 'coiffure';
  $$('.onglet').forEach((x) => x.setAttribute('aria-current', x.dataset.o === courant ? 'page' : 'false'));
  const o = onglet(courant);
  dessinMiroir(courant);
  if (poserDecor.dernier !== courant) { poserDecor(courant); poserDecor.dernier = courant; }
  $('#scene-titre').textContent = o.scene;
  libererPhotos();
  if (rendre.sousPage && !b) await charger(); // retour du filtre ou de l'essayage : relire les photos prises
  rendre.sousPage = Boolean(b);
  if (courant === 'coiffure' && b === 'filtre') {
    const m = await import('./filtre.js');
    return m.ouvrir(vue, { store, retour: () => { location.hash = '#coiffure'; } });
  }
  if (courant === 'coiffure' && b === 'essayer') {
    const m = await import('./essayage.js');
    return m.ouvrir(vue, { store, items: duRayon('coiffure'), retour: () => { location.hash = '#coiffure'; } });
  }
  const items = duRayon(courant).sort((x, y) => y.cree - x.cree);
  vue.innerHTML = `<section class="rayon">
    <div class="rayon-tete"><h2>${esc(o.scene)}</h2><button type="button" class="btn" id="ajouter">${esc(o.ajouter)}</button></div>
    ${VUES[courant](items)}
    ${!items.length ? `<p class="vide-loge">${esc(o.vide)}</p>` : ''}
    ${courant === 'makeup' || courant === 'piercing' ? sources() : ''}
  </section>`;
  $('#ajouter').addEventListener('click', () => ouvrirFiche(null));
}
function sources() {
  return `<details class="sources"><summary>D’où viennent les durées ?</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></li>`).join('')}</ul></details>`;
}

/* ---------- Fiche (ajout, modification, suppression) ---------- */
const dlg = $('#fiche');
const form = $('#fiche-form');
let edite = null;
let photo = null;

function champHTML(c, v) {
  const id = `f-${c.k}`;
  const val = v ?? '';
  if (c.type === 'photo') return `<div class="champ"><span class="champ-label">${esc(c.label)}</span>
    <div class="photo-champ"><img id="f-apercu" alt="" ${val instanceof Blob ? `src="${urlPhoto(val)}"` : 'hidden'}>
      <label class="outil"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Choisir ou prendre</span>
      <input type="file" id="f-photo" accept="image/*" hidden></label></div></div>`;
  if (c.type === 'select') return `<label class="champ" for="${id}"><span class="champ-label">${esc(c.label)}</span>
    <select id="${id}" name="${c.k}">${c.options.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  if (c.type === 'textarea') return `<label class="champ" for="${id}"><span class="champ-label">${esc(c.label)}</span><textarea id="${id}" name="${c.k}" rows="3">${esc(val)}</textarea></label>`;
  return `<label class="champ" for="${id}"><span class="champ-label">${esc(c.label)}</span>
    <input id="${id}" name="${c.k}" type="${c.type}" value="${esc(c.type === 'color' ? (val || '#b3261e') : val)}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''} ${c.type === 'number' ? 'min="1" max="60" inputmode="numeric"' : ''}></label>`;
}

function ouvrirFiche(e) {
  edite = e;
  photo = null;
  const o = onglet(courant);
  form.innerHTML = `<p class="feuille-titre">${e ? esc(e.titre || e.zone || o.nom) : esc(o.ajouter)}</p>
    <div class="champs">${o.champs.map((c) => champHTML(c, e ? (c.k === 'photo' ? e.fichier : e[c.k]) : (c.k === 'ouverture' ? aujourdhui() : undefined))).join('')}</div>
    <div class="feuille-actions">
      ${e ? '<button type="button" class="jeter" id="f-jeter">Jeter</button>' : ''}
      <button type="button" class="btn-sobre" id="f-annuler">Annuler</button>
      <button type="submit" class="btn">${e ? 'Enregistrer' : 'Ranger'}</button>
    </div>`;
  const typePao = $('#f-typePao', form);
  if (typePao) {
    if (!e) typePao.value = courant === 'soin' ? 'Crème, sérum' : 'Mascara';
    const mois = $('#f-mois', form);
    if (!mois.value) mois.value = PAO[typePao.value];
    typePao.addEventListener('change', () => { mois.value = PAO[typePao.value]; });
  }
  const f = $('#f-photo', form);
  if (f) f.addEventListener('change', async () => {
    if (!f.files[0]) return;
    photo = await compresserPhoto(f.files[0]);
    const im = $('#f-apercu', form); im.src = urlPhoto(photo); im.hidden = false;
  });
  $('#f-annuler', form).addEventListener('click', () => dlg.close());
  const j = $('#f-jeter', form);
  if (j) j.addEventListener('click', async () => {
    if (!j.classList.contains('sur')) { j.classList.add('sur'); j.textContent = 'Sûr ?'; return; }
    await store.supprimer(e.id); dlg.close(); toast('Jeté'); await charger(); rendre();
  });
  dlg.showModal();
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const o = onglet(courant);
  const donnees = { malle: 'loge', type: courant };
  for (const c of o.champs) {
    if (c.type === 'photo') continue;
    const el = form.elements[c.k];
    if (el) donnees[c.k] = c.type === 'number' ? (el.value ? Number(el.value) : null) : el.value.trim();
  }
  if (photo) donnees.fichier = photo;
  donnees.titre = donnees.titre || donnees.zone || (photo ? 'Photo' : '');
  if (!donnees.titre && !photo) { toast('Donne au moins un nom ou une photo'); return; }
  if (edite) await store.modifier(edite.id, donnees); else await store.ajouter(donnees);
  store.demanderPersistance();
  dlg.close();
  toast(edite ? 'Enregistré' : 'Rangé dans la Loge');
  await charger(); rendre();
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

/* ---------- Clics dans la vue ---------- */
vue.addEventListener('click', async (ev) => {
  const ouvrir = ev.target.closest('[data-ouvrir]');
  if (ouvrir) { const e = TOUT.find((x) => x.id === ouvrir.dataset.ouvrir); if (e) ouvrirFiche(e); return; }
  const haut = ev.target.closest('[data-monter],[data-descendre]');
  if (haut) {
    const id = haut.dataset.monter || haut.dataset.descendre;
    const dir = haut.dataset.monter ? -1 : 1;
    const liste = duRayon('soin').filter((e) => (haut.dataset.liste === 'Matin' ? /Matin/ : /Soir|soir/).test(e.moment || ''))
      .sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
    const i = liste.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    await Promise.all(liste.map((e, k) => store.modifier(e.id, { ordre: k })));
    await charger(); rendre();
  }
});
vue.addEventListener('change', async (ev) => {
  const c = ev.target.closest('[data-coche]');
  if (!c) return;
  const faits = new Set(routineDuJour());
  if (c.checked) faits.add(c.dataset.coche); else faits.delete(c.dataset.coche);
  routine = { date: aujourdhui(), faits: [...faits] };
  await store.ecrireMeta('loge.routine', routine);
  navigator.vibrate?.(10);
});

window.addEventListener('hashchange', rendre);
await Promise.all([charger(), chargerRoutine()]);
rendre();
