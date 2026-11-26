// Les menus de My memories, façon écran-titre de jeu : de grandes tuiles inclinées, une barre de description
// en bas qui dit ce que fait la tuile visée, et les flèches du clavier qui sautent d'une tuile à sa voisine.
// Accueil (#/accueil) → six grandes pages (#/s/<id>) → sous-onglets (#/s/<id>/<sous>) ; Ressources (#/ressources).
import * as store from './store.js';
import { SECTIONS, section, sousOnglet, lienDe, rangement, pageDe, sectionDe, IMG, DENTELLE, COLLAGE } from './plan.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const externe = (l) => l && !l.startsWith('#');

/* ---------- Ce qui est commun aux menus ---------- */
function tuile(t, { cls = '', liste = '', etat = '' } = {}) {
  return `<a class="mm-tuile ${cls}" href="${esc(t.lien)}" data-desc="${esc(t.desc)}" style="--c:${t.couleur};--e:${t.encre}">
    <span class="mm-fond" aria-hidden="true"${t.fond ? ` style="--img:url('${t.fond}')"` : ''}></span>
    ${t.dentelle != null ? `<img class="mm-dentelle" src="${DENTELLE(t.dentelle)}" alt="" aria-hidden="true">` : ''}
    ${t.deco ? `<img class="mm-deco" src="${t.deco.startsWith('timbre') ? COLLAGE(t.deco) : IMG(t.deco)}" alt="" aria-hidden="true" loading="lazy">` : ''}
    <img class="mm-hero" src="${IMG(t.hero)}" alt="" aria-hidden="true">
    <span class="mm-etiquette"><b>${esc(t.nom)}</b>${etat ? `<span class="mm-etat">${etat}</span>` : ''}</span>
    ${liste ? `<span class="mm-liste">${esc(liste)}</span>` : ''}
    <span class="sr">. ${esc(t.desc)}</span>
  </a>`;
}
// La barre du bas dit ce que fait la tuile visée ; les flèches déplacent le focus vers la tuile voisine.
function brancherMenu(racine, defaut) {
  const bar = $('.mm-desc', racine);
  const dire = (el) => { if (bar) bar.textContent = el?.dataset.desc || defaut; };
  racine.addEventListener('focusin', (e) => dire(e.target.closest('[data-desc]')));
  racine.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-desc]'); if (t) dire(t); });
  racine.addEventListener('pointerleave', () => dire(racine.contains(document.activeElement) ? document.activeElement.closest('[data-desc]') : null));
  racine.addEventListener('keydown', (e) => {
    const sens = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (!sens || !e.target.closest('[data-desc]')) return;
    const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const [x, y] = c(e.target);
    let mieux = null, score = Infinity;
    racine.querySelectorAll('[data-desc]').forEach((el) => {
      if (el === e.target) return;
      const [a, b] = c(el), dx = a - x, dy = b - y, avance = dx * sens[0] + dy * sens[1];
      if (avance <= 4) return;
      const ecart = Math.abs(dx * sens[1]) + Math.abs(dy * sens[0]);
      const s = avance + ecart * 2.2;
      if (s < score) { score = s; mieux = el; }
    });
    if (mieux) { e.preventDefault(); mieux.focus(); mieux.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });
}
const filAriane = (morceaux) => `<nav class="mm-fil" aria-label="Où tu es"><ol>${morceaux.map(([n, l], i) => `<li>${l && i < morceaux.length - 1 ? `<a href="${l}">${esc(n)}</a>` : `<span aria-current="page">${esc(n)}</span>`}</li>`).join('')}</ol></nav>`;

/* ---------- L'accueil : le grand menu ---------- */
export function rendreMenu(vue, { pied }) {
  const now = new Date();
  const tuiles = SECTIONS.map((sec) => tuile({ ...sec, lien: `#/s/${sec.id}` }, { cls: `mm-${sec.id} taille-${sec.taille}`, liste: sec.sous.map((x) => x.nom).join(', ') })).join('');
  const defaut = 'Choisis une grande page pour l’ouvrir. Au clavier, les flèches passent d’une tuile à l’autre.';
  vue.innerHTML = `<section class="mm-menu mm-accueil" aria-labelledby="mm-titre">
    <h1 id="mm-titre" class="sr">Accueil de My memories</h1>
    <div class="mm-grille">
      ${tuiles}
      ${tuile({ nom: 'Ressources', lien: '#/ressources', couleur: '#1f1a1c', encre: '#f4ead6', hero: 'crapaud-sorcier', deco: 'papillon-bleu', dentelle: 0,
        desc: 'Tout ce que tu as rangé, au même endroit : le principal, par catégorie, ou la liste entière.' }, { cls: 'mm-ressources', liste: 'Principal, catégories, ressource' })}
      <div class="mm-outils" role="group" aria-label="Aller plus vite">
        <button type="button" class="mm-rond" data-ouvrir="explorer" data-desc="Explorer : toutes les pages et leurs sous-onglets, en arbre."><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h6"/></svg><span>Explorer</span></button>
        <button type="button" class="mm-rond" data-ouvrir="recherche" data-desc="Rechercher : un mot, et My memories fouille toutes les pages."><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg><span>Rechercher</span></button>
        <button type="button" class="mm-rond" data-ouvrir="parametres" data-desc="Paramètres : la barre, le décor, les réglages et la sauvegarde."><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg><span>Paramètres</span></button>
      </div>
      <div class="mm-medaillon" aria-hidden="true">
        <img class="mm-soleil" src="${IMG('soleil-rouge')}" alt=""><img class="mm-lune" src="${IMG('croissant')}" alt="">
        <span class="mm-nom">My<br>memories</span><span class="mm-heure">${HEURE.format(now)}, ${DATE.format(now)}</span>
      </div>
    </div>
    <p class="mm-desc" aria-hidden="true">${defaut}</p>
  </section>${pied}`;
  const racine = $('.mm-menu', vue);
  brancherMenu(racine, defaut);
  racine.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ouvrir]');
    if (b) { const { ouvrirPanneau } = await import('./navigation.js'); ouvrirPanneau(b.dataset.ouvrir); }
  });
}

/* ---------- Une grande page : son menu de sous-onglets ---------- */
export async function rendreSection(vue, id, { pied }) {
  const sec = section(id);
  if (!sec) { location.hash = '#/accueil'; return; }
  const tous = await store.tout().catch(() => []);
  const compte = (so) => tous.filter((x) => x.malle === rangement(sec.id, so.id)).length;
  const tuiles = sec.sous.map((so, i) => {
    const n = compte(so);
    const etat = so.lien ? (externe(so.lien) ? 'ouvert' : 'ouvert') : (n ? `${n} note${n > 1 ? 's' : ''}` : 'à construire');
    return tuile({ nom: so.nom, desc: so.desc, lien: lienDe(sec.id, so), couleur: sec.couleur, encre: sec.encre, hero: so.sticker, dentelle: i === 0 ? sec.dentelle : null, fond: i === 0 ? sec.fond : null },
      { cls: `${i === 0 ? 'mm-premier' : ''} ${so.lien ? 'existe' : 'a-venir'}`, etat });
  }).join('');
  vue.innerHTML = `<section class="mm-menu mm-section" style="--c:${sec.couleur};--e:${sec.encre}" aria-labelledby="mm-titre">
    <header class="mm-bandeau">
      ${filAriane([['Accueil', '#/accueil'], [sec.nom]])}
      <h1 id="mm-titre">${esc(sec.nom)}</h1>
      <p>${esc(sec.desc)}</p>
      <img class="mm-bandeau-img" src="${IMG(sec.hero)}" alt="" aria-hidden="true">
    </header>
    <div class="mm-grille mm-sous">${tuiles}</div>
    <p class="mm-desc" aria-hidden="true">${esc(sec.desc)}</p>
    <p class="mm-retour"><a href="#/accueil">Revenir au grand menu</a></p>
  </section>${pied}`;
  brancherMenu($('.mm-menu', vue), sec.desc);
}

/* ---------- Un sous-onglet pas encore construit : déjà un carnet de notes ---------- */
const DATEH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export async function rendreSous(vue, idSec, idSous, { pied, toast }) {
  const sec = section(idSec), so = sousOnglet(idSec, idSous);
  if (!sec || !so) { location.hash = '#/accueil'; return; }
  if (so.lien) { location.href = so.lien; return; }
  const malle = rangement(sec.id, so.id);
  const dessiner = async () => {
    const notes = (await store.parMalle(malle).catch(() => [])).sort((a, b) => (b.cree || '').localeCompare(a.cree || ''));
    vue.innerHTML = `<section class="mm-page" style="--c:${sec.couleur};--e:${sec.encre}" aria-labelledby="mm-titre">
      <header class="mm-bandeau petit-bandeau">
        ${filAriane([['Accueil', '#/accueil'], [sec.nom, `#/s/${sec.id}`], [so.nom]])}
        <h1 id="mm-titre">${esc(so.nom)}</h1>
        <p>${esc(so.desc)}</p>
        <img class="mm-bandeau-img" src="${IMG(so.sticker)}" alt="" aria-hidden="true">
      </header>
      <div class="mm-carnet">
        <p class="mm-chantier">Cette page sera construite plus tard. En attendant, ce que tu notes ici est gardé, et la vraie page le reprendra.</p>
        <form class="mm-noter" data-noter>
          <label for="mm-note">Une note pour « ${esc(so.nom)} »</label>
          <textarea id="mm-note" rows="3" placeholder="Écris ici…"></textarea>
          <button type="submit" class="btn">Ranger la note</button>
        </form>
        ${notes.length ? `<ul class="mm-notes">${notes.map((n) => `<li class="mm-note-carte">
          <p>${esc(n.texte)}</p>
          <div class="mm-note-pied"><time>${n.cree ? DATEH.format(new Date(n.cree)) : ''}</time>
          <button type="button" class="btn-sobre" data-jeter="${n.id}">Jeter</button></div></li>`).join('')}</ul>` : '<p class="petit mm-vide">Aucune note pour l’instant.</p>'}
      </div>
    </section>${pied}`;
  };
  await dessiner();
  vue.onsubmit = async (e) => {
    if (!e.target.closest('[data-noter]')) return;
    e.preventDefault();
    const t = $('#mm-note', vue).value.trim();
    if (!t) return;
    await store.ajouter({ malle, type: 'note', texte: t });
    await dessiner(); toast('Note rangée'); $('#mm-note', vue)?.focus();
  };
  vue.onclick = async (e) => {
    const b = e.target.closest('[data-jeter]');
    if (!b) return;
    if (!b.classList.contains('sur')) { b.classList.add('sur'); b.textContent = 'Sûr ?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('sur'); b.textContent = 'Jeter'; } }, 3000); return; }
    await store.supprimer(b.dataset.jeter); await dessiner(); toast('Note jetée');
  };
}

/* ---------- Ressources : principal, catégories, ressource ---------- */
let urls = [];
const libelle = (o) => { for (const k of ['titre', 'nom', 'texte', 'lien', 'url']) if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim(); return o.type || 'Sans titre'; };
const genre = (o) => (o.fichier instanceof Blob ? 'photo' : (o.type === 'lien' || /^https?:\/\//.test(o.texte || '') ? 'lien' : 'note'));
const ICONES = {
  principal: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />',
  categories: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v9l8 4.5" />',
  ressource: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18" />',
};
export async function rendreRessources(vue, onglet = 'principal', { pied }) {
  urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  if (!['principal', 'categories', 'ressource'].includes(onglet)) onglet = 'principal';
  const tous = (await store.tout().catch(() => [])).filter((o) => o.malle !== 'agenda' || o.titre).sort((a, b) => (b.cree || '').localeCompare(a.cree || ''));
  const carte = (o) => {
    const g = genre(o), p = pageDe(o.malle);
    let img = '';
    if (g === 'photo') { const u = URL.createObjectURL(o.fichier); urls.push(u); img = `<img src="${u}" alt="" loading="lazy">`; }
    const t = libelle(o);
    return `<li class="res-carte res-${g}"><a href="${esc(p.lien)}">${img}<span class="res-genre">${{ photo: 'Photo', lien: 'Lien', note: 'Note' }[g]}</span><b>${esc(t.length > 90 ? `${t.slice(0, 90)}…` : t)}</b><small>${esc(p.nom)}</small></a></li>`;
  };
  let corps = '';
  if (onglet === 'principal') {
    const photos = tous.filter((o) => genre(o) === 'photo').slice(0, 8), autres = tous.filter((o) => genre(o) !== 'photo').slice(0, 10);
    corps = tous.length
      ? `${photos.length ? `<h2 class="res-titre">Les dernières images</h2><ul class="res-mur">${photos.map(carte).join('')}</ul>` : ''}
         ${autres.length ? `<h2 class="res-titre">Les dernières notes et liens</h2><ul class="res-liste">${autres.map(carte).join('')}</ul>` : ''}`
      : '<p class="mm-chantier">Rien de rangé pour l’instant. Le bouton + capture une idée, un lien ou une photo, et chaque page a son carnet de notes.</p>';
  } else if (onglet === 'categories') {
    corps = `<ul class="res-categories">${SECTIONS.map((sec) => {
      const n = tous.filter((o) => sectionDe(o.malle)?.id === sec.id).length;
      return `<li><a href="#/s/${sec.id}" style="--c:${sec.couleur};--e:${sec.encre}"><img src="${IMG(sec.hero)}" alt="" aria-hidden="true"><b>${esc(sec.nom)}</b><small>${n} rangé${n > 1 ? 's' : ''}, ${sec.sous.length} sous-onglets</small></a></li>`;
    }).join('')}</ul>`;
  } else {
    corps = `<div class="res-filtres" role="group" aria-label="Filtrer">
      ${[['tout', 'Tout'], ['note', 'Notes'], ['lien', 'Liens'], ['photo', 'Photos']].map(([id, n], i) => `<button type="button" data-filtre="${id}" aria-pressed="${i === 0}">${n}</button>`).join('')}
      </div>
      ${tous.length ? `<ul class="res-liste" data-liste>${tous.map((o) => carte(o).replace('<li class="res-carte', `<li data-genre="${genre(o)}" class="res-carte`)).join('')}</ul>` : '<p class="mm-chantier">Rien de rangé pour l’instant.</p>'}`;
  }
  const ongs = [['principal', 'principal'], ['categories', 'catégories'], ['ressource', 'ressource']];
  vue.innerHTML = `<section class="mm-page res" aria-labelledby="mm-titre">
    <header class="res-tete">
      ${filAriane([['Accueil', '#/accueil'], ['Ressources']])}
      <h1 id="mm-titre">Ressources</h1>
      <p>${tous.length} chose${tous.length > 1 ? 's' : ''} rangée${tous.length > 1 ? 's' : ''} dans My memories.</p>
      <nav class="res-onglets" aria-label="Vues des ressources">${ongs.map(([id, n]) => `<a href="#/ressources/${id}" ${id === onglet ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[id]}</svg><span>${n}</span></a>`).join('')}</nav>
    </header>
    <div class="res-corps">${corps}</div>
  </section>${pied}`;
  vue.onclick = (e) => {
    const f = e.target.closest('[data-filtre]');
    if (!f) return;
    vue.querySelectorAll('[data-filtre]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
    vue.querySelectorAll('[data-liste] > li').forEach((li) => { li.hidden = f.dataset.filtre !== 'tout' && li.dataset.genre !== f.dataset.filtre; });
  };
}
