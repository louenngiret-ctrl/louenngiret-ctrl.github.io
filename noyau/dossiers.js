// La page « Dossiers épinglés » (#/pc et #/pc/<épingle>/<chemin>) : voir, ouvrir, modifier, ranger les fichiers
// de l'appareil depuis My memories. Le travail sur le disque est dans noyau/pc.js.
import * as pc from './pc.js';
import * as arbre from './arbre.js';
import * as fichiers from './fichiers.js';
import { IMG, ICONE } from './plan.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const DATEH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ext = (n) => (n.includes('.') ? n.split('.').pop().slice(0, 4) : '');
const enc = (c) => c.split('/').map(encodeURIComponent).join('/');
let urls = [];
const url = (b) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
function deuxTemps(b, question, action) {
  if (!b.classList.contains('sur')) { const t = b.textContent; b.classList.add('sur'); b.textContent = question; setTimeout(() => { if (b.isConnected && b.classList.contains('sur')) { b.classList.remove('sur'); b.textContent = t; } }, 4000); return; }
  b.classList.remove('sur'); action();
}
const pages = () => arbre.tous().filter((n) => n.type === 'page' && !n.corbeille).map((n) => [n.id, arbre.chemin(n.id).map((x) => x.nom).join(' › ')]).sort((a, b) => a[1].localeCompare(b[1], 'fr'));

function cadre(titre, fil, corps) {
  const c = arbre.couleurs('gestion');
  return `<section class="mm-page pc" style="--c:${c.couleur};--e:${c.encre}" aria-labelledby="mm-titre">
    <header class="mm-bandeau petit-bandeau">
      <nav class="mm-fil" aria-label="Où tu es"><ol>${fil.map(([n, l], i) => `<li>${l && i < fil.length - 1 ? `<a href="${l}">${esc(n)}</a>` : `<span aria-current="page">${esc(n)}</span>`}</li>`).join('')}</ol></nav>
      <h1 id="mm-titre">${esc(titre)}</h1>
      <p>Les dossiers et fichiers de cet appareil, ouverts depuis My memories. Chaque appareil a ses propres épingles.</p>
      <img class="mm-bandeau-img" src="${IMG('chat-aile')}" alt="" aria-hidden="true">
    </header>${corps}<dialog class="mm-fiche" data-fiche></dialog></section>`;
}

export async function rendreDossiers(vue, chemin, { pied, toast }) {
  urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  const [epId, ...reste] = (chemin || '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!pc.possible()) {
    vue.innerHTML = cadre('Dossiers épinglés', [['Accueil', '#/accueil'], ['Dossiers épinglés']], `<p class="mm-chantier">Ce navigateur ne sait pas ouvrir les dossiers de l’appareil. Ouvre My memories dans Chrome ou Edge sur le PC (ou Chrome à jour sur le téléphone).</p>`) + pied;
    return;
  }
  if (!epId) return accueil(vue, { pied, toast });
  const e = await pc.epingle(epId);
  if (!e) { location.replace('#/pc'); return; }
  if ((await pc.acces(e.handle)) !== 'granted') {
    vue.innerHTML = cadre(e.nom, [['Accueil', '#/accueil'], ['Dossiers épinglés', '#/pc'], [e.nom]], `<div class="pc-acces"><p>Le navigateur demande ton accord à chaque nouvelle session pour ouvrir « ${esc(e.nom)} ».</p><button type="button" class="btn" data-acces>Rouvrir l’accès</button></div>`) + pied;
    vue.onclick = async (ev) => { if (ev.target.closest('[data-acces]')) { if ((await pc.acces(e.handle, true)) === 'granted') rendreDossiers(vue, chemin, { pied, toast }); else toast('Accès refusé'); } };
    return;
  }
  if (e.genre === 'fichier') return ouvrirFichierSeul(vue, e, { pied, toast });
  return dossier(vue, e, reste.join('/'), { pied, toast });
}

/* ---------- La liste des épingles ---------- */
async function accueil(vue, { pied, toast }) {
  const l = await pc.epingles();
  const etats = await Promise.all(l.map((e) => pc.acces(e.handle)));
  vue.innerHTML = cadre('Dossiers épinglés', [['Accueil', '#/accueil'], ['Dossiers épinglés']], `
    <div class="pc-actions"><button type="button" class="btn" data-epingler-dossier>Épingler un dossier</button><button type="button" class="btn-sobre" data-epingler-fichiers>Épingler des fichiers</button></div>
    ${l.length ? `<ul class="pc-epingles">${l.map((e, i) => `<li class="pc-epingle">
      <a href="#/pc/${encodeURIComponent(e.id)}"><img src="${ICONE(e.genre === 'dossier' ? 'i075' : 'i089')}" alt="" aria-hidden="true"><span><b>${esc(e.nom)}</b><small>${e.genre === 'dossier' ? 'Dossier' : 'Fichier'}${etats[i] === 'granted' ? '' : ', accès à redonner'}</small></span></a>
      <button type="button" class="btn-sobre" data-retirer="${esc(e.id)}">Retirer l’épingle</button></li>`).join('')}</ul>`
    : '<p class="mm-chantier">Rien d’épinglé. Épingle un dossier de travail (montages, cours, BTS…) : tu le retrouves ici, tu ouvres et modifies ses fichiers, tu les copies dans tes pages.</p>'}
    <p class="petit pc-note">Retirer une épingle ne supprime rien sur le disque. Pour emporter un fichier sur un autre appareil : « Copier dans une page », puis un échange (Administration, Sauvegardes).</p>`) + pied;
  vue.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    try {
      if (b.matches('[data-epingler-dossier]')) { const e = await pc.epinglerDossier(); toast(`« ${e.nom} » épinglé`); location.hash = `#/pc/${encodeURIComponent(e.id)}`; }
      else if (b.matches('[data-epingler-fichiers]')) { const n = await pc.epinglerFichiers(); toast(n.length ? `${n.length} fichier${n.length > 1 ? 's' : ''} épinglé${n.length > 1 ? 's' : ''}` : 'Déjà épinglé'); accueil(vue, { pied, toast }); }
      else if (b.dataset.retirer) deuxTemps(b, 'Sûr ? Le disque n’est pas touché', async () => { await pc.retirer(b.dataset.retirer); toast('Épingle retirée'); accueil(vue, { pied, toast }); });
    } catch (err) { if (err.name !== 'AbortError') toast(err.message); }
  };
}

/* ---------- Un dossier ---------- */
async function dossier(vue, e, chemin, { pied, toast }) {
  let d;
  try { d = await pc.dossierAu(e, chemin); } catch (err) { toast('Ce dossier n’existe plus'); location.replace(`#/pc/${encodeURIComponent(e.id)}`); return; }
  const l = await pc.entrees(d);
  const morceaux = chemin.split('/').filter(Boolean);
  const fil = [['Accueil', '#/accueil'], ['Dossiers épinglés', '#/pc'], [e.nom, `#/pc/${encodeURIComponent(e.id)}`], ...morceaux.map((m, i) => [m, `#/pc/${encodeURIComponent(e.id)}/${enc(morceaux.slice(0, i + 1).join('/'))}`])];
  const ici = (n) => `#/pc/${encodeURIComponent(e.id)}/${enc([...morceaux, n].join('/'))}`;
  vue.innerHTML = cadre(morceaux.at(-1) || e.nom, fil, `
    <div class="pc-actions">
      <label class="btn"><input type="file" multiple data-deposer hidden><span>Ajouter des fichiers ici</span></label>
      <button type="button" class="btn-sobre" data-nouveau-texte>Nouveau texte</button>
      <button type="button" class="btn-sobre" data-nouveau-dossier>Nouveau dossier</button>
    </div>
    ${l.length ? `<ul class="pc-liste">${l.slice(0, pc.MAX).map((x) => x.genre === 'dossier'
      ? `<li><a class="pc-ligne" href="${ici(x.nom)}"><img src="${ICONE('i075')}" alt="" aria-hidden="true"><span><b>${esc(x.nom)}</b><small>Dossier</small></span></a></li>`
      : `<li><button type="button" class="pc-ligne" data-fichier="${esc(x.nom)}"><span class="mm-fichier-type" aria-hidden="true">${esc(ext(x.nom))}</span><span><b>${esc(x.nom)}</b><small>${fichiers.poids(x.taille)}${x.modifie ? `, ${DATEH.format(new Date(x.modifie))}` : ''}</small></span></button></li>`).join('')}</ul>
      ${l.length > pc.MAX ? `<p class="petit">Les ${pc.MAX} premiers éléments seulement.</p>` : ''}` : '<p class="petit mm-vide">Dossier vide.</p>'}`) + pied;
  const recharger = () => dossier(vue, e, chemin, { pied, toast });
  vue.onchange = async (ev) => {
    const inp = ev.target.closest('[data-deposer]'); if (!inp || !inp.files.length) return;
    try { await pc.deposer(d, [...inp.files]); toast(`${inp.files.length} fichier${inp.files.length > 1 ? 's' : ''} ajouté${inp.files.length > 1 ? 's' : ''} sur le disque`); recharger(); } catch (err) { toast(err.message); }
  };
  vue.onclick = async (ev) => {
    const t = ev.target;
    try {
      if (t.closest('[data-nouveau-texte]')) { const fh = await pc.creerFichier(d, 'Nouveau texte.txt', ''); await recharger(); ficheFichier(vue, { e, d, chemin, fh, toast, apres: recharger }); return; }
      if (t.closest('[data-nouveau-dossier]')) { const nd = await pc.creerDossier(d, 'Nouveau dossier'); toast(`« ${nd.name} » créé`); recharger(); return; }
      const f = t.closest('[data-fichier]');
      if (f) ficheFichier(vue, { e, d, chemin, fh: await d.getFileHandle(f.dataset.fichier), toast, apres: recharger });
    } catch (err) { toast(err.message); }
  };
}

/* ---------- La fiche d'un fichier du disque ---------- */
async function ficheFichier(vue, { e, d, chemin, fh, toast, apres }) {
  const f = await fh.getFile(), dlg = $('[data-fiche]', vue);
  const cible = pc.cibleDe(e.id, [chemin, fh.name].filter(Boolean).join('/'));
  const texte = fichiers.estTexte({ mime: f.type, nom: f.name }) && f.size < 2 * 1048576;
  let apercu = '';
  if (/^image\//.test(f.type)) apercu = `<img class="mm-fiche-img" src="${url(f)}" alt="${esc(f.name)}">`;
  else if (/^audio\//.test(f.type)) apercu = `<audio controls src="${url(f)}"></audio>`;
  else if (/^video\//.test(f.type)) apercu = `<video controls src="${url(f)}"></video>`;
  else if (f.type === 'application/pdf') apercu = `<iframe class="pc-pdf" title="${esc(f.name)}" src="${url(f)}"></iframe>`;
  else if (texte) apercu = `<label class="mm-fiche-texte"><span>Contenu</span><textarea rows="14" data-contenu spellcheck="false">${esc(await f.text())}</textarea></label>`;
  const vs = await pc.versions(cible);
  dlg.innerHTML = `<form method="dialog" class="mm-fiche-corps">
    ${d ? `<label><span>Nom</span><input data-nom value="${esc(f.name)}" maxlength="120" ${pc.renommerPossible(fh) ? '' : 'readonly'}></label>` : `<h2>${esc(f.name)}</h2>`}
    ${apercu}
    <p class="petit">${fichiers.poids(f.size)}${f.type ? `, ${esc(f.type)}` : ''}. Modifié le ${DATEH.format(new Date(f.lastModified))}. Sur le disque de cet appareil.</p>
    ${vs.length ? `<details><summary>${vs.length} ancienne${vs.length > 1 ? 's' : ''} version${vs.length > 1 ? 's' : ''} gardée${vs.length > 1 ? 's' : ''}</summary><ul class="mm-versions">${vs.map((v) => `<li><span>${DATEH.format(new Date(v.date))}</span><button type="button" class="btn-sobre" data-remettre="${v.id}">Remettre sur le disque</button></li>`).join('')}</ul></details>` : ''}
    <label class="pc-copier"><span>Copier dans une page</span><select data-page><option value="">Choisir une page…</option>${pages().map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('')}</select></label>
    <div class="mm-fiche-actions">
      ${texte || d ? '<button type="button" class="btn" data-enregistrer>Enregistrer</button>' : ''}
      <button type="button" class="btn-sobre" data-ouvrir>Ouvrir dans un onglet</button>
      <button type="button" class="btn-sobre" data-telecharger>Télécharger</button>
      ${d ? '<button type="button" class="btn-sobre" data-jeter-disque>Jeter</button>' : ''}
      <button type="submit" class="btn-sobre">Fermer</button>
    </div></form>`;
  dlg.showModal();
  dlg.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b || b.type === 'submit') return;
    try {
      if (b.matches('[data-enregistrer]')) {
        const zone = $('[data-contenu]', dlg), nom = $('[data-nom]', dlg)?.value.trim();
        if (zone && zone.value !== await (await fh.getFile()).text()) await pc.ecrire(fh, zone.value, cible);
        if (d && nom && nom !== fh.name && pc.renommerPossible(fh)) await pc.renommer(d, fh, nom);
        dlg.close(); toast('Enregistré sur le disque'); apres?.(); return;
      }
      if (b.matches('[data-ouvrir]')) { window.open(url(await fh.getFile()), '_blank', 'noopener'); return; }
      if (b.matches('[data-telecharger]')) { const a = document.createElement('a'); a.href = url(await fh.getFile()); a.download = fh.name; document.body.appendChild(a); a.click(); a.remove(); return; }
      if (b.matches('[data-jeter-disque]')) { deuxTemps(b, 'Sûr ? Une copie reste dans la corbeille', async () => { await pc.jeter(d, fh.name); dlg.close(); toast('Jeté (copie dans la corbeille de My memories)'); apres?.(); }); return; }
      if (b.dataset.remettre) {
        const v = (await pc.versions(cible)).find((x) => x.id === b.dataset.remettre);
        await pc.ecrire(fh, v.donnees.blob, cible); dlg.close(); toast('Ancienne version remise sur le disque'); apres?.();
      }
    } catch (err) { toast(err.message); }
  };
  dlg.onchange = async (ev) => {
    const s = ev.target.closest('[data-page]'); if (!s || !s.value) return;
    try { await pc.copierDansPage(fh, s.value); toast(`Copié dans « ${arbre.noeud(s.value).nom} »`); s.value = ''; } catch (err) { toast(err.message); }
  };
}
async function ouvrirFichierSeul(vue, e, { pied, toast }) {
  vue.innerHTML = cadre(e.nom, [['Accueil', '#/accueil'], ['Dossiers épinglés', '#/pc'], [e.nom]], '<p class="petit">Fichier épinglé.</p>') + pied;
  try { await ficheFichier(vue, { e, d: null, chemin: '', fh: e.handle, toast, apres: null }); } catch (err) { toast(`Fichier introuvable : ${err.message}`); }
  $('[data-fiche]', vue).addEventListener('close', () => { if (location.hash.startsWith('#/pc/')) location.hash = '#/pc'; }, { once: true });
}
