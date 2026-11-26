// L'hôte des applications ajoutées (#/app/<id>).
// L'app tourne dans un cadre « sandbox » sans « allow-same-origin » : son origine est opaque, elle ne peut lire ni
// IndexedDB, ni le localStorage, ni les cookies de My memories. Ses fichiers lui sont envoyés par message et
// transformés en adresses blob: à l'intérieur du cadre ; ses imports, styles et images sont réécrits ici pour
// pointer vers ces adresses. Tout ce qu'elle demande passe par le SDK (window.mm) et est vérifié ici, selon les
// permissions acceptées à l'installation. Voir docs/APPS.md et docs/DECISIONS.md (D6).
import * as store from './store.js';
import * as apps from './apps.js';
import * as arbre from './arbre.js';
import { lireDecor } from './decor.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 1. Préparer les fichiers : réécrire les références internes en marques __MM(chemin)__ ---------- */
const MARQUE = (c) => `__MM(${c})__`;
function resoudre(depuis, ref) {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null; // adresse absolue, data:, blob:, ancre
  const [chemin] = ref.split(/[?#]/);
  const base = depuis.includes('/') ? depuis.slice(0, depuis.lastIndexOf('/') + 1) : '';
  const morceaux = [];
  for (const m of (chemin.startsWith('/') ? chemin.slice(1) : base + chemin).split('/')) {
    if (m === '..') morceaux.pop(); else if (m && m !== '.') morceaux.push(m);
  }
  return morceaux.join('/');
}
function reecrireCss(texte, depuis, existe, deps) {
  const rempl = (ref) => { const c = resoudre(depuis, ref); if (c && existe(c)) { deps.add(c); return MARQUE(c); } return ref; };
  return texte
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => `url(${q}${rempl(ref.trim())}${q})`)
    .replace(/@import\s+(['"])([^'"]+)\1/g, (m, q, ref) => `@import ${q}${rempl(ref)}${q}`);
}
async function reecrireJs(texte, depuis, existe, deps) {
  const lexer = await import('../vendor/es-module-lexer/lexer.js');
  await lexer.init;
  let imports;
  try { [imports] = lexer.parse(texte); } catch (e) { return texte; } // script classique non analysable : laissé tel quel
  let sortie = '', curseur = 0;
  for (const im of imports) {
    // es-module-lexer 3 : specifier, start, end (pour un import dynamique, start et end englobent les guillemets)
    const spec = im.specifier ?? im.n, debut = im.start ?? im.s, fin = im.end ?? im.e;
    if (spec == null || debut < 0) continue; // import dynamique calculé : non réécrit (documenté)
    const c = resoudre(depuis, spec);
    if (!c || !existe(c)) continue;
    deps.add(c);
    const dyn = im.type === 'dynamic' || /^['"`]/.test(texte.slice(debut, debut + 1));
    sortie += texte.slice(curseur, debut) + (dyn ? JSON.stringify(MARQUE(c)) : MARQUE(c));
    curseur = fin;
  }
  return sortie + texte.slice(curseur);
}
const ATTRS = [['script', 'src'], ['link', 'href'], ['img', 'src'], ['source', 'src'], ['video', 'src'], ['video', 'poster'], ['audio', 'src'], ['track', 'src'], ['input', 'src'], ['embed', 'src'], ['object', 'data']];
async function reecrireHtml(texte, depuis, existe, deps) {
  const doc = new DOMParser().parseFromString(texte, 'text/html');
  for (const [tag, at] of ATTRS) {
    doc.querySelectorAll(`${tag}[${at}]`).forEach((el) => { const c = resoudre(depuis, el.getAttribute(at)); if (c && existe(c)) { deps.add(c); el.setAttribute(at, MARQUE(c)); } });
  }
  doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    el.setAttribute('srcset', el.getAttribute('srcset').split(',').map((p) => { const [u, ...d] = p.trim().split(/\s+/); const c = resoudre(depuis, u); if (c && existe(c)) { deps.add(c); return [MARQUE(c), ...d].join(' '); } return p.trim(); }).join(', '));
  });
  // liens vers d'autres pages de l'app : ouverts par l'hôte
  doc.querySelectorAll('a[href]').forEach((a) => { const c = resoudre(depuis, a.getAttribute('href')); if (c && existe(c) && /\.html?$/i.test(c)) { a.setAttribute('data-mm-page', c); a.setAttribute('href', '#'); } });
  doc.querySelectorAll('style').forEach((s) => { s.textContent = reecrireCss(s.textContent, depuis, existe, deps); });
  doc.querySelectorAll('[style]').forEach((el) => el.setAttribute('style', reecrireCss(el.getAttribute('style'), depuis, existe, deps)));
  for (const s of doc.querySelectorAll('script:not([src])')) if (s.type === 'module') s.textContent = await reecrireJs(s.textContent, depuis, existe, deps);
  return doc;
}
/** Construit ce que le cadre doit recevoir : les fichiers dans l'ordre des dépendances, puis la page. */
export async function preparer(app, page) {
  const parChemin = new Map(app.fichiers.map((f) => [f.chemin, f]));
  const existe = (c) => parChemin.has(c) && c !== page;
  const prets = new Map(), deps = new Map();
  for (const f of app.fichiers) {
    if (f.chemin === page) continue;
    const d = new Set();
    if (/\.css$/i.test(f.chemin)) prets.set(f.chemin, { chemin: f.chemin, mime: 'text/css', texte: reecrireCss(await f.blob.text(), f.chemin, existe, d) });
    else if (/\.m?js$/i.test(f.chemin)) prets.set(f.chemin, { chemin: f.chemin, mime: 'text/javascript', texte: await reecrireJs(await f.blob.text(), f.chemin, existe, d) });
    else prets.set(f.chemin, { chemin: f.chemin, mime: f.mime || apps.mimeDe(f.chemin), octets: await f.blob.arrayBuffer() });
    d.delete(f.chemin);
    deps.set(f.chemin, d);
  }
  // ordre topologique : un fichier passe après ceux qu'il cite
  const ordre = [], etat = new Map();
  const visiter = (c, pile) => {
    if (etat.get(c) === 2) return;
    if (etat.get(c) === 1) throw new Error(`Dépendance circulaire : ${[...pile, c].join(' → ')}. My memories ne sait pas charger deux modules qui s’importent l’un l’autre.`);
    etat.set(c, 1);
    for (const d of deps.get(c) || []) visiter(d, [...pile, c]);
    etat.set(c, 2); ordre.push(prets.get(c));
  };
  [...prets.keys()].forEach((c) => visiter(c, []));
  const pageDeps = new Set();
  const doc = await reecrireHtml(await parChemin.get(page).blob.text(), page, existe, pageDeps);
  if (!app.permissions.includes('reseau')) {
    // sans la permission « reseau », l'app ne peut rien charger ni envoyer hors de son paquet
    const csp = doc.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = "default-src blob: data: 'unsafe-inline' 'unsafe-eval'; connect-src blob: data:; form-action 'none'";
    doc.head.prepend(csp);
  }
  if (!doc.querySelector('meta[name="viewport"]')) { const v = doc.createElement('meta'); v.name = 'viewport'; v.content = 'width=device-width, initial-scale=1'; doc.head.prepend(v); }
  return { ordre, html: `<!doctype html>\n${doc.documentElement.outerHTML}` };
}

/* ---------- 2. Le cadre : un amorçage minuscule, puis la page de l'app ---------- */
// Ce code tourne DANS le cadre isolé. Il crée les adresses blob:, définit window.mm, puis écrit la page de l'app.
function amorce() {
  /* eslint-disable no-restricted-globals */
  let n = 0; const attente = new Map(), ecoutes = new Map(), urls = {};
  const poster = (m) => parent.postMessage({ mm: 1, ...m }, '*');
  const appeler = (service, ...args) => new Promise((ok, ko) => { const id = ++n; attente.set(id, { ok, ko }); poster({ t: 'appel', id, service, args }); });
  const recevoir = (e) => {
    if (e.source !== parent || !e.data || e.data.mm !== 1) return;
    const d = e.data;
    if (d.t === 'reponse') { const a = attente.get(d.id); if (!a) return; attente.delete(d.id); if (d.erreur) a.ko(new Error(d.erreur)); else a.ok(d.valeur); }
    else if (d.t === 'evenement') (ecoutes.get(d.nom) || []).forEach((f) => { try { f(d.detail); } catch (err) { console.error(err); } });
    else if (d.t === 'charge') charger(d);
  };
  const remplacer = (s) => s.replace(/__MM\(([^)]+)\)__/g, (m, c) => urls[c] || m);
  const ext = (c) => (c.split('.').pop() || '').toLowerCase();
  function charger(d) {
    for (const f of d.ordre) urls[f.chemin] = URL.createObjectURL(new Blob([f.texte != null ? remplacer(f.texte) : f.octets], { type: f.mime }));
    const info = d.info;
    const fetchOrig = window.fetch.bind(window);
    window.fetch = (entree, opts) => {
      const u = typeof entree === 'string' ? entree : entree?.url;
      if (typeof u === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(u)) { const c = u.replace(/^\.?\//, '').split(/[?#]/)[0]; if (urls[c]) return fetchOrig(urls[c], opts); }
      return fetchOrig(entree, opts);
    };
    window.mm = Object.freeze({
      app: info,
      fichier: (c) => urls[String(c).replace(/^\.?\//, '')] || null,
      stockage: { lire: (cle) => appeler('stockage.lire', cle), ecrire: (cle, valeur) => appeler('stockage.ecrire', cle, valeur), effacer: (cle) => appeler('stockage.effacer', cle), cles: () => appeler('stockage.cles') },
      notes: { lister: (page) => appeler('notes.lister', page), ajouter: (page, texte) => appeler('notes.ajouter', page, texte), modifier: (id, texte) => appeler('notes.modifier', id, texte), jeter: (id) => appeler('notes.jeter', id) },
      arbre: { lister: () => appeler('arbre.lister') },
      fichiers: { lister: (page) => appeler('fichiers.lister', page), lire: (id) => appeler('fichiers.lire', id), ajouter: (page, nom, blob) => appeler('fichiers.ajouter', page, nom, blob) },
      ui: { toast: (texte) => appeler('ui.toast', texte), ouvrir: (lien) => appeler('ui.ouvrir', lien), titre: (texte) => appeler('ui.titre', texte) },
      theme: () => appeler('theme.lire'),
      permissions: () => appeler('app.permissions'),
      ecouter: (nom, f) => { if (!ecoutes.has(nom)) ecoutes.set(nom, []); ecoutes.get(nom).push(f); return () => ecoutes.set(nom, ecoutes.get(nom).filter((x) => x !== f)); },
    });
    document.open(); document.write(remplacer(d.html)); document.close();
    // document.open() efface les écouteurs de la fenêtre : on rebranche
    addEventListener('message', recevoir);
    document.addEventListener('click', (e) => { const a = e.target.closest?.('a[data-mm-page]'); if (a) { e.preventDefault(); poster({ t: 'page', page: a.dataset.mmPage }); } });
    addEventListener('error', (e) => poster({ t: 'erreur', texte: `${e.message || 'Erreur'}${e.filename ? ` (${e.filename.startsWith('blob:') ? 'fichier de l’app' : e.filename}:${e.lineno})` : ''}` }));
    addEventListener('unhandledrejection', (e) => poster({ t: 'erreur', texte: String(e.reason?.message || e.reason || 'Promesse rejetée') }));
    void ext;
  }
  addEventListener('message', recevoir);
  poster({ t: 'pret' });
}
const SRCDOC = `<!doctype html><meta charset="utf-8"><script>(${amorce.toString()})();<\/script>`;

/* ---------- 3. Les services : ce que l'app peut demander ---------- */
const exiger = (app, p) => { if (!app.permissions.includes(p)) throw new Error(`Permission « ${p} » non accordée à cette app.`); };
const pageNotes = (id) => { const n = arbre.noeud(id); if (!n || n.type !== 'page' || n.corbeille) throw new Error(`« ${id} » n’est pas une page.`); return n; };
const versNote = (e) => ({ id: e.id, page: e.malle, texte: e.texte, titre: e.titre, cree: e.cree, modifie: e.modifie });
function services(app, ctx) {
  const ns = `app:${app.id}`;
  const cleDe = (cle) => { const c = String(cle); if (!c || c.length > 200) throw new Error('Clé invalide (1 à 200 caractères).'); return `${ns}:${c}`; };
  return {
    'app.permissions': () => [...app.permissions],
    'stockage.lire': async (cle) => (await store.lire('elements', cleDe(cle)))?.valeur,
    'stockage.ecrire': async (cle, valeur) => {
      const id = cleDe(cle), t = Date.now(), avant = await store.lire('elements', id);
      await store.ecrire('elements', { id, malle: ns, type: 'donnee', cle: String(cle), valeur, titre: '', texte: '', etiquettes: [], liens: [], cree: avant?.cree || t, modifie: t });
      return true;
    },
    'stockage.effacer': async (cle) => { await store.effacer('elements', cleDe(cle)); return true; },
    'stockage.cles': async () => (await store.parMalle(ns)).map((e) => e.cle),
    'notes.lister': async (page) => { exiger(app, 'notes:lire'); pageNotes(page); return (await store.parMalle(page)).filter((e) => e.type === 'note').map(versNote); },
    'notes.ajouter': async (page, texte) => { exiger(app, 'notes:ecrire'); pageNotes(page); return versNote(await store.ajouter({ malle: page, type: 'note', texte: String(texte).slice(0, 20000), source: ns })); },
    'notes.modifier': async (id, texte) => {
      exiger(app, 'notes:ecrire');
      const e = await store.lire('elements', id); if (!e || e.type !== 'note') throw new Error('Note introuvable.'); pageNotes(e.malle);
      return versNote(await store.modifier(id, { texte: String(texte).slice(0, 20000) }));
    },
    'notes.jeter': async (id) => {
      exiger(app, 'notes:ecrire');
      const e = await store.lire('elements', id); if (!e || e.type !== 'note') throw new Error('Note introuvable.'); pageNotes(e.malle);
      await store.supprimer(id); return true;
    },
    'arbre.lister': async () => { exiger(app, 'arbre:lire'); return arbre.tous().filter((n) => !n.corbeille).map(({ id, parent, ordre, type, nom, desc }) => ({ id, parent, ordre, type, nom, desc })); },
    'fichiers.lister': async (page) => { exiger(app, 'fichiers:lire'); pageNotes(page); return (await store.parIndex('fichiers', 'parent', page)).filter((f) => !f.corbeille).map(({ id, nom, mime, taille, modifie }) => ({ id, nom, mime, taille, modifie })); },
    'fichiers.lire': async (id) => { exiger(app, 'fichiers:lire'); const f = await store.lire('fichiers', id); if (!f || f.corbeille) throw new Error('Fichier introuvable.'); return f.blob; },
    'fichiers.ajouter': async (page, nom, blob) => {
      exiger(app, 'fichiers:ecrire'); pageNotes(page);
      if (!(blob instanceof Blob)) throw new Error('Le fichier doit être un Blob.');
      const { ajouterFichier } = await import('./fichiers.js');
      const f = await ajouterFichier(page, new File([blob], String(nom || 'fichier').slice(0, 120), { type: blob.type }), ns);
      return { id: f.id, nom: f.nom };
    },
    'ui.toast': (texte) => { ctx.toast(String(texte).slice(0, 140)); return true; },
    'ui.ouvrir': (lien) => { const l = String(lien); if (!/^#\/[\w\-/%.]*$/.test(l)) throw new Error('Seules les adresses internes (#/…) peuvent être ouvertes.'); location.hash = l; return true; },
    'ui.titre': (texte) => { ctx.titre(String(texte).slice(0, 80)); return true; },
    'theme.lire': () => {
      const st = getComputedStyle(document.documentElement), d = lireDecor();
      const v = (k) => st.getPropertyValue(k).trim();
      return { univers: d.univers, ambiance: document.documentElement.dataset.amb || '', papier: v('--papier'), encre: v('--encre'), accent: v('--accent'), bois: v('--bois') };
    },
  };
}

/* ---------- 4. La page #/app/<id> ---------- */
let enCours = null; // { iframe, nettoyer }
export function quitter() { if (enCours) { enCours.nettoyer(); enCours = null; } }

export async function rendreApp(vue, id, { pied, toast }) {
  quitter();
  const app = await apps.trouver(id);
  if (!app) {
    vue.innerHTML = `<section class="page app-hote"><h1>App introuvable</h1><p>Aucune app « ${esc(id)} » n’est installée sur cet appareil.</p><p><a class="btn" href="#/admin/apps">Voir les applications</a></p></section>${pied}`;
    return;
  }
  if (app.integree) { location.replace(app.manifeste.entree); return; }
  const n = arbre.tous().find((x) => x.type === 'app' && x.app === id && !x.corbeille);
  const retour = n ? arbre.lienDe(arbre.noeud(n.parent)) : '#/admin/apps';
  const m = app.manifeste;
  vue.innerHTML = `<section class="app-hote" aria-labelledby="app-titre">
    <header class="app-barre">
      <a class="app-retour" href="${esc(n && n.parent !== arbre.RACINE ? retour : '#/accueil')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Retour</span></a>
      <h1 id="app-titre">${esc(m.nom)}</h1>
      <button type="button" class="app-recharger" data-recharger><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg><span>Relancer</span></button>
    </header>
    <p class="app-erreur" role="alert" hidden></p>
    <iframe class="app-cadre" title="${esc(m.nom)}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads" ${m.materiel?.length ? `allow="${m.materiel.map((x) => ({ camera: 'camera', micro: 'microphone' }[x])).join('; ')}"` : ''} referrerpolicy="no-referrer"></iframe>
  </section>`;
  const cadre = vue.querySelector('.app-cadre'), erreur = vue.querySelector('.app-erreur');
  const ctx = { toast, titre: (t) => { vue.querySelector('#app-titre').textContent = t || m.nom; } };
  const sv = services(app, ctx);
  let page = m.entree, charge = false;
  const montrerErreur = (t) => { erreur.hidden = false; erreur.textContent = `L’app a signalé une erreur : ${t}`; };
  const lancer = () => { charge = false; erreur.hidden = true; cadre.srcdoc = SRCDOC; };
  const ecoute = async (e) => {
    if (e.source !== cadre.contentWindow || !e.data || e.data.mm !== 1) return;
    const d = e.data, repondre = (msg) => cadre.contentWindow?.postMessage({ mm: 1, ...msg }, '*');
    if (d.t === 'pret') {
      if (charge) return; charge = true;
      try {
        const p = await preparer(app, page);
        repondre({ t: 'charge', ...p, info: { id: m.id, nom: m.nom, version: m.version, page } }, p.ordre.filter((f) => f.octets).map((f) => f.octets));
      } catch (err) { montrerErreur(err.message); }
    } else if (d.t === 'appel') {
      const f = sv[d.service];
      try {
        if (!f) throw new Error(`Service inconnu : ${d.service}`);
        repondre({ t: 'reponse', id: d.id, valeur: await f(...(Array.isArray(d.args) ? d.args : [])) });
      } catch (err) { repondre({ t: 'reponse', id: d.id, erreur: err.message || String(err) }); }
    } else if (d.t === 'page' && app.fichiers.some((f) => f.chemin === d.page)) { page = d.page; lancer(); }
    else if (d.t === 'erreur') montrerErreur(String(d.texte).slice(0, 300));
  };
  window.addEventListener('message', ecoute);
  const surArbre = () => cadre.contentWindow?.postMessage({ mm: 1, t: 'evenement', nom: 'arbre' }, '*');
  window.addEventListener('mm:arbre', surArbre);
  vue.querySelector('[data-recharger]').addEventListener('click', lancer);
  enCours = { nettoyer: () => { window.removeEventListener('message', ecoute); window.removeEventListener('mm:arbre', surArbre); } };
  lancer();
}
