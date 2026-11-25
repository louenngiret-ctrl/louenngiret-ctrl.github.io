// Noyau du Grenier : navigation, accueil, capture rapide, ambiances, mises à jour.
import * as store from './store.js';
import { MALLES, malle } from './malles.js';
// carton ouvert, dessiné pour la Boîte vide
const CARTON = `<svg class="carton-vide" viewBox="0 0 160 120" aria-hidden="true">
  <path d="M30 52 L80 64 L130 52 L130 104 L80 116 L30 104 Z" fill="#b98a55" stroke="#6e4a26" stroke-width="2"/>
  <path d="M80 64 L80 116" stroke="#6e4a26" stroke-width="2"/>
  <path d="M30 52 L80 64 L130 52 L80 40 Z" fill="#5d3f22"/>
  <path d="M30 52 L10 34 L58 24 L80 40 Z" fill="#c9a06a" stroke="#6e4a26" stroke-width="2"/>
  <path d="M130 52 L152 36 L104 24 L80 40 Z" fill="#d2ab75" stroke="#6e4a26" stroke-width="2"/>
  <path d="M38 76 L72 84" stroke="#e9dcc0" stroke-width="7" opacity=".75"/>
  <text x="105" y="94" text-anchor="middle" transform="rotate(-12 105 94)" font-family="Permanent Marker, cursive" font-size="11.5" fill="#3a2414">À TRIER</text>
</svg>`;


const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vue = $('#vue');
let VERSION = '…';

/* ---------- Ambiances ---------- */
const AMBIANCES = [
  ['auto', 'Automatique', 'liège le jour, nuit le soir'],
  ['liege', 'Liège', 'le tableau en liège'],
  ['kraft', 'Kraft', 'papier brun et carton'],
  ['nuit', 'Nuit', 'le grenier à la bougie'],
];
function lireAmbiance() { try { return localStorage.getItem('grenier.ambiance') || 'auto'; } catch (e) { return 'auto'; } }
function appliquerAmbiance(a) {
  const h = new Date().getHours();
  const reelle = a === 'auto' ? (h >= 20 || h < 7 ? 'nuit' : 'liege') : a;
  document.documentElement.dataset.amb = reelle;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = { liege: '#3a2618', kraft: '#4a3622', nuit: '#14110f' }[reelle];
}
function choisirAmbiance(a) { try { localStorage.setItem('grenier.ambiance', a); } catch (e) { /* rien */ } appliquerAmbiance(a); }

/* ---------- Petits outils ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
const JOURS = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const QUAND = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function moment() {
  const h = new Date().getHours();
  if (h < 6 || h >= 21) return { nom: 'nuit', ciel: '#1d2747', lueur: 'rgba(150,170,255,.18)', salut: 'Bonsoir' };
  if (h < 10) return { nom: 'matin', ciel: '#f4c47c', lueur: 'rgba(255,205,130,.32)', salut: 'Bonjour' };
  if (h < 17) return { nom: 'jour', ciel: '#cfe4ec', lueur: 'rgba(255,245,215,.30)', salut: 'Bonjour' };
  return { nom: 'soir', ciel: '#ec8d52', lueur: 'rgba(255,150,90,.30)', salut: 'Bonsoir' };
}
const estLien = (t) => /^https?:\/\/\S+$/i.test(t.trim());

/* ---------- Le grenier (scène d'accueil) ---------- */
function scene() {
  const m = moment();
  const lune = m.nom === 'nuit' ? '<circle cx="372" cy="96" r="9" fill="#f6efd8"/><circle cx="376" cy="93" r="8" fill="#1d2747"/>' : '';
  return `
  <svg class="scene" viewBox="0 0 720 300" preserveAspectRatio="xMidYMax meet" overflow="visible" role="img" aria-label="Le grenier, sous la charpente, au ${m.nom}">
    <defs>
      <linearGradient id="g-rayon" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${m.lueur}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>
      </linearGradient>
      <pattern id="g-planches" width="120" height="22" patternUnits="userSpaceOnUse">
        <rect width="120" height="22" fill="var(--plancher)"/>
        <path d="M0 21.5H120M70 0V22" stroke="var(--joint)" stroke-width="1.4"/>
      </pattern>
    </defs>
    <rect x="-1400" y="-600" width="3520" height="1200" fill="var(--fond-scene)"/>
    <polygon points="360,22 -1400,1087 2120,1087" fill="var(--mur)"/>
    <polygon points="360,96 290,300 430,300" fill="url(#g-rayon)" class="rayon"/>
    <g class="lucarne">
      <circle cx="360" cy="100" r="34" fill="${m.ciel}"/>${lune}
      <circle cx="360" cy="100" r="34" fill="none" stroke="var(--poutre)" stroke-width="7"/>
      <path d="M360 66V134M326 100H394" stroke="var(--poutre)" stroke-width="5"/>
    </g>
    <path d="M360 14L-1400 1079M360 14L2120 1079" stroke="var(--poutre)" stroke-width="22" stroke-linecap="round"/>
    <path d="M140 150L140 262M580 150L580 262M-160 262V340M880 262V340" stroke="var(--poutre-ombre)" stroke-width="14"/>
    <path d="M96 176H624" stroke="var(--poutre)" stroke-width="12"/>
    <rect x="-1400" y="262" width="3520" height="400" fill="url(#g-planches)"/>
  </svg>`;
}

function carteMalle(m, compte) {
  const tampon = { demenagement: 'en déménagement', vide: 'à remplir', preparation: 'en préparation', ouverte: compte ? `${compte} dedans` : 'vide pour l’instant' }[m.etat];
  return `
  <a class="malle malle-${m.etat}" href="${esc(m.lien || `#/malle/${m.id}`)}" style="--bois:${m.bois};--etiq:${m.etiquette}">
    <span class="malle-couvercle" aria-hidden="true"></span>
    <span class="malle-corps">
      <span class="etiquette">
        <span class="scotch" aria-hidden="true"></span>
        <b>${esc(m.nom)}</b>
        <small>${esc(m.sous)}</small>
      </span>
    </span>
    <span class="tampon">${esc(tampon)}</span>
  </a>`;
}

// Carnet V2 vit dans malles/carnet/ et garde son propre stockage (localStorage « carnet.state ») :
// on le lit seulement pour afficher combien chaque malle contient.
function comptesCarnet() {
  try {
    const s = JSON.parse(localStorage.getItem('carnet.state') || 'null');
    if (!s) return {};
    const items = Array.isArray(s.items) ? s.items.length : 0;
    const pieces = s.wr && Array.isArray(s.wr.pieces) ? s.wr.pieces.length : 0;
    return { achats: items, 'garde-robe': pieces };
  } catch (e) { return {}; }
}

async function vueAccueil() {
  const m = moment();
  const boite = await store.parMalle('boite').catch(() => []);
  const loge = await store.parMalle('loge').catch(() => []);
  const comptes = { boite: boite.length, loge: loge.length, ...comptesCarnet() };
  vue.innerHTML = `
  <section class="accueil">
    <header class="haut">
      ${scene()}
      <div class="haut-texte">
        <h1>Grenier</h1>
        <p>${m.salut} Louenn · ${esc(JOURS.format(new Date()))}</p>
      </div>
    </header>
    <div class="plancher">
      <h2 class="sr">Les malles</h2>
      <div class="malles">${MALLES.map((x) => carteMalle(x, comptes[x.id])).join('')}</div>
      ${boite.length ? `
      <div class="dernier">
        <span class="dernier-titre">Dernière chose capturée</span>
        <p>${esc(boite[0].texte || boite[0].titre || 'Une photo').slice(0, 160)}</p>
      </div>` : `
      <p class="astuce">Appuie sur <b>+</b> pour jeter une idée dans la Boîte à trier, d'où que tu sois dans le Grenier.</p>`}
      <div id="installer-zone"></div>
    </div>
    ${pied()}
  </section>`;
  majBoutonInstaller();
}

function pied() {
  return `<footer class="pied">
    <a href="#/reglages">Réglages</a><span aria-hidden="true">·</span>
    <a href="#/nouveautes">Quoi de neuf</a><span aria-hidden="true">·</span>
    <span>version ${esc(VERSION)}</span>
  </footer>`;
}

function barre(titre, retour = '#/') {
  return `<nav class="barre"><a class="retour" href="${retour}" aria-label="Retour au grenier">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Grenier</span></a>
    <h1>${esc(titre)}</h1></nav>`;
}

/* ---------- Malles ---------- */
async function vueMalle(id) {
  if (id === 'boite') return vueBoite();
  const m = malle(id);
  if (!m) return go('#/');
  if (m.lien) { location.href = m.lien; return; }
  vue.innerHTML = `${barre(m.nom)}
  <section class="page">
    <div class="carton" style="--etiq:${m.etiquette}">
      <span class="scotch" aria-hidden="true"></span>
      <p class="carton-tampon">${m.etat === 'vide' ? 'place libre' : 'déménagement en cours'}</p>
      <p>${esc(m.message)}</p>
      ${m.etat === 'demenagement' ? `<p class="petit">En attendant, garde une sauvegarde à jour de Carnet V2 : dans Carnet, palette de commandes, « Sauvegarder mes données ». C'est ce fichier que le Grenier importera.</p>` : ''}
    </div>
  </section>${pied()}`;
}

async function vueBoite() {
  const items = await store.parMalle('boite').catch(() => []);
  libererPhotos();
  vue.innerHTML = `${barre('Boîte à trier')}
  <section class="page">
    <form class="ajout" id="ajout">
      <label for="ajout-texte" class="sr">Ajouter à la boîte</label>
      <input id="ajout-texte" type="text" autocomplete="off" placeholder="Une idée, un lien…">
      <button class="btn" type="submit">Ranger</button>
    </form>
    ${items.length ? `<ul class="postits">${items.map(postit).join('')}</ul>`
      : `<div class="vide">${CARTON}<p>La boîte est vide.</p><p class="petit">Tout ce que tu captures avec le bouton + arrive ici. Le tri vers les malles arrivera plus tard.</p></div>`}
  </section>${pied()}`;
  $('#ajout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#ajout-texte').value.trim();
    if (!t) return;
    await capturer(t);
    vueBoite().then(() => $('#ajout-texte').focus());
  });
}

// Les photos sont des Blob dans IndexedDB : on leur donne une adresse temporaire, libérée au rendu suivant.
let urlsPhotos = [];
function libererPhotos() { urlsPhotos.forEach((u) => URL.revokeObjectURL(u)); urlsPhotos = []; }

function postit(el, i) {
  const tourne = [-1.4, 1, -0.6, 1.6, -1][i % 5];
  const texte = el.texte || '';
  const url = (el.url || (el.type === 'lien' ? texte.trim() : '')).trim();
  const lienSur = /^https?:\/\/\S+$/i.test(url);
  const reste = lienSur ? texte.replace(url, '').trim() : texte;
  let image = '';
  if (el.type === 'photo' && el.fichier instanceof Blob) {
    const u = URL.createObjectURL(el.fichier);
    urlsPhotos.push(u);
    image = `<img src="${u}" alt="${esc(el.titre || 'Photo')}" loading="lazy">`;
  }
  const corps = (reste ? `<p>${esc(reste).replace(/\n/g, '<br>')}</p>` : '')
    + (lienSur ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\/(www\.)?/, ''))}</a></p>` : '');
  const partage = (el.etiquettes || []).includes('partage') ? '<span class="partage">partagé</span>' : '';
  return `<li class="postit${image ? ' polaroid' : ''}" style="--tourne:${tourne}deg">
    ${image}${corps}
    <div class="postit-pied">
      <time datetime="${new Date(el.cree).toISOString()}">${esc(QUAND.format(el.cree))}</time>${partage}
      <button type="button" class="jeter" data-jeter="${esc(el.id)}">Jeter</button>
    </div>
  </li>`;
}

// Photo réduite à 1600 px de côté en JPEG ; si quelque chose échoue, on garde l'originale.
async function compresserPhoto(fichier) {
  try {
    const img = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return b && b.size < fichier.size ? b : fichier;
  } catch (e) { return fichier; }
}

async function capturer(texte, photo) {
  const t = (texte || '').trim();
  if (!t && !photo) return false;
  const titre = t.split('\n')[0].slice(0, 80);
  if (photo) {
    const fichier = await compresserPhoto(photo);
    await store.ajouter({ malle: 'boite', type: 'photo', texte: t, titre: titre || 'Photo', fichier });
  } else {
    const lien = estLien(t);
    await store.ajouter({ malle: 'boite', type: lien ? 'lien' : 'note', texte: t, titre, url: lien ? t : undefined });
  }
  store.demanderPersistance();
  navigator.vibrate?.(12);
  toast('Rangé dans la Boîte à trier');
  return true;
}

/* ---------- Quoi de neuf ---------- */
async function chargerVersion() {
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    const v = await r.json();
    VERSION = v.version;
    return v;
  } catch (e) { return null; }
}

async function vueNouveautes() {
  const v = await chargerVersion();
  const hist = v ? v.historique : [];
  vue.innerHTML = `${barre('Quoi de neuf')}
  <section class="page">
    ${hist.length ? hist.map((h) => `
      <article class="carton nouveaute" style="--etiq:#f2e6c4">
        <span class="scotch" aria-hidden="true"></span>
        <p class="carton-tampon">version ${esc(h.version)} · ${esc(new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        <h2>${esc(h.titre)}</h2>
        <ul>${h.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </article>`).join('') : '<p class="vide">Impossible de lire les nouveautés hors connexion.</p>'}
  </section>${pied()}`;
}

/* ---------- Réglages ---------- */
async function vueReglages() {
  const actuelle = lireAmbiance();
  let persiste = false;
  try { persiste = navigator.storage && (await navigator.storage.persisted()); } catch (e) { /* rien */ }
  vue.innerHTML = `${barre('Réglages')}
  <section class="page reglages">
    <fieldset class="bloc">
      <legend>Ambiance</legend>
      <div class="ambiances">${AMBIANCES.map(([id, nom, desc]) => `
        <label class="amb amb-${id}">
          <input type="radio" name="amb" value="${id}" ${id === actuelle ? 'checked' : ''}>
          <span class="amb-pastille" aria-hidden="true"></span>
          <span><b>${nom}</b><small>${desc}</small></span>
        </label>`).join('')}
      </div>
    </fieldset>
    <div class="bloc">
      <h2>Appli</h2>
      <div id="installer-zone"></div>
      <p class="ligne"><span>Version installée</span><b>${esc(VERSION)}</b></p>
      <button type="button" class="btn-sobre" id="verifier">Chercher une mise à jour</button>
    </div>
    <div class="bloc">
      <h2>Mes données</h2>
      <p class="petit">Tout reste sur cet appareil${persiste ? ', protégé contre le nettoyage automatique du navigateur' : ''}. La synchronisation entre le PC et le téléphone arrive plus tard : d'ici là, garde une sauvegarde.</p>
      <button type="button" class="btn" id="sauver">Télécharger une sauvegarde</button>
    </div>
  </section>${pied()}`;
  vue.querySelectorAll('input[name="amb"]').forEach((r) => r.addEventListener('change', () => choisirAmbiance(r.value)));
  $('#sauver').addEventListener('click', async () => {
    const data = await store.exporter();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grenier sauvegarde ${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await store.ecrireMeta('derniereSauvegarde', Date.now());
    toast('Sauvegarde téléchargée');
  });
  $('#verifier').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return toast('Mises à jour indisponibles ici');
    await reg.update();
    toast(reg.waiting || reg.installing ? 'Nouvelle version trouvée' : 'Tu as déjà la dernière version');
  });
  majBoutonInstaller();
}

/* ---------- Installation ---------- */
let invitation = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitation = e; majBoutonInstaller(); });
window.addEventListener('appinstalled', () => { invitation = null; majBoutonInstaller(); toast('Le Grenier est installé'); });
function majBoutonInstaller() {
  const z = $('#installer-zone');
  if (!z) return;
  z.innerHTML = invitation ? '<button type="button" class="btn installer" id="installer">Installer le Grenier sur cet appareil</button>' : '';
  const b = $('#installer');
  if (b) b.addEventListener('click', async () => { invitation.prompt(); await invitation.userChoice; invitation = null; majBoutonInstaller(); });
}

/* ---------- Capture rapide : texte, dictée, photo ---------- */
const dlg = $('#capture');
let photoChoisie = null;
let urlApercu = null;
function retirerPhoto() {
  photoChoisie = null;
  if (urlApercu) URL.revokeObjectURL(urlApercu);
  urlApercu = null;
  $('#capture-apercu').hidden = true;
  $('#capture-photo').value = '';
}
$('#capture-photo').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  retirerPhoto();
  photoChoisie = f;
  urlApercu = URL.createObjectURL(f);
  $('#capture-apercu img').src = urlApercu;
  $('#capture-apercu').hidden = false;
});
$('#capture-retirer').addEventListener('click', retirerPhoto);

// Dictée : visible seulement si le navigateur sait faire. Sur Android, une phrase par appui.
const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
const btnDicter = $('#capture-dicter');
let reco = null;
let ecoute = false;
function arreterDictee() { if (reco && ecoute) { try { reco.stop(); } catch (e) { /* rien */ } } }
if (Reco) {
  btnDicter.hidden = false;
  btnDicter.addEventListener('click', () => {
    if (ecoute) { arreterDictee(); return; }
    const zone = $('#capture-texte');
    const avant = zone.value.trim();
    reco = new Reco();
    reco.lang = 'fr-FR';
    reco.interimResults = true;
    reco.onresult = (ev) => {
      let dit = '';
      for (const r of ev.results) dit += r[0].transcript;
      zone.value = (avant ? avant + ' ' : '') + dit.trim();
    };
    reco.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('Micro refusé : autorise-le pour le Grenier');
      else if (ev.error === 'network') toast('La dictée a besoin d\'internet');
      else if (ev.error === 'no-speech') toast('Je n\'ai rien entendu');
    };
    reco.onend = () => {
      ecoute = false;
      btnDicter.classList.remove('actif');
      btnDicter.querySelector('span').textContent = 'Dicter';
    };
    try {
      reco.start();
      ecoute = true;
      btnDicter.classList.add('actif');
      btnDicter.querySelector('span').textContent = 'J\'écoute';
      navigator.vibrate?.(8);
    } catch (e) { toast('La dictée n\'a pas pu démarrer'); }
  });
}

function ouvrirCapture() {
  $('#capture-texte').value = '';
  retirerPhoto();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  setTimeout(() => $('#capture-texte').focus(), 40);
}
function fermerCapture() {
  arreterDictee();
  if (dlg.open) dlg.close();
}
$('#capture-btn').addEventListener('click', ouvrirCapture);
$('#capture-annuler').addEventListener('click', fermerCapture);
dlg.addEventListener('click', (e) => { if (e.target === dlg) fermerCapture(); });
$('#capture-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  arreterDictee();
  const ok = await capturer($('#capture-texte').value, photoChoisie);
  if (!ok) { toast('Écris, dicte ou ajoute une photo'); return; }
  retirerPhoto();
  fermerCapture();
  route();
});
$('#capture-texte').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#capture-form').requestSubmit();
});

/* Jeter un post-it : deux appuis, sans fenêtre système */
vue.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-jeter]');
  if (!b) return;
  if (!b.classList.contains('sur')) {
    b.classList.add('sur'); b.textContent = 'Sûr ?';
    setTimeout(() => { if (b.isConnected) { b.classList.remove('sur'); b.textContent = 'Jeter'; } }, 3000);
    return;
  }
  await store.supprimer(b.dataset.jeter);
  toast('Jeté');
  vueBoite();
});

/* ---------- Navigation ---------- */
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  fermerCapture();
  if (a === 'capture') { await vueAccueil(); ouvrirCapture(); history.replaceState(null, '', '#/'); }
  else if (a === 'malle' && b) await vueMalle(b);
  else if (a === 'boite') await vueMalle('boite');
  else if (a === 'nouveautes') await vueNouveautes();
  else if (a === 'reglages') await vueReglages();
  else await vueAccueil();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- Mises à jour automatiques ---------- */
function proposerMaj(reg) {
  const bandeau = $('#maj');
  bandeau.hidden = false;
  $('#maj-go').onclick = () => { if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); };
}
async function brancherServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) proposerMaj(reg);
    reg.addEventListener('updatefound', () => {
      const nv = reg.installing;
      nv?.addEventListener('statechange', () => {
        if (nv.state === 'installed' && navigator.serviceWorker.controller) proposerMaj(reg);
      });
    });
    let recharge = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recharge) { recharge = true; location.reload(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  } catch (e) { /* hors https ou navigateur sans service worker */ }
}

/* ---------- Partage reçu d'une autre appli (voir sw.js, recevoirPartage) ---------- */
function annoncerPartage() {
  const p = new URLSearchParams(location.search);
  if (!p.has('recu')) return;
  const n = Number(p.get('recu'));
  history.replaceState(null, '', location.pathname + (location.hash || '#/boite'));
  const msg = n > 1 ? `${n} choses reçues dans la Boîte à trier`
    : n === 1 ? 'Reçu dans la Boîte à trier'
    : n === 0 ? 'Rien à ranger dans ce partage'
    : 'Le partage n\'a pas pu être rangé';
  setTimeout(() => toast(msg), 350);
}

/* ---------- Démarrage ---------- */
annoncerPartage();
appliquerAmbiance(lireAmbiance());
setInterval(() => appliquerAmbiance(lireAmbiance()), 10 * 60 * 1000);
chargerVersion().finally(route);
brancherServiceWorker();
