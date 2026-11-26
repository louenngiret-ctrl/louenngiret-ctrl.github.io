// Les menus de My memories, façon écran-titre de jeu : de grandes tuiles inclinées, une barre de description
// en bas qui dit ce que fait la tuile visée, et les flèches du clavier qui sautent d'une tuile à sa voisine.
// Accueil (#/accueil) → les nœuds de l’arbre (#/n/<id>, ancien nom #/s/<id>) : dossiers en tuiles, pages en blocs ; Ressources.
import * as store from './store.js';
import * as arbre from './arbre.js';
import * as fichiers from './fichiers.js';
import * as blocs from './blocs.js';
import { IMG, DENTELLE, EPINGLE, visuel, decoDe } from './plan.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const externe = (l) => l && !l.startsWith('#');

/* ---------- Ce qui est commun aux menus ---------- */
const ICONE_RE = /\/icones\//;
function tuile(t, { cls = '', liste = '', etat = '' } = {}) {
  return `<a class="mm-tuile ${cls}${t.epingle ? ' epinglee' : ''}" href="${esc(t.lien)}" data-desc="${esc(t.desc || t.nom)}" style="--c:${t.couleur};--e:${t.encre}">
    <span class="mm-fond" aria-hidden="true"${t.fond ? ` style="--img:url('${t.fond}')"` : ''}></span>
    ${t.dentelle != null ? `<img class="mm-dentelle" src="${DENTELLE(t.dentelle)}" alt="" aria-hidden="true">` : ''}
    ${t.deco ? `<img class="mm-deco" src="${decoDe(t.deco)}" alt="" aria-hidden="true" loading="lazy">` : ''}
    <img class="mm-hero${ICONE_RE.test(t.img) ? ' est-icone' : ''}" src="${t.img}" alt="" aria-hidden="true">
    ${t.epingle ? `<img class="mm-epingle" src="${EPINGLE}" alt="" aria-hidden="true">` : ''}
    <span class="mm-etiquette"><b>${esc(t.nom)}</b>${etat ? `<span class="mm-etat">${etat}</span>` : ''}</span>
    ${liste ? `<span class="mm-liste">${esc(liste)}</span>` : ''}
    <span class="sr">. ${esc(t.desc || '')}</span>
  </a>`;
}
/** Les données d'une tuile à partir d'un nœud de l'arbre (couleurs héritées de sa grande page). */
const versTuile = (n) => ({ ...n, ...arbre.couleurs(n.id), img: visuel(n), lien: arbre.lienDe(n) });
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
const DISPOSITION = ['creation', 'organisation', 'personnel', 'apprentissage', 'quotidien', 'gestion'];
export function rendreMenu(vue, { pied }) {
  const now = new Date();
  const grandes = arbre.enfants(arbre.RACINE);
  // la disposition sur mesure tient tant que les six grandes pages de départ sont là, dans leur ordre ;
  // sinon la grille suit l'ordre choisi dans l'administration
  const surMesure = grandes.map((n) => n.id).join() === DISPOSITION.join();
  const tuiles = grandes.map((n) => tuile(versTuile(n), { cls: `${surMesure ? `mm-${n.id} ` : ''}taille-${n.taille || 'm'}`, liste: arbre.enfants(n.id).map((x) => x.nom).join(', ') })).join('');
  const defaut = 'Choisis une grande page pour l’ouvrir. Au clavier, les flèches passent d’une tuile à l’autre.';
  vue.innerHTML = `<section class="mm-menu mm-accueil" aria-labelledby="mm-titre">
    <h1 id="mm-titre" class="sr">Accueil de My memories</h1>
    <div class="mm-grille${surMesure ? '' : ' mm-libre'}">
      ${tuiles}
      ${tuile({ nom: 'Ressources', lien: '#/ressources', couleur: '#1f1a1c', encre: '#f4ead6', img: IMG('crapaud-sorcier'), deco: 'papillon-bleu', dentelle: 0,
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

/* ---------- Un nœud de l'arbre : un dossier (menu de tuiles) ou une page (notes et fichiers) ---------- */
const DATEH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
function bandeau(n, petit = false) {
  const fil = [['Accueil', '#/accueil'], ...arbre.chemin(n.id).map((x, i, l) => [x.nom, i < l.length - 1 ? arbre.lienDe(x) : null])];
  return `<header class="mm-bandeau${petit ? ' petit-bandeau' : ''}">
    ${filAriane(fil)}
    <h1 id="mm-titre">${esc(n.nom)}</h1>
    ${n.desc ? `<p>${esc(n.desc)}</p>` : ''}
    <a class="mm-modifier" href="#/admin/arbre/${encodeURIComponent(n.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg><span>Modifier</span></a>
    <img class="mm-bandeau-img${/\/icones\//.test(visuel(n)) ? ' est-icone' : ''}" src="${visuel(n)}" alt="" aria-hidden="true">
  </header>`;
}
export async function rendreNoeud(vue, id, { pied, toast }) {
  const n = arbre.noeud(id);
  if (!n || n.corbeille) {
    vue.innerHTML = `<section class="mm-page" aria-labelledby="mm-titre"><header class="mm-bandeau petit-bandeau">${filAriane([['Accueil', '#/accueil'], ['Introuvable']])}<h1 id="mm-titre">Page introuvable</h1>
      <p>${n ? 'Cette page est dans la corbeille.' : 'Cette page n’existe pas ou plus.'}</p></header>
      <p class="mm-retour">${n ? '<a class="btn" href="#/admin/corbeille">Ouvrir la corbeille</a> ' : ''}<a href="#/accueil">Revenir au grand menu</a></p></section>${pied}`;
    return;
  }
  if (n.id === arbre.RACINE) { location.replace('#/accueil'); return; }
  if (n.type === 'lien' || n.type === 'app') { location.replace(arbre.lienDe(n)); return; }
  const { couleur, encre } = arbre.couleurs(n.id);
  if (n.type === 'dossier') {
    const tous = await store.tout().catch(() => []);
    const enfants = arbre.enfants(n.id);
    const etatDe = (x) => {
      if (x.type === 'dossier') return pluriel(arbre.enfants(x.id).length, 'page');
      if (x.type === 'page') { const k = tous.filter((e) => e.malle === x.id).length; return k ? pluriel(k, 'note') : 'vide'; }
      return 'ouvrir';
    };
    const tuiles = enfants.map((x, i) => tuile({ ...versTuile(x), dentelle: i === 0 ? n.dentelle : null, fond: i === 0 ? n.fond : null },
      { cls: `${i === 0 ? 'mm-premier' : ''} ${x.type === 'page' ? 'a-venir' : 'existe'} type-${x.type}`, etat: etatDe(x) })).join('');
    vue.innerHTML = `<section class="mm-menu mm-section" style="--c:${couleur};--e:${encre}" aria-labelledby="mm-titre">
      ${bandeau(n)}
      ${enfants.length ? `<div class="mm-grille mm-sous">${tuiles}</div>` : `<p class="mm-chantier">Ce dossier est vide. <a href="#/admin/arbre/${encodeURIComponent(n.id)}">Ajoute une page ou un dossier ici</a>.</p>`}
      <p class="mm-desc" aria-hidden="true">${esc(n.desc || n.nom)}</p>
      <p class="mm-retour"><a href="${n.parent === arbre.RACINE ? '#/accueil' : arbre.lienDe(arbre.noeud(n.parent))}">Revenir ${n.parent === arbre.RACINE ? 'au grand menu' : `à « ${esc(arbre.noeud(n.parent)?.nom)} »`}</a></p>
    </section>${pied}`;
    brancherMenu($('.mm-menu', vue), n.desc || n.nom);
    return;
  }
  // une page : une feuille en blocs (noyau/blocs.js) et ses fichiers
  let urls = [];
  const dessiner = async () => {
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    const fs = await fichiers.lister(n.id);
    const vignette = (f) => { if (!/^image\//.test(f.mime)) return `<span class="mm-fichier-type" aria-hidden="true">${esc((f.nom.split('.').pop() || '').slice(0, 4))}</span>`; const u = URL.createObjectURL(f.blob); urls.push(u); return `<img src="${u}" alt="" loading="lazy">`; };
    vue.innerHTML = `<section class="mm-page" style="--c:${couleur};--e:${encre}" aria-labelledby="mm-titre">
      ${bandeau(n, true)}
      <div class="mm-carnet">
        <div class="bl-support" data-doc></div>
        <section class="mm-fichiers" aria-labelledby="mm-fichiers-titre">
          <h2 id="mm-fichiers-titre">Fichiers</h2>
          <div class="mm-fichiers-actions">
            <label class="btn-sobre mm-importer"><input type="file" multiple data-importer hidden><span>Importer des fichiers</span></label>
            <button type="button" class="btn-sobre" data-nouveau-texte>Nouveau texte</button>
          </div>
          ${fs.length ? `<ul class="mm-fichiers-liste">${fs.map((f) => `<li class="mm-fichier">
            <button type="button" class="mm-fichier-ouvrir" data-ouvrir-fichier="${f.id}">${vignette(f)}<span><b>${esc(f.nom)}</b><small>${fichiers.poids(f.taille)}, ${DATEH.format(new Date(f.modifie))}</small></span></button>
          </li>`).join('')}</ul>` : '<p class="petit mm-vide">Aucun fichier. Images, PDF, textes, sons : tout se range ici, sur cet appareil.</p>'}
        </section>
      </div>
      <dialog class="mm-fiche" data-fiche></dialog>
    </section>${pied}`;
    await blocs.monter($('[data-doc]', vue), n, { toast });
  };
  await dessiner();
  const fiche = () => $('[data-fiche]', vue);
  const ouvrirFiche = async (fid) => {
    const f = (await fichiers.lister(n.id)).find((x) => x.id === fid);
    if (!f) return;
    const d = fiche(), texte = fichiers.estTexte(f);
    let apercu = '';
    if (/^image\//.test(f.mime)) { const u = URL.createObjectURL(f.blob); urls.push(u); apercu = `<img class="mm-fiche-img" src="${u}" alt="${esc(f.nom)}">`; }
    else if (/^audio\//.test(f.mime)) { const u = URL.createObjectURL(f.blob); urls.push(u); apercu = `<audio controls src="${u}"></audio>`; }
    else if (/^video\//.test(f.mime)) { const u = URL.createObjectURL(f.blob); urls.push(u); apercu = `<video controls src="${u}"></video>`; }
    else if (texte) apercu = `<label class="mm-fiche-texte"><span>Contenu</span><textarea rows="12" data-contenu spellcheck="false">${esc(await f.blob.text())}</textarea></label>`;
    const vs = await fichiers.versions(f.id);
    const pcm = await import('./pc.js'), dossiersPc = pcm.possible() ? (await pcm.epingles()).filter((x) => x.genre === 'dossier') : [];
    d.innerHTML = `<form method="dialog" class="mm-fiche-corps" data-fiche-form="${f.id}">
      <label><span>Nom</span><input data-nom value="${esc(f.nom)}" maxlength="120"></label>
      ${apercu}
      <p class="petit">${fichiers.poids(f.taille)}${f.mime ? `, ${esc(f.mime)}` : ''}. Modifié le ${DATEH.format(new Date(f.modifie))}.</p>
      ${vs.length ? `<details><summary>${pluriel(vs.length, 'ancienne version')}</summary><ul class="mm-versions">${vs.map((v) => `<li><span>${DATEH.format(new Date(v.date))}, ${esc(v.raison)}</span><button type="button" class="btn-sobre" data-version="${v.id}">Revenir à celle-ci</button></li>`).join('')}</ul></details>` : ''}
      ${dossiersPc.length ? `<label class="pc-copier"><span>Envoyer sur le disque, dans un dossier épinglé</span><select data-vers-pc><option value="">Choisir un dossier…</option>${dossiersPc.map((x) => `<option value="${esc(x.id)}">${esc(x.nom)}</option>`).join('')}</select></label>` : ''}
      <div class="mm-fiche-actions">
        <button type="button" class="btn" data-enregistrer>Enregistrer</button>
        <button type="button" class="btn-sobre" data-telecharger>Télécharger</button>
        <button type="button" class="btn-sobre" data-jeter-fichier>Jeter</button>
        <button type="submit" class="btn-sobre">Fermer</button>
      </div></form>`;
    d.showModal();
  };
  vue.onchange = async (e) => {
    const vp = e.target.closest('[data-vers-pc]');
    if (vp && vp.value) {
      const pcm = await import('./pc.js'), ep = await pcm.epingle(vp.value), fid = vp.closest('[data-fiche-form]').dataset.ficheForm;
      const f = (await fichiers.lister(n.id)).find((x) => x.id === fid);
      try {
        if ((await pcm.acces(ep.handle, true)) !== 'granted') throw new Error('Accès refusé par le navigateur.');
        const fh = await pcm.creerFichier(ep.handle, f.nom, f.blob);
        toast(`Envoyé dans « ${ep.nom} » : ${fh.name}`);
      } catch (err) { toast(err.message); }
      vp.value = '';
      return;
    }
    const inp = e.target.closest('[data-importer]');
    if (!inp || !inp.files.length) return;
    for (const f of inp.files) await fichiers.ajouterFichier(n.id, f);
    toast(inp.files.length > 1 ? `${inp.files.length} fichiers rangés` : 'Fichier rangé');
    await dessiner();
  };
  vue.onclick = async (e) => {
    const t = e.target;
    if (t.closest('[data-nouveau-texte]')) { const f = await fichiers.creerTexte(n.id, 'Nouveau texte.txt'); await dessiner(); ouvrirFiche(f.id); return; }
    const o = t.closest('[data-ouvrir-fichier]'); if (o) { ouvrirFiche(o.dataset.ouvrirFichier); return; }
    const form = t.closest('[data-fiche-form]'); if (!form) return;
    const fid = form.dataset.ficheForm;
    if (t.closest('[data-enregistrer]')) {
      const nom = $('[data-nom]', form).value.trim(), zone = $('[data-contenu]', form);
      const f = (await fichiers.lister(n.id)).find((x) => x.id === fid);
      if (zone && zone.value !== await f.blob.text()) await fichiers.remplacerContenu(fid, zone.value);
      if (nom && nom !== f.nom) await fichiers.renommer(fid, nom);
      fiche().close(); await dessiner(); toast('Enregistré'); return;
    }
    if (t.closest('[data-telecharger]')) { const f = (await fichiers.lister(n.id)).find((x) => x.id === fid); fichiers.telecharger(f); return; }
    const jf = t.closest('[data-jeter-fichier]');
    if (jf) {
      if (!jf.classList.contains('sur')) { jf.classList.add('sur'); jf.textContent = 'Sûr ? Il ira dans la corbeille'; setTimeout(() => { if (jf.isConnected) { jf.classList.remove('sur'); jf.textContent = 'Jeter'; } }, 3500); return; }
      await fichiers.jeter(fid); fiche().close(); await dessiner(); toast('Fichier mis à la corbeille'); return;
    }
    const v = t.closest('[data-version]');
    if (v) { await fichiers.revenirA(v.dataset.version); fiche().close(); await dessiner(); toast('Ancienne version remise'); }
  };
}

/* ---------- Ressources : principal, catégories, ressource ---------- */
// les petits blocs d'une page (titres, éléments de liste, cases) restent dans leur page : Rechercher les trouve
const COURTS = new Set(['titre', 'sous-titre', 'liste', 'numero', 'case']);
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
  const tous = (await store.tout().catch(() => [])).filter((o) => (o.malle !== 'agenda' || o.titre) && o.type !== 'donnee' && o.type !== 'bloc' && !COURTS.has(o.bloc)).sort((a, b) => (b.cree || 0) - (a.cree || 0));
  const carte = (o) => {
    const g = genre(o), p = arbre.pageDe(o.malle);
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
      : '<p class="mm-chantier">Rien de rangé pour l’instant. Le bouton + capture une idée, un lien ou une photo, et chaque page est une feuille où écrire.</p>';
  } else if (onglet === 'categories') {
    corps = `<ul class="res-categories">${arbre.enfants(arbre.RACINE).map((sec) => {
      const n = tous.filter((o) => arbre.grandePageDe(o.malle)?.id === sec.id).length, c = arbre.couleurs(sec.id);
      return `<li><a href="${arbre.lienDe(sec)}" style="--c:${c.couleur};--e:${c.encre}"><img src="${visuel(sec)}" alt="" aria-hidden="true"><b>${esc(sec.nom)}</b><small>${n} rangé${n > 1 ? 's' : ''}, ${pluriel(arbre.enfants(sec.id).length, 'page')}</small></a></li>`;
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
