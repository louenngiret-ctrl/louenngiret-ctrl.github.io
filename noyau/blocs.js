// Pages en blocs : chaque page est une feuille faite de blocs (texte, titres, listes, cases à cocher, citation,
// images, séparateur, lien vers une autre page). Voir docs/ARCHITECTURE.md et docs/DECISIONS.md (D16).
//
// Un bloc = un élément du store « elements » (malle = id de la page), comme les notes d'avant :
//   { id, malle, type, bloc, texte, coche?, ordre?, fichier?, cible?, titre, cree, modifie }
//   type « note » pour les blocs écrits (les apps et Rechercher les voient), « photo » pour une image (Blob dans
//   « fichier », comme la capture rapide), « bloc » pour un séparateur ou un lien vers une page.
//   Une ancienne note (sans « bloc ») est un bloc de texte. L'ordre suit « ordre », sinon la date de création :
//   les notes d'avant et celles ajoutées par une app se rangent donc à la suite, sans aucune migration.
// Un bloc jeté qui avait du contenu est gardé dans « versions » (cible « blocs:<page> ») : « Blocs jetés », en bas.
import * as store from './store.js';
import * as arbre from './arbre.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DATEH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const GENRES = {
  texte: { nom: 'Texte', place: 'Écris ici…' },
  titre: { nom: 'Titre', place: 'Titre' },
  'sous-titre': { nom: 'Sous-titre', place: 'Sous-titre' },
  liste: { nom: 'Liste à puces', place: 'Élément' },
  numero: { nom: 'Liste numérotée', place: 'Élément' },
  case: { nom: 'Case à cocher', place: 'À faire' },
  citation: { nom: 'Citation', place: 'Une phrase à garder' },
  image: { nom: 'Image' },
  page: { nom: 'Lien vers une page' },
  separateur: { nom: 'Séparateur' },
};
const ECRITS = new Set(['texte', 'titre', 'sous-titre', 'liste', 'numero', 'case', 'citation']);
const SUITE = new Set(['liste', 'numero', 'case']); // Entrée continue la liste
const typeDe = (g) => (g === 'image' ? 'photo' : g === 'page' || g === 'separateur' ? 'bloc' : 'note');
export const genreDe = (el) => (GENRES[el.bloc] ? el.bloc : el.type === 'photo' ? 'image' : 'texte');
const cle = (el) => el.ordre ?? el.cree ?? 0;
const PAS = 1024;
const GARDER = 30; // blocs jetés gardés par page

// Raccourcis tapés en début de bloc de texte (comme dans un carnet : un dièse, un tiret, des crochets)
const RACCOURCIS = [[/^##\s/, 'sous-titre'], [/^#\s/, 'titre'], [/^[-*•]\s/, 'liste'], [/^1[.)]\s/, 'numero'],
  [/^\[[xX]\]\s/, 'case', true], [/^\[\s?\]\s/, 'case'], [/^>\s/, 'citation']];
function raccourci(v) {
  for (const [re, g, coche] of RACCOURCIS) { const m = v.match(re); if (m) return { g, reste: v.slice(m[0].length), coche: !!coche }; }
  return null;
}

/* ---------- Données ---------- */
export async function lister(page) {
  const l = await store.parIndex('elements', 'malle', page).catch(() => []);
  return l.filter((e) => e.type !== 'donnee').sort((a, b) => cle(a) - cle(b) || (a.cree || 0) - (b.cree || 0));
}
export async function jetes(page) {
  return (await store.parIndex('versions', 'cible', `blocs:${page}`).catch(() => [])).sort((a, b) => b.date - a.date);
}

// Écritures : une file, pour qu'elles arrivent dans l'ordre ; la saisie est enregistrée 600 ms après la dernière touche.
let file = Promise.resolve();
const enFile = (f) => { file = file.then(f).catch((e) => console.error('Bloc non enregistré', e)); return file; };
const enAttente = new Map(); // id → { champs, minuteur }
function sauver(el, champs, maintenant = false) {
  Object.assign(el, champs);
  const a = enAttente.get(el.id) || { champs: {} };
  clearTimeout(a.minuteur);
  Object.assign(a.champs, champs);
  enAttente.set(el.id, a);
  if (maintenant) vider(el.id); else a.minuteur = setTimeout(() => vider(el.id), 600);
}
function vider(id) {
  const a = enAttente.get(id); if (!a) return;
  clearTimeout(a.minuteur); enAttente.delete(id);
  enFile(() => store.modifier(id, a.champs));
}
const oublier = (id) => { const a = enAttente.get(id); if (a) { clearTimeout(a.minuteur); enAttente.delete(id); } };
/** Tout ce qui attend est écrit ; la promesse se résout quand c'est fait. */
export function attendre() { [...enAttente.keys()].forEach(vider); return file; }
addEventListener('pagehide', () => attendre());
document.addEventListener('visibilitychange', () => { if (document.hidden) attendre(); });

// Photo réduite à 1600 px de côté en JPEG (comme la capture rapide) ; si quelque chose échoue, on garde l'originale.
async function compresser(f) {
  try {
    const img = await createImageBitmap(f, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return b && b.size < f.size ? b : f;
  } catch (e) { return f; }
}

/* ---------- Dessin ---------- */
const POIGNEE = (nom) => `<button type="button" class="bl-poignee" data-menu aria-label="Options du bloc ${esc(nom)}" aria-haspopup="dialog"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.5" cy="3.5" r="1.5"/><circle cx="10.5" cy="3.5" r="1.5"/><circle cx="5.5" cy="8" r="1.5"/><circle cx="10.5" cy="8" r="1.5"/><circle cx="5.5" cy="12.5" r="1.5"/><circle cx="10.5" cy="12.5" r="1.5"/></svg></button>`;
function avant(g, el, num) {
  if (g === 'liste') return '<span class="bl-puce" aria-hidden="true"></span>';
  if (g === 'numero') return `<span class="bl-num" aria-hidden="true">${num}.</span>`;
  if (g === 'case') return `<label class="bl-coche"><input type="checkbox" data-coche${el.coche ? ' checked' : ''}><span class="sr">Fait</span></label>`;
  if (g === 'citation') return '<span class="bl-guillemet" aria-hidden="true">«</span>';
  return '';
}
const AUTO = !(window.CSS && CSS.supports('field-sizing', 'content'));
const ajuster = (t) => { if (!AUTO || !t) return; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };
const FANTOME = (vide) => `<li class="bl bl-fantome"><span class="bl-poignee-place" aria-hidden="true"></span><span class="bl-avant"></span>
  <textarea class="bl-zone" data-fantome rows="1" aria-label="Nouveau bloc de texte" placeholder="${vide ? 'Écris ici, ou ajoute un bloc avec +' : 'Écris ici…'}"></textarea></li>`;

export async function monter(zone, page, { toast = () => {} } = {}) {
  await attendre();
  let liste = await lister(page.id);
  let urls = [];
  let cible = null; // le bloc visé par le menu (null : la fin de la page)
  let permisLB = false; // Maj + Entrée : un vrai retour à la ligne dans le bloc
  zone.innerHTML = `<div class="bl-feuille">
      <span class="scotch" aria-hidden="true"></span>
      <ol class="bl-doc" aria-label="Contenu de « ${esc(page.nom)} »" aria-live="off"></ol>
      <button type="button" class="btn-sobre bl-ajouter" data-ajouter aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Ajouter un bloc</span></button>
    </div>
    <div data-jetes></div>
    <input type="file" accept="image/*" data-bl-image hidden>
    <dialog class="feuille bl-menu" data-bl-menu aria-labelledby="bl-menu-titre"></dialog>
    <dialog class="bl-loupe" data-loupe aria-label="Image en grand"></dialog>`;
  const loupe = zone.querySelector('[data-loupe]');
  const doc = zone.querySelector('.bl-doc'), menu = zone.querySelector('[data-bl-menu]'), choixImage = zone.querySelector('[data-bl-image]');
  const trouver = (id) => liste.find((x) => x.id === id);
  const liDe = (id) => doc.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const zoneDe = (id) => liDe(id)?.querySelector('[data-zone]');

  function htmlBloc(el, num) {
    const g = genreDe(el), G = GENRES[g];
    if (g === 'image') {
      const u = el.fichier instanceof Blob ? URL.createObjectURL(el.fichier) : ''; if (u) urls.push(u);
      return `<li class="bl bl-image" data-id="${esc(el.id)}">${POIGNEE('image')}
        <figure class="bl-photo"><span class="scotch" aria-hidden="true"></span>${u ? `<img src="${u}" alt="${esc(el.texte)}">` : '<p class="petit">Image illisible</p>'}
        <figcaption><textarea class="bl-zone bl-legende" data-zone rows="1" aria-label="Légende de l’image" placeholder="Une légende ?">${esc(el.texte)}</textarea></figcaption></figure></li>`;
    }
    if (g === 'separateur') return `<li class="bl bl-separateur" data-id="${esc(el.id)}">${POIGNEE('séparateur')}<hr class="bl-sep"></li>`;
    if (g === 'page') {
      const n = el.cible ? arbre.noeud(el.cible) : null, ok = n && !n.corbeille;
      return `<li class="bl bl-page" data-id="${esc(el.id)}">${POIGNEE(`lien vers ${ok ? n.nom : 'une page'}`)}
        ${ok ? `<a class="bl-lien" href="${esc(arbre.lienDe(n))}"><span>${esc(n.nom)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>`
    : `<span class="bl-lien bl-lien-perdu">${n ? `« ${esc(n.nom)} » est dans la corbeille` : 'Page introuvable'}</span>`}</li>`;
    }
    return `<li class="bl bl-${g}${g === 'case' && el.coche ? ' fait' : ''}" data-id="${esc(el.id)}">${POIGNEE(G.nom.toLowerCase())}
      <span class="bl-avant">${avant(g, el, num)}</span>
      <textarea class="bl-zone" data-zone rows="1" aria-label="${G.nom}" placeholder="${G.place}">${esc(el.texte)}</textarea></li>`;
  }
  const numeroDe = (i) => { let k = 0; for (let j = i; j >= 0 && genreDe(liste[j]) === 'numero'; j--) k++; return k; };
  function numeros() { doc.querySelectorAll('.bl-numero').forEach((li) => { const i = liste.indexOf(trouver(li.dataset.id)); const s = li.querySelector('.bl-num'); if (s) s.textContent = `${numeroDe(i)}.`; }); }
  function placer(id, pos = null) {
    const z = zoneDe(id); if (!z) { liDe(id)?.querySelector('.bl-poignee')?.focus(); return; }
    z.focus(); const p = pos == null ? z.value.length : pos; z.setSelectionRange(p, p);
  }
  function dessiner(focus) {
    ecrire(false);
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    doc.innerHTML = liste.map((el, i) => htmlBloc(el, numeroDe(i))).join('') + FANTOME(!liste.length);
    if (AUTO) doc.querySelectorAll('textarea').forEach(ajuster);
    if (focus?.id) placer(focus.id, focus.pos);
    else if (focus?.poignee) liDe(focus.poignee)?.querySelector('.bl-poignee')?.focus();
  }
  async function dessinerJetes() {
    const l = await jetes(page.id), boite = zone.querySelector('[data-jetes]');
    if (!boite) return;
    const nom = (el) => { const g = genreDe(el); return (el.texte || '').trim() ? el.texte.trim().slice(0, 70) : g === 'page' ? (arbre.noeud(el.cible)?.nom ? `Lien vers « ${arbre.noeud(el.cible).nom} »` : 'Lien vers une page') : GENRES[g].nom; };
    boite.innerHTML = l.length ? `<details class="bl-jetes"><summary>${l.length} bloc${l.length > 1 ? 's' : ''} jeté${l.length > 1 ? 's' : ''}</summary>
      <ul>${l.map((v) => `<li><span><b>${esc(nom(v.donnees))}</b><small>${nom(v.donnees) === GENRES[genreDe(v.donnees)].nom ? 'Jeté' : `${GENRES[genreDe(v.donnees)].nom}, jeté`} le ${DATEH.format(new Date(v.date))}</small></span><button type="button" class="btn-sobre" data-remettre="${esc(v.id)}">Remettre</button></li>`).join('')}</ul></details>` : '';
  }

  /* ----- Opérations ----- */
  function ordreEntre(a, b) {
    if (!a && !b) return PAS;
    if (!b) return cle(a) + PAS;
    if (!a) return cle(b) - PAS;
    if (a.ordre == null || b.ordre == null || cle(b) - cle(a) < 1e-6) return null;
    return (cle(a) + cle(b)) / 2;
  }
  function renumeroter() {
    const t = Date.now();
    liste.forEach((el, i) => { oublier(el.id); el.ordre = (i + 1) * PAS; el.modifie = t; });
    const copies = liste.map((el) => ({ store: 'elements', op: 'put', obj: { ...el } }));
    enFile(() => store.lot(copies));
  }
  function creer(g, champs, index) {
    let o = ordreEntre(liste[index - 1], liste[index]);
    if (o == null) { renumeroter(); o = ordreEntre(liste[index - 1], liste[index]); }
    const t = Date.now();
    const el = { id: store.nouvelId(), malle: page.id, type: typeDe(g), bloc: g, titre: '', texte: '', etiquettes: [], liens: [], cree: t, modifie: t, ordre: o, ...champs };
    liste.splice(index, 0, el);
    enFile(() => store.ecrire('elements', el));
    store.demanderPersistance();
    return el;
  }
  function changer(el, g, champs = {}) {
    sauver(el, { bloc: g, type: typeDe(g), ...champs }, true);
  }
  function jeter(el) {
    oublier(el.id);
    liste = liste.filter((x) => x !== el);
    const g = genreDe(el), garder = (el.texte || '').trim() || el.fichier || g === 'page' || g === 'separateur';
    enFile(async () => {
      if (garder) {
        await store.ecrire('versions', { id: store.nouvelId(), cible: `blocs:${page.id}`, date: Date.now(), raison: 'jeté', donnees: el });
        const l = await jetes(page.id);
        if (l.length > GARDER) await store.lot(l.slice(GARDER).map((v) => ({ store: 'versions', op: 'del', cle: v.id })));
      }
      await store.supprimer(el.id);
    });
    return garder;
  }
  // Transformer le bloc sans remplacer sa zone de texte (le clavier du téléphone reste ouvert)
  function transformerEnPlace(li, el, g, texte, pos = 0) {
    const t = li.querySelector('[data-zone]');
    changer(el, g, { texte, ...(g === 'case' ? { coche: el.coche || false } : {}) });
    li.className = `bl bl-${g}${g === 'case' && el.coche ? ' fait' : ''}`;
    li.querySelector('.bl-avant').innerHTML = avant(g, el, numeroDe(liste.indexOf(el)));
    li.querySelector('.bl-poignee').setAttribute('aria-label', `Options du bloc ${GENRES[g].nom.toLowerCase()}`);
    t.setAttribute('aria-label', GENRES[g].nom); t.placeholder = GENRES[g].place;
    if (t.value !== texte) t.value = texte;
    t.setSelectionRange(pos, pos); ajuster(t); numeros();
  }
  // Le fantôme (la ligne vide du bas) devient un vrai bloc sans être remplacé : la saisie en cours continue
  function fantomeEnBloc(t) {
    const el = creer('texte', { texte: t.value }, liste.length), li = t.closest('li');
    li.className = 'bl bl-texte'; li.dataset.id = el.id;
    li.querySelector('.bl-poignee-place').outerHTML = POIGNEE('texte');
    t.removeAttribute('data-fantome'); t.setAttribute('data-zone', ''); t.setAttribute('aria-label', 'Texte'); t.placeholder = GENRES.texte.place;
    doc.insertAdjacentHTML('beforeend', FANTOME(false));
    return el;
  }
  // Monter ou descendre sans redessiner : c'est le voisin qui bouge, la zone où l'on écrit garde le clavier
  function deplacerSurPlace(el, sens) {
    const li = liDe(el.id); if (!li) return false;
    const voisin = sens < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!voisin || voisin.matches('.bl-fantome') || !deplacer(el, sens)) return false;
    if (sens < 0) li.after(voisin); else li.before(voisin);
    numeros(); garderVisible(li);
    return true;
  }
  function basculerCoche(el) {
    const li = liDe(el.id), c = li?.querySelector('[data-coche]'); if (!c) return;
    c.checked = !c.checked; sauver(el, { coche: c.checked }, true); li.classList.toggle('fait', c.checked);
  }
  // Entrée : couper le bloc au curseur, la suite part dans un nouveau bloc dessous
  function couper(t) {
    const li = t.closest('[data-id]'), el = trouver(li.dataset.id), g = genreDe(el), i = liste.indexOf(el);
    if (g === 'image') { const nv = creer('texte', {}, i + 1); li.insertAdjacentHTML('afterend', htmlBloc(nv, 0)); placer(nv.id, 0); return; }
    if (!t.value.trim() && (SUITE.has(g) || g === 'citation')) { transformerEnPlace(li, el, 'texte', ''); return; }
    const p = t.selectionStart, q = t.selectionEnd;
    const ng = SUITE.has(g) ? g : 'texte';
    if (p === 0 && t.value) { // au tout début : un bloc vide au-dessus, comme un saut de ligne
      const nv = creer(SUITE.has(g) ? g : 'texte', {}, i);
      li.insertAdjacentHTML('beforebegin', htmlBloc(nv, 0)); numeros(); ajuster(zoneDe(nv.id)); t.setSelectionRange(0, 0);
      return;
    }
    const debut = t.value.slice(0, p), fin = t.value.slice(q);
    t.value = debut; ajuster(t); sauver(el, { texte: debut }, true);
    const nv = creer(ng, { texte: fin, ...(ng === 'case' ? { coche: false } : {}) }, i + 1);
    li.insertAdjacentHTML('afterend', htmlBloc(nv, 0)); numeros(); ajuster(zoneDe(nv.id)); placer(nv.id, 0);
  }
  // Effacer au tout début du bloc : une liste redevient du texte, un texte se recolle au bloc d'avant
  function reculer(t) {
    const li = t.closest('[data-id]'), el = trouver(li.dataset.id), g = genreDe(el);
    if (g === 'image') return false;
    if (g !== 'texte') { transformerEnPlace(li, el, 'texte', t.value); return true; }
    const i = liste.indexOf(el), prec = liste[i - 1];
    if (!prec) { if (!t.value && liste.length > 1) { jeter(el); li.remove(); placer(liste[0].id, 0); return true; } return false; }
    const pg = genreDe(prec);
    if (ECRITS.has(pg)) {
      const zp = zoneDe(prec.id), pos = zp.value.length;
      zp.value += t.value; ajuster(zp); sauver(prec, { texte: zp.value }, true);
      oublier(el.id); liste = liste.filter((x) => x !== el); enFile(() => store.supprimer(el.id));
      li.remove(); numeros(); zp.focus(); zp.setSelectionRange(pos, pos);
      return true;
    }
    if (pg === 'separateur') { jeter(prec); liDe(prec.id)?.remove(); return true; }
    if (!t.value) { jeter(el); li.remove(); placer(prec.id); return true; }
    return false;
  }
  function deplacer(el, sens) {
    const i = liste.indexOf(el), j = i + sens;
    if (j < 0 || j >= liste.length) return false;
    liste.splice(i, 1); liste.splice(j, 0, el);
    const o = ordreEntre(liste[j - 1], liste[j + 1]);
    if (o == null) renumeroter(); else sauver(el, { ordre: o }, true);
    return true;
  }
  const zones = () => [...doc.querySelectorAll('textarea')];
  function voisine(t, sens) { const l = zones(), k = l.indexOf(t) + sens; return l[k] || null; }

  /* ----- Le menu d'un bloc, ou « Ajouter un bloc » ----- */
  const APERCU = {
    texte: '<span class="bl-ap bl-ap-texte">Texte</span>',
    titre: '<span class="bl-ap bl-ap-titre">Titre</span>',
    'sous-titre': '<span class="bl-ap bl-ap-sous">Sous-titre</span>',
    liste: '<span class="bl-ap"><i class="bl-puce"></i>Liste à puces</span>',
    numero: '<span class="bl-ap"><i class="bl-num">1.</i>Liste numérotée</span>',
    case: '<span class="bl-ap"><i class="bl-ap-case"></i>Case à cocher</span>',
    citation: '<span class="bl-ap bl-ap-cit"><i>«</i>Citation</span>',
    image: '<span class="bl-ap"><i class="bl-ap-photo"></i>Image</span>',
    page: '<span class="bl-ap"><i class="bl-ap-tag"></i>Lien vers une page</span>',
    separateur: '<span class="bl-ap"><i class="bl-ap-sep"></i>Séparateur</span>',
  };
  const fermer = '<div class="feuille-actions"><button type="submit" class="btn-sobre">Fermer</button></div>';
  function menuAjouter(el) {
    cible = el;
    menu.innerHTML = `<form method="dialog"><h2 class="feuille-titre" id="bl-menu-titre">${el ? 'Ajouter un bloc dessous' : 'Ajouter un bloc'}</h2>
      <div class="bl-choix">${Object.keys(GENRES).map((g) => `<button type="button" data-choisir="${g}">${APERCU[g]}</button>`).join('')}</div>
      <p class="petit bl-astuce">En écrivant : Entrée ouvre un nouveau bloc. En début de ligne, <b>#</b> fait un titre, <b>##</b> un sous-titre, <b>-</b> une liste, <b>1.</b> une liste numérotée, <b>[]</b> une case, <b>&gt;</b> une citation, <b>---</b> un séparateur. Sur ordinateur, <b>Alt + flèches</b> déplace le bloc et <b>Ctrl + Entrée</b> coche la case.</p>
      ${fermer}</form>`;
  }
  function menuBloc(el) {
    cible = el;
    const g = genreDe(el), i = liste.indexOf(el);
    menu.innerHTML = `<form method="dialog"><h2 class="feuille-titre" id="bl-menu-titre">${GENRES[g].nom}</h2>
      ${ECRITS.has(g) ? `<p class="bl-menu-sous">Transformer en</p><div class="bl-choix">${[...ECRITS].filter((x) => x !== g).map((x) => `<button type="button" data-transformer="${x}">${APERCU[x]}</button>`).join('')}</div>` : ''}
      <div class="bl-actions">
        <button type="button" class="btn-sobre" data-dessous><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Ajouter dessous</button>
        ${g === 'page' ? '<button type="button" class="btn-sobre" data-changer-page>Changer de page</button>' : ''}
        <button type="button" class="btn-sobre" data-deplacer="-1"${i === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>Monter</button>
        <button type="button" class="btn-sobre" data-deplacer="1"${i === liste.length - 1 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>Descendre</button>
        <button type="button" class="btn-sobre bl-jeter" data-jeter-bloc><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>Jeter</button>
      </div>${fermer}</form>`;
  }
  function menuPage(el, remplacer) {
    const nom = (n) => arbre.chemin(n.id).map((x) => x.nom).join(' › ');
    const pages = arbre.tous().filter((n) => n.id !== arbre.RACINE && !n.corbeille && n.id !== page.id).sort((a, b) => nom(a).localeCompare(nom(b), 'fr'));
    menu.innerHTML = `<form method="dialog"><h2 class="feuille-titre" id="bl-menu-titre">Lien vers une page</h2>
      <label class="bl-choisir-page"><span>Quelle page ?</span><select data-page-cible>${pages.map((n) => `<option value="${esc(n.id)}"${remplacer && el?.cible === n.id ? ' selected' : ''}>${esc(nom(n))}</option>`).join('')}</select></label>
      <div class="feuille-actions"><button type="submit" class="btn-sobre">Annuler</button><button type="button" class="btn" data-lier="${remplacer ? 'remplacer' : 'ajouter'}">${remplacer ? 'Changer' : 'Ajouter le lien'}</button></div></form>`;
    cible = el;
  }
  const apresCible = () => (cible ? liste.indexOf(cible) + 1 : liste.length);

  /* ----- Écoute ----- */
  zone.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLTextAreaElement) || e.isComposing || e.keyCode === 229) return;
    if (t.matches('[data-fantome]')) {
      if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
      else if ((e.key === 'Backspace' || e.key === 'ArrowUp') && !t.value) { const v = voisine(t, -1); if (v) { e.preventDefault(); v.focus(); v.setSelectionRange(v.value.length, v.value.length); } }
      return;
    }
    if (!t.matches('[data-zone]')) return;
    const el = trouver(t.closest('[data-id]')?.dataset.id);
    if (el && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); deplacerSurPlace(el, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (el && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (genreDe(el) === 'case') basculerCoche(el); else if (ECRITS.has(genreDe(el))) transformerEnPlace(t.closest('[data-id]'), el, 'case', t.value, t.selectionStart); return; }
    if (e.key === 'Enter') { if (e.shiftKey) permisLB = true; else { e.preventDefault(); couper(t); } return; }
    if (e.key === 'Backspace' && t.selectionStart === 0 && t.selectionEnd === 0) { if (reculer(t)) e.preventDefault(); return; }
    if (e.key === 'ArrowUp' && t.selectionStart === 0 && t.selectionEnd === 0) { const v = voisine(t, -1); if (v) { e.preventDefault(); v.focus(); v.setSelectionRange(v.value.length, v.value.length); } }
    if (e.key === 'ArrowDown' && t.selectionStart === t.value.length) { const v = voisine(t, 1); if (v) { e.preventDefault(); v.focus(); v.setSelectionRange(0, 0); } }
  });
  // Au téléphone, Entrée et Effacer arrivent surtout par « beforeinput » (le clavier ne donne pas toujours la touche)
  zone.addEventListener('beforeinput', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLTextAreaElement)) return;
    if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      if (permisLB) return;
      e.preventDefault();
      if (t.matches('[data-zone]')) couper(t);
    } else if (e.inputType === 'deleteContentBackward' && t.matches('[data-zone]') && t.selectionStart === 0 && t.selectionEnd === 0) {
      if (reculer(t)) e.preventDefault();
    }
  });
  zone.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLTextAreaElement)) return;
    if (e.inputType === 'insertLineBreak') {
      if (permisLB) permisLB = false;
      else if (t.matches('[data-zone]')) { // le retour à la ligne n'a pas pu être retenu : on coupe quand même
        const p = t.selectionStart;
        if (t.value[p - 1] === '\n') { t.value = t.value.slice(0, p - 1) + t.value.slice(p); t.setSelectionRange(p - 1, p - 1); couper(t); return; }
      }
    }
    ajuster(t);
    if (t.matches('[data-fantome]')) {
      if (!t.value) return;
      fantomeEnBloc(t);
      return;
    }
    if (!t.matches('[data-zone]')) return;
    const li = t.closest('[data-id]'), el = trouver(li.dataset.id); if (!el) return;
    const g = genreDe(el);
    if (g === 'image') { sauver(el, { texte: t.value, titre: t.value.trim().slice(0, 80) || 'Image' }); li.querySelector('img')?.setAttribute('alt', t.value); return; }
    if (!e.isComposing) {
      if (t.value === '---') {
        changer(el, 'separateur', { texte: '' });
        const i = liste.indexOf(el), suite = liste[i + 1];
        dessiner(); if (suite && zoneDe(suite.id)) placer(suite.id, 0); else doc.querySelector('[data-fantome]')?.focus();
        return;
      }
      const r = raccourci(t.value);
      if (r && r.g !== g) { transformerEnPlace(li, el, r.g, r.reste); if (r.g === 'case' && r.coche) { sauver(el, { coche: true }, true); li.classList.add('fait'); li.querySelector('[data-coche]').checked = true; } return; }
    }
    sauver(el, { texte: t.value });
  });
  zone.addEventListener('focusout', (e) => {
    const li = e.target.closest?.('[data-id]'); if (li && e.target.matches('[data-zone]')) vider(li.dataset.id);
    setTimeout(() => { const a = document.activeElement; if (!(a && (zone.contains(a) && a.matches('textarea')) || barre.contains(a))) ecrire(false); }, 0);
  });
  zone.addEventListener('focusin', (e) => {
    const t = e.target; if (!(t instanceof HTMLTextAreaElement)) return;
    actuel = t.closest('[data-id]')?.dataset.id || null; ecrire(true); garderVisible(t);
  });
  // Coller plusieurs lignes : une ligne = un bloc, avec les mêmes raccourcis qu'au clavier
  zone.addEventListener('paste', (e) => {
    const t = e.target; if (!(t instanceof HTMLTextAreaElement) || t.matches('.bl-legende')) return;
    const texte = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
    if (!texte.includes('\n')) return;
    e.preventDefault();
    const lignes = texte.split('\n');
    const el = t.matches('[data-fantome]') ? fantomeEnBloc(t) : trouver(t.closest('[data-id]').dataset.id);
    const fin = t.value.slice(t.selectionEnd);
    t.value = t.value.slice(0, t.selectionStart) + lignes.shift();
    sauver(el, { texte: t.value }, true);
    let index = liste.indexOf(el) + 1, der = el, n = 1;
    lignes.forEach((l, k) => {
      if (k === lignes.length - 1) l += fin;
      if (!l.trim()) return;
      n++;
      if (l.trim() === '---') { der = creer('separateur', {}, index++); return; }
      const r = raccourci(l);
      der = creer(r ? r.g : 'texte', r ? { texte: r.reste, ...(r.g === 'case' ? { coche: r.coche } : {}) } : { texte: l }, index++);
    });
    dessiner(ECRITS.has(genreDe(der)) ? { id: der.id } : { poignee: der.id });
    toast(`${n} lignes collées, une par bloc`);
  });
  zone.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-coche]');
    if (c) { const li = c.closest('[data-id]'), el = trouver(li.dataset.id); sauver(el, { coche: c.checked }, true); li.classList.toggle('fait', c.checked); navigator.vibrate?.(8); return; }
    if (e.target === choixImage && choixImage.files.length) {
      const fs = [...choixImage.files]; choixImage.value = '';
      let index = apresCible(), der = null;
      for (const f of fs) { const fichier = await compresser(f); der = creer('image', { fichier, titre: 'Image' }, index++); }
      dessiner({ poignee: der.id }); liDe(der.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      toast(fs.length > 1 ? `${fs.length} images collées` : 'Image collée');
    }
  });
  zone.addEventListener('click', async (e) => {
    const t = e.target;
    const img = t.closest('.bl-photo img');
    if (img) { loupe.innerHTML = `<form method="dialog"><img src="${img.src}" alt="${esc(img.alt)}"><button type="submit" class="btn-sobre">Fermer</button></form>`; loupe.showModal(); return; }
    if (t === doc || t.matches('.bl-feuille')) { doc.querySelector('[data-fantome]')?.focus(); return; }
    const m = t.closest('[data-menu]');
    if (m) { menuBloc(trouver(m.closest('[data-id]').dataset.id)); menu.showModal(); return; }
    if (t.closest('[data-ajouter]')) { await attendre(); menuAjouter(null); menu.showModal(); return; }
    const r = t.closest('[data-remettre]');
    if (r) {
      const v = await store.lire('versions', r.dataset.remettre); if (!v) return;
      const el = { ...v.donnees, malle: page.id, modifie: Date.now() };
      await enFile(async () => { await store.ecrire('elements', el); await store.effacer('versions', v.id); });
      liste.push(el); liste.sort((a, b) => cle(a) - cle(b));
      dessiner({ poignee: el.id }); dessinerJetes(); toast('Bloc remis à sa place'); return;
    }
    if (!menu.contains(t)) return;
    const ch = t.closest('[data-choisir]');
    if (ch) {
      const g = ch.dataset.choisir;
      if (g === 'image') { menu.close(); choixImage.click(); return; }
      if (g === 'page') { menuPage(cible, false); return; }
      const el = creer(g, g === 'case' ? { coche: false } : {}, apresCible());
      menu.close(); dessiner(g === 'separateur' ? { poignee: el.id } : { id: el.id }); return;
    }
    const tr = t.closest('[data-transformer]');
    if (tr) { const el = cible; changer(el, tr.dataset.transformer, tr.dataset.transformer === 'case' ? { coche: el.coche || false } : {}); menu.close(); dessiner({ id: el.id }); return; }
    if (t.closest('[data-dessous]')) { menuAjouter(cible); return; }
    if (t.closest('[data-changer-page]')) { menuPage(cible, true); return; }
    const dp = t.closest('[data-deplacer]');
    if (dp) { const el = cible; if (deplacer(el, Number(dp.dataset.deplacer))) { menu.close(); dessiner({ poignee: el.id }); liDe(el.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
    if (t.closest('[data-jeter-bloc]')) {
      const el = cible, i = liste.indexOf(el), garde = jeter(el);
      menu.close(); const v = liste[Math.min(i, liste.length - 1)];
      dessiner(v ? { poignee: v.id } : null); if (!v) doc.querySelector('[data-fantome]')?.focus();
      if (garde) { await file; dessinerJetes(); toast('Bloc jeté. Il attend en bas, dans « Blocs jetés ».'); }
      return;
    }
    const li = t.closest('[data-lier]');
    if (li) {
      const id = menu.querySelector('[data-page-cible]')?.value; if (!id) return;
      const n = arbre.noeud(id);
      let el;
      if (li.dataset.lier === 'remplacer') { el = cible; sauver(el, { cible: id, titre: n.nom }, true); }
      else el = creer('page', { cible: id, titre: n.nom }, apresCible());
      menu.close(); dessiner({ poignee: el.id });
    }
  });

  // La barre d'outils du téléphone agit sur le bloc où l'on écrit
  let actuel = null;
  const barre = barreOutils();
  function ecrire(oui) {
    barre.hidden = !oui; document.documentElement.classList.toggle('bl-ecrit', oui);
    if (oui) { const z = document.activeElement, el = trouver(z?.closest?.('[data-id]')?.dataset.id) || (actuel && trouver(actuel)), g = el ? genreDe(el) : 'texte'; barre.querySelectorAll('[data-outil]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.outil === g))); }
  }
  barre.api = (outil) => {
    const a = document.activeElement, t = a instanceof HTMLTextAreaElement && zone.contains(a) ? a : (actuel ? zoneDe(actuel) : null);
    if (outil === 'fini') { t?.blur(); ecrire(false); return; }
    let el = trouver(t?.closest('[data-id]')?.dataset.id) || (actuel && trouver(actuel));
    if (!el && t?.matches('[data-fantome]') && outil !== 'image' && outil !== 'plus') { el = fantomeEnBloc(t); actuel = el.id; }
    if (outil === 'image') { cible = el || null; choixImage.click(); return; }
    if (outil === 'plus') { if (el) menuBloc(el); else menuAjouter(null); menu.showModal(); return; }
    if (!el) return;
    if (outil === 'monter' || outil === 'descendre') { deplacerSurPlace(el, outil === 'monter' ? -1 : 1); return; }
    const g = genreDe(el); if (!ECRITS.has(g) || !t) return;
    transformerEnPlace(liDe(el.id), el, g === outil ? 'texte' : outil, t.value, t.selectionStart);
    if (outil === 'case' && g !== 'case') sauver(el, { coche: false }, true);
    ecrire(true);
  };

  dessiner();
  dessinerJetes();
}

/* ---------- La barre d'outils au-dessus du clavier (téléphone) ---------- */
let barreEl = null;
const OUTILS = [
  ['titre', 'Titre', '<b class="bl-o-titre">T</b>'],
  ['liste', 'Liste à puces', '<svg viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.8"/><circle cx="5" cy="17" r="1.8"/><path d="M10 7h10M10 17h10"/></svg>'],
  ['case', 'Case à cocher', '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" transform="rotate(-3 12 12)"/><path d="M8 12l3 3 6-8"/></svg>'],
  ['image', 'Ajouter une image', '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 15l3-4 3 3 2-2 2 3"/></svg>'],
  ['monter', 'Monter le bloc', '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'],
  ['descendre', 'Descendre le bloc', '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>'],
  ['plus', 'Plus d’options', '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>'],
  ['fini', 'Fini, ranger le clavier', '<b class="bl-o-fini">OK</b>'],
];
function barreOutils() {
  if (barreEl?.isConnected) return barreEl;
  barreEl = document.createElement('div');
  barreEl.className = 'bl-barre'; barreEl.hidden = true;
  barreEl.setAttribute('role', 'toolbar'); barreEl.setAttribute('aria-label', 'Outils du bloc');
  barreEl.innerHTML = OUTILS.map(([id, nom, ic]) => `<button type="button" data-outil="${id}" aria-label="${nom}" title="${nom}"${['titre', 'liste', 'case'].includes(id) ? ' aria-pressed="false"' : ''}>${ic}</button>`).join('');
  // appuyer sur un outil ne doit pas retirer le focus de la zone (le clavier resterait fermé)
  const garder = (e) => { if (e.target.closest('button')) e.preventDefault(); };
  barreEl.addEventListener('pointerdown', garder); barreEl.addEventListener('mousedown', garder);
  barreEl.addEventListener('click', (e) => { const b = e.target.closest('[data-outil]'); if (b) barreEl.api?.(b.dataset.outil); });
  document.body.append(barreEl);
  addEventListener('hashchange', () => { barreEl.hidden = true; document.documentElement.classList.remove('bl-ecrit'); });
  // la barre se pose juste au-dessus du clavier, qui réduit la partie visible de la page
  const vv = window.visualViewport;
  if (vv) {
    const poser = () => { const bas = Math.max(0, innerHeight - vv.height - vv.offsetTop); document.documentElement.style.setProperty('--bl-clavier', `${bas}px`); };
    vv.addEventListener('resize', () => { poser(); const a = document.activeElement; if (a?.matches?.('.bl-zone')) garderVisible(a); });
    vv.addEventListener('scroll', poser); poser();
  }
  return barreEl;
}
// Le bloc où l'on écrit reste visible au-dessus de la barre et du clavier
function garderVisible(el) {
  if (!barreEl || barreEl.hidden || getComputedStyle(barreEl).display === 'none') return;
  requestAnimationFrame(() => {
    const vv = window.visualViewport, haut = vv ? vv.height + vv.offsetTop : innerHeight;
    const r = el.getBoundingClientRect(), limite = haut - barreEl.offsetHeight - 12;
    if (r.bottom > limite) window.scrollBy({ top: Math.min(r.bottom - limite, r.top - 80), behavior: 'smooth' });
  });
}
