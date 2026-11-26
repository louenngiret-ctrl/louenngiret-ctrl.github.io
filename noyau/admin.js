// L'administration de My memories (#/admin) : le registre où Louenn range tout sans toucher au code.
//   #/admin/arbre[/<id>]  pages, dossiers, liens et apps : créer, renommer, déplacer, changer l'image et la couleur
//   #/admin/apps          ajouter, mettre à jour, exporter, désinstaller des applications
//   #/admin/sauvegardes   archive complète, restauration, points de restauration, dossier du PC
//   #/admin/corbeille     ce qui a été jeté, à récupérer ou à effacer pour de bon
import * as store from './store.js';
import * as arbre from './arbre.js';
import * as apps from './apps.js';
import * as fichiers from './fichiers.js';
import * as sauvegarde from './sauvegarde.js';
import { STICKERS, IMG, ICONE, visuel } from './plan.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const DATEH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const pl = (n, un, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;
const quand = (t) => (t ? DATEH.format(new Date(t)) : 'jamais');
const TYPES = { dossier: 'Dossier', page: 'Page', lien: 'Lien', app: 'App' };
const ONGLETS = [['arbre', 'Pages et dossiers'], ['apps', 'Applications'], ['sauvegardes', 'Sauvegardes'], ['corbeille', 'Corbeille']];
const NB_ICONES = 179;
const ICONES = Array.from({ length: NB_ICONES }, (_, i) => `i${String(i).padStart(3, '0')}`).filter((x) => x !== 'i161');

/** Un bouton qui demande un deuxième appui avant d'agir (jamais de fenêtre système). */
function deuxTemps(b, question, action) {
  if (!b.classList.contains('sur')) {
    const avant = b.textContent; b.classList.add('sur'); b.textContent = question;
    setTimeout(() => { if (b.isConnected && b.classList.contains('sur')) { b.classList.remove('sur'); b.textContent = avant; } }, 4000);
    return;
  }
  b.classList.remove('sur'); action();
}
const telechargerBlob = (blob, nom) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); };

let ctx = null;
export async function rendreAdmin(vue, onglet = 'arbre', sous, c) {
  ctx = { ...c, vue };
  if (!ONGLETS.some(([id]) => id === onglet)) onglet = 'arbre';
  vue.innerHTML = `${c.barre('Administration', '#/accueil')}
  <section class="registre" aria-labelledby="registre-titre">
    <h1 id="registre-titre" class="sr">Administration</h1>
    <nav class="registre-onglets" aria-label="Parties de l’administration">
      ${ONGLETS.map(([id, nom]) => `<a href="#/admin/${id}" ${id === onglet ? 'aria-current="page"' : ''}>${nom}</a>`).join('')}
    </nav>
    <div class="registre-page" data-registre></div>
  </section>${c.pied()}`;
  vue.onclick = vue.onchange = vue.onsubmit = vue.oninput = null;
  const zone = $('[data-registre]', vue);
  if (onglet === 'arbre') await ongletArbre(zone, sous ? decodeURIComponent(sous) : null);
  else if (onglet === 'apps') await ongletApps(zone);
  else if (onglet === 'sauvegardes') await ongletSauvegardes(zone);
  else await ongletCorbeille(zone);
}

/* =================== Pages et dossiers =================== */
let choisi = null;
function lignes(id, prof, sel) {
  return arbre.enfants(id).map((n) => `<li>
    <button type="button" class="reg-noeud type-${n.type}" data-choisir="${esc(n.id)}" aria-current="${n.id === sel}" style="--prof:${prof}">
      <img src="${visuel(n)}" alt="" aria-hidden="true"><span>${esc(n.nom)}</span><small>${TYPES[n.type]}${n.epingle ? ', épinglé' : ''}</small>
    </button>
    ${n.type === 'dossier' && arbre.enfants(n.id).length ? `<ul>${lignes(n.id, prof + 1, sel)}</ul>` : ''}</li>`).join('');
}
const dossiers = (exclure) => {
  const bannis = new Set(exclure ? [exclure, ...arbre.descendants(exclure).map((x) => x.id)] : []);
  const l = [];
  const f = (id, prof) => { const n = arbre.noeud(id); if (bannis.has(id)) return; l.push([id, `${'  '.repeat(prof)}${id === arbre.RACINE ? 'Le grand menu (accueil)' : n.nom}`]); arbre.enfants(id).filter((x) => x.type === 'dossier').forEach((x) => f(x.id, prof + 1)); };
  f(arbre.RACINE, 0);
  return l;
};
async function ongletArbre(zone, sel) {
  choisi = sel && arbre.noeud(sel) && !arbre.noeud(sel).corbeille ? sel : choisi && arbre.noeud(choisi) && !arbre.noeud(choisi).corbeille ? choisi : null;
  const listeApps = await apps.toutes();
  const n = choisi ? arbre.noeud(choisi) : null;
  const gardes = await arbre.arbresGardes();
  zone.innerHTML = `<div class="reg-arbre">
    <div class="reg-colonne">
      <p class="petit">Touche une page pour la modifier. Le grand menu montre le premier niveau ; chaque dossier ouvre son propre menu.</p>
      <div class="reg-ajouts" role="group" aria-label="Ajouter au grand menu">
        <button type="button" class="btn-sobre" data-creer="dossier" data-dans="${arbre.RACINE}">Nouvelle grande page</button>
      </div>
      <ul class="reg-liste">${lignes(arbre.RACINE, 0, choisi)}</ul>
      <details class="reg-garde"><summary>Arborescences gardées${gardes.length ? ` (${gardes.length})` : ''}</summary>
        <p class="petit">Avant chaque retour en arrière de toute l’arborescence, l’ancienne est gardée ici.</p>
        ${gardes.length ? `<ul class="reg-versions">${gardes.map((v) => `<li><span>${quand(v.date)}, ${esc(v.raison)}</span><button type="button" class="btn-sobre" data-arbre-garde="${v.id}">Remettre</button></li>`).join('')}</ul>` : ''}
        <button type="button" class="btn-sobre" data-graine>Revenir à l’arborescence de départ</button>
      </details>
    </div>
    <div class="reg-inspecteur" data-inspecteur>${n ? await inspecteur(n, listeApps) : '<p class="reg-rien">Choisis une page dans la liste pour la renommer, la déplacer, changer son image ou sa couleur, ou lui ajouter des sous-pages.</p>'}</div>
  </div>
  <dialog class="reg-images" data-images aria-labelledby="images-titre"></dialog>`;
  zone.onclick = (e) => clicArbre(e, zone);
  zone.onchange = (e) => changeArbre(e, zone);
  zone.onsubmit = (e) => soumettreArbre(e, zone);
}
async function inspecteur(n, listeApps) {
  const haut = n.parent === arbre.RACINE, vs = await arbre.versions(n.id);
  const herite = !n.couleur, c = arbre.couleurs(n.id);
  return `<form class="reg-fiche" data-fiche="${esc(n.id)}">
    <div class="reg-fiche-tete">
      <button type="button" class="reg-image" data-ouvrir-images aria-label="Changer l’image de ${esc(n.nom)}" style="--c:${c.couleur}"><img src="${visuel(n)}" alt=""><span>Changer l’image</span></button>
      <div><p class="reg-type">${TYPES[n.type]}${haut ? ' du grand menu' : ''}</p><h2>${esc(n.nom)}</h2>
      <p class="reg-voir"><a href="${esc(arbre.lienDe(n))}">Ouvrir</a></p></div>
    </div>
    <label class="reg-champ"><span>Nom</span><input name="nom" value="${esc(n.nom)}" maxlength="60" required></label>
    <label class="reg-champ"><span>Description</span><textarea name="desc" rows="2" maxlength="240">${esc(n.desc || '')}</textarea></label>
    ${n.type === 'lien' ? `<label class="reg-champ"><span>Adresse</span><input name="lien" value="${esc(n.lien || '')}" placeholder="#/boite ou https://…" required></label>` : ''}
    ${n.type === 'app' ? `<label class="reg-champ"><span>Application</span><select name="app">${listeApps.map((a) => `<option value="${esc(a.id)}" ${a.id === n.app ? 'selected' : ''}>${esc(a.manifeste.nom)}${a.integree ? ' (livrée)' : ''}</option>`).join('')}</select></label>` : ''}
    <fieldset class="reg-champ reg-couleur"><legend>Couleur</legend>
      ${haut ? '' : `<label class="reg-coche"><input type="checkbox" name="herite" ${herite ? 'checked' : ''}><span>Comme son dossier</span></label>`}
      <label class="reg-pipette"><input type="color" name="couleur" value="${esc(n.couleur || c.couleur)}" ${!haut && herite ? 'disabled' : ''}><span>Choisir</span></label>
    </fieldset>
    ${haut ? `<fieldset class="reg-champ"><legend>Taille de la tuile</legend><div class="reg-choix">${[['m', 'Normale'], ['xl', 'Grande'], ['xxl', 'Très grande']].map(([v, l]) => `<label><input type="radio" name="taille" value="${v}" ${(n.taille || 'm') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>` : ''}
    <label class="reg-coche reg-epingle"><input type="checkbox" name="epingle" ${n.epingle ? 'checked' : ''}><span>Épinglé : en haut de l’Explorer, avec l’épingle sur sa tuile</span></label>
    <div class="reg-actions"><button type="submit" class="btn">Enregistrer</button></div>

    <fieldset class="reg-champ reg-place"><legend>Place</legend>
      <label><span>Ranger dans</span><select name="parent" data-parent>${dossiers(n.id).map(([id, nom]) => `<option value="${esc(id)}" ${id === n.parent ? 'selected' : ''}>${esc(nom)}</option>`).join('')}</select></label>
      <div class="reg-choix"><button type="button" class="btn-sobre" data-decaler="-1">Monter</button><button type="button" class="btn-sobre" data-decaler="1">Descendre</button></div>
    </fieldset>
    ${n.type === 'dossier' ? `<fieldset class="reg-champ"><legend>Ajouter dans « ${esc(n.nom)} »</legend><div class="reg-choix">
      <button type="button" class="btn-sobre" data-creer="page" data-dans="${esc(n.id)}">Une page</button>
      <button type="button" class="btn-sobre" data-creer="dossier" data-dans="${esc(n.id)}">Un dossier</button>
      <button type="button" class="btn-sobre" data-creer="lien" data-dans="${esc(n.id)}">Un lien</button>
      <button type="button" class="btn-sobre" data-creer="app" data-dans="${esc(n.id)}">Une app</button></div></fieldset>` : ''}
    ${n.type === 'page' ? `<p class="petit">Une page garde des notes et des fichiers. ${n.id.includes('/') ? 'Ses notes restent attachées à son identifiant, même si tu la renommes ou la déplaces.' : ''}</p>` : ''}
    ${vs.length ? `<details class="reg-champ"><summary>Anciennes versions (${vs.length})</summary><ul class="reg-versions">${vs.slice(0, 25).map((v) => `<li><span>${quand(v.date)}, ${esc(v.raison)} : « ${esc(v.donnees.nom)} »</span><button type="button" class="btn-sobre" data-revenir="${v.id}">Revenir à celle-ci</button></li>`).join('')}</ul></details>` : ''}
    ${n.systeme ? '' : `<div class="reg-danger"><button type="button" class="btn-sobre" data-corbeille>Mettre à la corbeille</button>
      <p class="petit">${n.type === 'dossier' && arbre.enfants(n.id).length ? 'Ses sous-pages partent avec lui. ' : ''}Tout se récupère depuis la corbeille.</p></div>`}
  </form>`;
}
const NOMS_NEUFS = { page: 'Nouvelle page', dossier: 'Nouveau dossier', lien: 'Nouveau lien', app: 'Nouvelle app' };
async function clicArbre(e, zone) {
  const t = e.target;
  const ch = t.closest('[data-choisir]');
  if (ch) { history.replaceState(null, '', `#/admin/arbre/${encodeURIComponent(ch.dataset.choisir)}`); choisi = ch.dataset.choisir; await ongletArbre(zone, choisi); $('[data-inspecteur] input[name="nom"]', zone)?.focus({ preventScroll: true }); $('[data-inspecteur]', zone).scrollIntoView({ block: 'start' }); return; }
  const cr = t.closest('[data-creer]');
  if (cr) {
    const type = cr.dataset.creer, dans = cr.dataset.dans;
    const champs = { type, nom: NOMS_NEUFS[type], parent: dans };
    if (type === 'lien') champs.lien = '#/boite';
    if (type === 'app') { const a = (await apps.toutes())[0]; champs.app = a.id; champs.nom = a.manifeste.nom; champs.icone = a.manifeste.icone && /^i\d{3}$/.test(a.manifeste.icone) ? a.manifeste.icone : 'i067'; }
    if (type === 'dossier' && dans === arbre.RACINE) Object.assign(champs, { taille: 'm', couleur: '#6b4a7a', encre: arbre.encreSur('#6b4a7a'), sticker: 'fees' });
    if (!champs.sticker && !champs.icone) champs.sticker = { page: 'papillon-bleu', dossier: 'champi-fantome', lien: 'colibri' }[type];
    const nv = await arbre.creer(champs);
    ctx.toast(`${NOMS_NEUFS[type]} créé${type === 'page' || type === 'app' ? 'e' : ''}`);
    history.replaceState(null, '', `#/admin/arbre/${encodeURIComponent(nv.id)}`);
    await ongletArbre(zone, nv.id); $('[data-inspecteur] input[name="nom"]', zone)?.select();
    return;
  }
  const form = t.closest('[data-fiche]');
  const id = form?.dataset.fiche;
  const dec = t.closest('[data-decaler]');
  if (dec) { await arbre.decaler(id, Number(dec.dataset.decaler)); await ongletArbre(zone, id); $(`[data-decaler="${dec.dataset.decaler}"]`, zone)?.focus(); return; }
  const rv = t.closest('[data-revenir]');
  if (rv) { await arbre.revenirA(rv.dataset.revenir); ctx.toast('Ancienne version remise'); await ongletArbre(zone, id); return; }
  const cb = t.closest('[data-corbeille]');
  if (cb) { deuxTemps(cb, 'Sûr ? Appuie encore', async () => { const parent = arbre.noeud(id).parent; await arbre.mettreCorbeille(id); ctx.toast('Mis à la corbeille'); choisi = parent === arbre.RACINE ? null : parent; history.replaceState(null, '', '#/admin/arbre'); await ongletArbre(zone, choisi); }); return; }
  if (t.closest('[data-ouvrir-images]')) { ouvrirImages(zone, id); return; }
  const g = t.closest('[data-graine]');
  if (g) { deuxTemps(g, 'Sûr ? L’arborescence actuelle sera gardée', async () => { await arbre.remettreGraine(); ctx.toast('Arborescence de départ remise'); choisi = null; await ongletArbre(zone); }); return; }
  const ag = t.closest('[data-arbre-garde]');
  if (ag) { deuxTemps(ag, 'Sûr ?', async () => { await arbre.remettreArbre(ag.dataset.arbreGarde); ctx.toast('Arborescence remise'); choisi = null; await ongletArbre(zone); }); return; }
  // le sélecteur d'images
  const img = t.closest('[data-prendre]');
  if (img) {
    const [genre, val] = img.dataset.prendre.split(':');
    const patch = { image: null, icone: null, sticker: null, hero: null };
    patch[genre === 'icone' ? 'icone' : 'sticker'] = val;
    const nid = $('[data-images]', zone).dataset.pour;
    await arbre.modifierNoeud(nid, patch, 'changement d’image');
    $('[data-images]', zone).close(); ctx.toast('Image changée'); await ongletArbre(zone, nid);
    return;
  }
  if (t.closest('[data-fermer-images]')) $('[data-images]', zone).close();
  const og = t.closest('[data-images-onglet]');
  if (og) { const d = $('[data-images]', zone); d.querySelectorAll('[data-images-onglet]').forEach((b) => b.setAttribute('aria-pressed', String(b === og))); d.querySelectorAll('[data-galerie]').forEach((x) => { x.hidden = x.dataset.galerie !== og.dataset.imagesOnglet; }); }
}
function changeArbre(e, zone) {
  const t = e.target;
  if (t.name === 'herite') { const c = $('input[name="couleur"]', zone); if (c) c.disabled = t.checked; }
  if (t.matches('[data-parent]')) {
    const id = t.closest('[data-fiche]').dataset.fiche;
    arbre.deplacer(id, t.value).then(() => { ctx.toast('Déplacé'); ongletArbre(zone, id); }, (err) => ctx.toast(err.message));
  }
  if (t.matches('[data-image-fichier]') && t.files[0]) importerImage(zone, t.files[0]);
}
async function soumettreArbre(e, zone) {
  e.preventDefault();
  const f = e.target.closest('[data-fiche]'); if (!f) return;
  const id = f.dataset.fiche, d = new FormData(f), n = arbre.noeud(id);
  const patch = { nom: String(d.get('nom') || '').trim() || n.nom, desc: String(d.get('desc') || '').trim(), epingle: d.has('epingle') };
  if (n.type === 'lien') patch.lien = String(d.get('lien') || '').trim();
  if (n.type === 'app') patch.app = d.get('app');
  if (n.parent === arbre.RACINE) patch.taille = d.get('taille') || 'm';
  if (n.parent !== arbre.RACINE && d.has('herite')) { patch.couleur = null; patch.encre = null; }
  else if (d.get('couleur')) { patch.couleur = d.get('couleur'); patch.encre = arbre.encreSur(patch.couleur); }
  await arbre.modifierNoeud(id, patch, 'modification');
  ctx.toast('Enregistré');
  await ongletArbre(zone, id);
}
function ouvrirImages(zone, id) {
  const d = $('[data-images]', zone), n = arbre.noeud(id);
  d.dataset.pour = id;
  d.innerHTML = `<div class="reg-images-corps">
    <h2 id="images-titre">L’image de « ${esc(n.nom)} »</h2>
    <div class="reg-choix" role="group" aria-label="Collections"><button type="button" class="btn-sobre" data-images-onglet="stickers" aria-pressed="true">Stickers</button><button type="button" class="btn-sobre" data-images-onglet="icones" aria-pressed="false">Icônes</button>
      <label class="btn-sobre reg-importer-image"><input type="file" accept="image/*" data-image-fichier hidden><span>Ta propre image</span></label></div>
    <ul class="reg-galerie" data-galerie="stickers">${STICKERS.map((s) => `<li><button type="button" data-prendre="sticker:${s}" aria-label="${esc(s.replace(/-/g, ' '))}"><img src="${IMG(s)}" alt="" loading="lazy"></button></li>`).join('')}</ul>
    <ul class="reg-galerie reg-galerie-icones" data-galerie="icones" hidden>${ICONES.map((s) => `<li><button type="button" data-prendre="icone:${s}" aria-label="Icône ${s.slice(1)}"><img src="${ICONE(s)}" alt="" loading="lazy" width="48" height="48"></button></li>`).join('')}</ul>
    <button type="button" class="btn" data-fermer-images>Fermer</button></div>`;
  d.showModal();
}
/** Une image à soi : réduite à 320 px en WebP, gardée dans le nœud (elle voyage avec les sauvegardes). */
async function importerImage(zone, f) {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/webp', 0.86);
    const nid = $('[data-images]', zone).dataset.pour;
    await arbre.modifierNoeud(nid, { image: url, icone: null, sticker: null, hero: null }, 'image importée');
    $('[data-images]', zone).close(); ctx.toast('Image changée'); await ongletArbre(zone, nid);
  } catch (e) { ctx.toast('Cette image n’a pas pu être lue'); }
}

/* =================== Applications =================== */
let paquetEnAttente = null;
async function ongletApps(zone) {
  const [inst, intg] = [await apps.installees(), apps.INTEGREES];
  const dossierOk = 'webkitdirectory' in document.createElement('input') && matchMedia('(pointer: fine)').matches;
  const carteApp = (a) => {
    const m = a.manifeste;
    return `<li class="reg-app">
      <img src="${m.icone && /^i\d{3}$/.test(m.icone) ? ICONE(m.icone) : ICONE('i067')}" alt="" aria-hidden="true">
      <div><h3>${esc(m.nom)} <small>version ${esc(m.version)}</small></h3>
      ${m.description ? `<p>${esc(m.description)}</p>` : ''}
      <p class="petit">${pl(a.fichiers.length, 'fichier')}, ${fichiers.poids(a.fichiers.reduce((s, f) => s + f.blob.size, 0))}. ${a.permissions.length ? `Peut ${a.permissions.map((p) => apps.PERMISSIONS[p]).join(', ')}.` : 'Ne voit rien de tes données.'}</p>
      <div class="reg-choix">
        <a class="btn" href="#/app/${encodeURIComponent(a.id)}">Ouvrir</a>
        <button type="button" class="btn-sobre" data-exporter="${esc(a.id)}">Exporter en .zip</button>
        <button type="button" class="btn-sobre" data-desinstaller="${esc(a.id)}">Désinstaller</button>
      </div>
      <label class="reg-coche"><input type="checkbox" data-effacer-donnees="${esc(a.id)}"><span>En désinstallant, effacer aussi ses données</span></label>
      <details data-anciennes="${esc(a.id)}"><summary>Anciennes versions</summary><div class="petit">Ouvre pour charger.</div></details>
      </div></li>`;
  };
  zone.innerHTML = `<div class="reg-apps">
    <section class="bloc reg-ajouter" aria-labelledby="ajout-titre">
      <h2 id="ajout-titre">Ajouter une application</h2>
      <p class="petit">Une app, c’est un dossier avec un fichier <b>app.json</b> et ses pages (HTML, CSS, JavaScript, images). Compresse-le en .zip pour l’ajouter depuis le téléphone. Elle tourne isolée : elle ne voit que ce que tu lui permets.</p>
      <div class="reg-choix">
        <label class="btn"><input type="file" accept=".zip,application/zip" data-zip hidden><span>Choisir un .zip</span></label>
        ${dossierOk ? '<label class="btn-sobre"><input type="file" webkitdirectory data-dossier-app hidden><span>Choisir un dossier</span></label>' : ''}
        <button type="button" class="btn-sobre" data-modele>Installer l’app modèle</button>
      </div>
      <div data-revue></div>
    </section>
    <section aria-labelledby="inst-titre"><h2 id="inst-titre" class="reg-sous-titre">Tes applications</h2>
      ${inst.length ? `<ul class="reg-apps-liste">${inst.map(carteApp).join('')}</ul>` : '<p class="petit">Aucune pour l’instant. L’app modèle montre comment en faire une : installe-la, ouvre-la, puis exporte-la pour la modifier.</p>'}
    </section>
    <section aria-labelledby="intg-titre"><h2 id="intg-titre" class="reg-sous-titre">Livrées avec My memories</h2>
      <ul class="reg-apps-liste">${intg.map((m) => `<li class="reg-app"><img src="${ICONE(m.icone)}" alt="" aria-hidden="true"><div><h3>${esc(m.nom)}</h3><p>${esc(m.description)}</p><div class="reg-choix"><a class="btn-sobre" href="#/app/${m.id}">Ouvrir</a></div></div></li>`).join('')}</ul>
      <p class="petit">Pour les ranger ailleurs ou les renommer : onglet Pages et dossiers.</p>
    </section></div>`;
  zone.onchange = async (e) => {
    const t = e.target;
    try {
      if (t.matches('[data-zip]') && t.files[0]) await revue(zone, await apps.lirePaquet(await apps.lireZip(t.files[0])));
      if (t.matches('[data-dossier-app]') && t.files.length) await revue(zone, await apps.lirePaquet([...t.files].map((f) => ({ chemin: f.webkitRelativePath || f.name, blob: f }))));
    } catch (err) { ctx.toast(`Paquet illisible : ${err.message}`); }
  };
  zone.onclick = async (e) => {
    const t = e.target;
    if (t.closest('[data-modele]')) { try { await revue(zone, await apps.paquetModele()); } catch (err) { ctx.toast(`App modèle indisponible : ${err.message}`); } return; }
    if (t.closest('[data-installer]')) { await installerPaquet(zone); return; }
    if (t.closest('[data-annuler-revue]')) { paquetEnAttente = null; $('[data-revue]', zone).innerHTML = ''; return; }
    const ex = t.closest('[data-exporter]');
    if (ex) { const blob = await apps.exporterZip(ex.dataset.exporter); telechargerBlob(blob, `${(await apps.trouver(ex.dataset.exporter)).manifeste.nom}.zip`); return; }
    const de = t.closest('[data-desinstaller]');
    if (de) {
      const id = de.dataset.desinstaller, eff = $(`[data-effacer-donnees="${CSS.escape(id)}"]`, zone)?.checked;
      deuxTemps(de, eff ? 'Sûr ? Ses données seront effacées' : 'Sûr ? Appuie encore', async () => {
        await apps.desinstaller(id, { effacerDonnees: eff });
        for (const n of arbre.tous().filter((x) => x.type === 'app' && x.app === id && !x.corbeille)) await arbre.mettreCorbeille(n.id);
        ctx.toast('App désinstallée (récupérable dans ses anciennes versions)'); ongletApps(zone);
      });
      return;
    }
    const rv = t.closest('[data-remettre-app]');
    if (rv) { await apps.remettreVersion(rv.dataset.remettreApp); ctx.toast('Version remise'); ongletApps(zone); }
  };
  zone.querySelectorAll('[data-anciennes]').forEach((d) => d.addEventListener('toggle', async () => {
    if (!d.open) return;
    const vs = await apps.anciennesVersions(d.dataset.anciennes);
    d.querySelector('div').innerHTML = vs.length ? `<ul class="reg-versions">${vs.map((v) => `<li><span>${quand(v.date)} : version ${esc(v.donnees.manifeste.version)}, ${esc(v.raison)}</span><button type="button" class="btn-sobre" data-remettre-app="${v.id}">Remettre</button></li>`).join('')}</ul>` : 'Aucune ancienne version.';
  }));
}
async function revue(zone, p) {
  paquetEnAttente = p.erreurs.length ? null : p;
  const z = $('[data-revue]', zone);
  if (p.erreurs.length) { z.innerHTML = `<div class="reg-revue erreur" role="alert"><h3>Ce paquet ne peut pas être installé</h3><ul>${p.erreurs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><button type="button" class="btn-sobre" data-annuler-revue>Fermer</button></div>`; return; }
  const m = p.manifeste, deja = await store.lire('apps', m.id).catch(() => null);
  const defaut = m.categorie && arbre.noeud(m.categorie)?.type === 'dossier' ? m.categorie : (arbre.tous().find((x) => x.type === 'app' && x.app === m.id && !x.corbeille)?.parent || 'creation');
  z.innerHTML = `<div class="reg-revue" role="region" aria-label="Avant d’installer">
    <h3>${esc(m.nom)} <small>version ${esc(m.version)}${deja ? `, remplace la version ${esc(deja.manifeste.version)}` : ''}</small></h3>
    ${m.description ? `<p>${esc(m.description)}</p>` : ''}
    <p class="petit">${pl(p.fichiers.length, 'fichier')}, ${fichiers.poids(p.taille)}.</p>
    <h4>Ce qu’elle pourra faire</h4>
    <ul class="reg-permissions">${m.permissions.length ? m.permissions.map((x) => `<li>${esc(apps.PERMISSIONS[x])}</li>`).join('') : '<li>Rien : elle garde seulement ses propres données.</li>'}
      ${m.materiel.map((x) => `<li>${esc(apps.MATERIEL[x])} (le navigateur te le redemandera)</li>`).join('')}</ul>
    ${p.avertissements.length ? `<ul class="petit">${p.avertissements.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${deja ? '' : `<label class="reg-champ"><span>La ranger dans</span><select data-ranger>${dossiers().map(([id, nom]) => `<option value="${esc(id)}" ${id === defaut ? 'selected' : ''}>${esc(nom)}</option>`).join('')}</select></label>`}
    <div class="reg-choix"><button type="button" class="btn" data-installer>${deja ? 'Mettre à jour' : 'Installer'}</button><button type="button" class="btn-sobre" data-annuler-revue>Annuler</button></div>
  </div>`;
  z.scrollIntoView({ block: 'nearest' });
}
async function installerPaquet(zone) {
  if (!paquetEnAttente) return;
  const ranger = $('[data-ranger]', zone)?.value;
  const { rec, miseAJour } = await apps.installer(paquetEnAttente);
  const m = rec.manifeste;
  if (!arbre.tous().some((x) => x.type === 'app' && x.app === m.id && !x.corbeille)) {
    await arbre.creer({ type: 'app', app: m.id, nom: m.nom, desc: m.description, parent: ranger || 'creation', icone: m.icone && /^i\d{3}$/.test(m.icone) ? m.icone : 'i067' });
  }
  paquetEnAttente = null;
  ctx.toast(miseAJour ? `${m.nom} mise à jour` : `${m.nom} installée`);
  await ongletApps(zone);
}

/* =================== Sauvegardes =================== */
async function ongletSauvegardes(zone) {
  const [pts, derniere, dos, estim] = [await sauvegarde.points(), await store.lireMeta('sauvegarde.derniere'), sauvegarde.dossierPossible() ? await sauvegarde.etatDossier() : null, await navigator.storage?.estimate?.().catch(() => null)];
  const partage = !!navigator.canShare;
  zone.innerHTML = `<div class="reg-sauv">
    <section class="bloc" aria-labelledby="arch-titre">
      <h2 id="arch-titre">Archive complète</h2>
      <p class="petit">Tout My memories dans un seul fichier .zip : pages, notes, fichiers, photos, apps, Carnet, Loge, Suite et réglages. Dernière archive : ${quand(derniere)}.${estim ? ` L’appli occupe ${fichiers.poids(estim.usage || 0)} sur cet appareil.` : ''}</p>
      <div class="reg-choix"><button type="button" class="btn" data-archive>Télécharger l’archive</button>${partage ? '<button type="button" class="btn-sobre" data-partager>Envoyer ailleurs (Drive, mail…)</button>' : ''}</div>
    </section>
    ${dos ? `<section class="bloc" aria-labelledby="dos-titre">
      <h2 id="dos-titre">Sauvegarde automatique sur ce PC</h2>
      ${dos.branche ? `<p class="petit">Dossier « ${esc(dos.nom)} » : une archive par jour, à l’ouverture de l’appli, les ${14} dernières gardées. Dernière : ${quand(dos.derniere)}.</p>
        ${dos.permission === 'granted' ? '' : '<p class="reg-alerte">Le navigateur demande ton accord à nouveau pour écrire dans ce dossier.</p>'}
        <div class="reg-choix"><button type="button" class="btn" data-dossier-maintenant>${dos.permission === 'granted' ? 'Sauvegarder maintenant' : 'Autoriser et sauvegarder'}</button><button type="button" class="btn-sobre" data-dossier-changer>Changer de dossier</button><button type="button" class="btn-sobre" data-dossier-arreter>Arrêter</button></div>`
      : `<p class="petit">Choisis un dossier du PC (par exemple dans Documents, ou un dossier synchronisé par OneDrive ou Google Drive) : My memories y déposera une archive chaque jour.</p>
        <div class="reg-choix"><button type="button" class="btn" data-dossier-changer>Choisir le dossier</button></div>`}
    </section>` : ''}
    <section class="bloc" aria-labelledby="ech-titre">
      <h2 id="ech-titre">Échanger entre le PC et le téléphone</h2>
      <p class="petit">Sans serveur, l’archive sert de messager. Sur l’appareil qui a du nouveau : « Télécharger l’archive » ou « Envoyer ailleurs » (Drive, mail, câble). Sur l’autre : « Choisir le fichier » ci-dessous, puis « Fusionner ». Pour chaque page, note, fichier ou app, la version la plus récente gagne ; l’autre reste dans les anciennes versions. Rien n’est perdu.</p>
      <p class="petit">Astuce PC : choisis comme dossier de sauvegarde automatique un dossier Google Drive ou OneDrive, le téléphone y trouve l’archive du jour.</p>
    </section>
    <section class="bloc" aria-labelledby="rem-titre">
      <h2 id="rem-titre">Fusionner ou remettre une archive</h2>
      <p class="petit">Une archive .zip, ou une ancienne sauvegarde .json. Tu vois ce qu’elle contient avant de confirmer ; un point de restauration est pris juste avant.</p>
      <label class="btn-sobre"><input type="file" accept=".zip,.json,application/zip,application/json" data-restaurer hidden><span>Choisir le fichier</span></label>
      <div data-resume></div>
    </section>
    <section class="bloc" aria-labelledby="pts-titre">
      <h2 id="pts-titre">Points de restauration</h2>
      <p class="petit">Des copies gardées sur cet appareil : une automatique par jour quand quelque chose a changé (les 5 dernières), et celles que tu prends. Les fichiers des pages sont compris ; les apps ont leurs propres anciennes versions.</p>
      <button type="button" class="btn-sobre" data-point>Prendre un point maintenant</button>
      ${pts.length ? `<ul class="reg-versions reg-points">${pts.map((p) => `<li><span><b>${quand(p.date)}</b>, ${esc(p.raison)}<small>${pl(p.resume.pages, 'page')}, ${pl(p.resume.notes, 'note')}, ${pl(p.resume.fichiers, 'fichier')}${p.manuel ? ', gardé' : ''}</small></span>
        <span class="reg-choix"><button type="button" class="btn-sobre" data-revenir-point="${p.id}">Revenir à ce point</button>${p.manuel ? `<button type="button" class="btn-sobre" data-effacer-point="${p.id}">Effacer</button>` : ''}</span></li>`).join('')}</ul>` : '<p class="petit">Aucun point pour l’instant.</p>'}
    </section></div>`;
  let lu = null;
  const faire = async (b, fn, ok) => { b.disabled = true; const t = b.textContent; b.textContent = 'Un instant…'; try { await fn(); if (ok) ctx.toast(ok); } catch (err) { ctx.toast(err.message || String(err)); } finally { if (b.isConnected) { b.disabled = false; b.textContent = t; } } };
  zone.onclick = async (e) => {
    const t = e.target, b = t.closest('button');
    if (!b) return;
    if (b.matches('[data-archive]')) return faire(b, async () => telechargerBlob(await sauvegarde.fabriquerArchive(), sauvegarde.nomArchive()), 'Archive téléchargée');
    if (b.matches('[data-partager]')) return faire(b, async () => {
      const f = new File([await sauvegarde.fabriquerArchive()], sauvegarde.nomArchive(), { type: 'application/zip' });
      if (!navigator.canShare({ files: [f] })) throw new Error('Cet appareil ne sait pas envoyer ce fichier : télécharge-le.');
      await navigator.share({ files: [f], title: 'Sauvegarde My memories' });
    });
    if (b.matches('[data-dossier-changer]')) return faire(b, async () => { await sauvegarde.choisirDossier(); await sauvegarde.ecrireDansDossier({ demander: true }); await ongletSauvegardes(zone); }, 'Dossier choisi, première archive déposée');
    if (b.matches('[data-dossier-maintenant]')) return faire(b, async () => { const r = await sauvegarde.ecrireDansDossier({ demander: true }); if (!r.ecrit) throw new Error('Accord refusé : rien n’a été écrit.'); await ongletSauvegardes(zone); }, 'Archive déposée dans le dossier');
    if (b.matches('[data-dossier-arreter]')) return deuxTemps(b, 'Sûr ? Les archives déjà faites restent', async () => { await sauvegarde.oublierDossier(); ongletSauvegardes(zone); });
    if (b.matches('[data-point]')) return faire(b, async () => { await sauvegarde.prendrePoint('pris à la main', { manuel: true }); await ongletSauvegardes(zone); }, 'Point de restauration pris');
    if (b.matches('[data-revenir-point]')) return deuxTemps(b, 'Sûr ? Appuie encore', () => faire(b, async () => { await sauvegarde.revenirAuPoint(b.dataset.revenirPoint); ctx.toast('Données remises comme à ce moment-là'); setTimeout(() => location.reload(), 700); }));
    if (b.matches('[data-effacer-point]')) return deuxTemps(b, 'Sûr ?', async () => { await sauvegarde.effacerPoint(b.dataset.effacerPoint); ongletSauvegardes(zone); });
    if (b.matches('[data-fusionner]') && lu) return faire(b, async () => {
      const r = await sauvegarde.fusionnerArchive(lu, { autres: !!$('[data-autres]', zone)?.checked });
      ctx.toast(`Échange fait : ${pl(r.ajoutes, 'ajout')}, ${pl(r.remplaces, 'mise à jour', 'mises à jour')}, ${pl(r.supprimes, 'suppression')}`);
      setTimeout(() => location.reload(), 1400);
    });
    if (b.matches('[data-remettre]') && lu) return deuxTemps(b, 'Sûr ? Tout sera remplacé', () => faire(b, async () => { await sauvegarde.remettreArchive(lu); ctx.toast('Sauvegarde remise'); setTimeout(() => location.reload(), 700); }));
  };
  zone.onchange = async (e) => {
    const t = e.target;
    if (!t.matches('[data-restaurer]') || !t.files[0]) return;
    const z = $('[data-resume]', zone);
    try {
      lu = await sauvegarde.lireArchive(t.files[0]);
      const r = lu.resume;
      z.innerHTML = `<div class="reg-revue"><h3>Sauvegarde du ${quand(r.date)}${r.appli ? ` (My memories ${esc(r.appli)})` : ''}</h3>
        <p>${pl(r.elements, 'note ou élément', 'notes et éléments')}, ${pl(r.pages, 'page')}, ${pl(r.fichiers, 'fichier')}, ${pl(r.apps, 'app')}${r.bases.length > 1 ? `, et les données de : ${esc(r.bases.filter((x) => x !== 'grenier').join(', '))}` : ''}${r.reglages ? `, ${pl(r.reglages, 'réglage')}` : ''}.</p>
        ${r.ancienne ? `<p class="petit">Ancienne sauvegarde : seuls les notes et les réglages internes seront remis ; tes pages et tes apps restent comme elles sont.</p>
        <button type="button" class="btn" data-remettre>Remettre cette sauvegarde</button>` : `<p class="petit"><b>Fusionner</b> : garde tout ce qui est ici, ajoute ce qui manque, prend les versions plus récentes. <b>Remplacer</b> : cet appareil devient une copie exacte de l’archive.</p>
        ${r.bases.length > 1 || r.reglages ? '<label class="reg-coche"><input type="checkbox" data-autres><span>En fusionnant, prendre aussi Carnet, Loge et Suite de l’archive (ils ne se fusionnent pas : ceux de cet appareil sont remplacés)</span></label>' : ''}
        <div class="reg-choix"><button type="button" class="btn" data-fusionner>Fusionner avec cet appareil</button><button type="button" class="btn-sobre" data-remettre>Tout remplacer</button></div>`}</div>`;
    } catch (err) { lu = null; z.innerHTML = `<p class="reg-alerte" role="alert">${esc(err.message)}</p>`; }
  };
}

/* =================== Corbeille =================== */
async function ongletCorbeille(zone) {
  const noeuds = arbre.corbeille(), fs = await fichiers.corbeille();
  zone.innerHTML = `<div class="reg-corbeille">
    <section class="bloc" aria-labelledby="cn-titre"><h2 id="cn-titre">Pages et dossiers</h2>
      ${noeuds.length ? `<ul class="reg-versions">${noeuds.map((n) => `<li><span><b>${esc(n.nom)}</b><small>${TYPES[n.type]}, jeté le ${quand(n.modifie)}${arbre.noeud(n.parentAvant) ? `, venait de « ${esc(arbre.noeud(n.parentAvant).nom)} »` : ''}</small></span>
        <span class="reg-choix"><button type="button" class="btn-sobre" data-recuperer="${esc(n.id)}">Récupérer</button><button type="button" class="btn-sobre" data-effacer="${esc(n.id)}">Effacer pour de bon</button></span></li>`).join('')}</ul>` : '<p class="petit">Rien dans la corbeille.</p>'}
      <p class="petit">Effacer une page ne supprime pas ses notes : elles restent dans Ressources.</p>
    </section>
    <section class="bloc" aria-labelledby="cf-titre"><h2 id="cf-titre">Fichiers</h2>
      ${fs.length ? `<ul class="reg-versions">${fs.map((f) => `<li><span><b>${esc(f.nom)}</b><small>${fichiers.poids(f.taille)}, dans « ${esc(arbre.pageDe(f.parent).nom)} »</small></span>
        <span class="reg-choix"><button type="button" class="btn-sobre" data-recuperer-fichier="${f.id}">Récupérer</button><button type="button" class="btn-sobre" data-effacer-fichier="${f.id}">Effacer pour de bon</button></span></li>`).join('')}</ul>` : '<p class="petit">Aucun fichier jeté.</p>'}
    </section></div>`;
  zone.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.recuperer) { await arbre.restaurer(b.dataset.recuperer); ctx.toast('Récupéré'); return ongletCorbeille(zone); }
    if (b.dataset.effacer) return deuxTemps(b, 'Sûr ? Impossible à annuler', async () => { await arbre.effacerDefinitivement(b.dataset.effacer); ctx.toast('Effacé'); ongletCorbeille(zone); });
    if (b.dataset.recupererFichier) { await fichiers.recuperer(b.dataset.recupererFichier); ctx.toast('Fichier récupéré'); return ongletCorbeille(zone); }
    if (b.dataset.effacerFichier) return deuxTemps(b, 'Sûr ? Impossible à annuler', async () => { await fichiers.effacerDefinitivement(b.dataset.effacerFichier); ctx.toast('Fichier effacé'); ongletCorbeille(zone); });
  };
}
