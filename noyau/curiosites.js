// Le cabinet de curiosités : chaque jour, un trésor se cache sur l'accueil (un objet ou un sticker).
// On le ramasse, il rejoint le cabinet ; les stickers trouvés se collent ensuite sur l'accueil.
// Et chaque jour, une carte de tarot à retourner : une question pour la journée, pas une prédiction.
// État dans IndexedDB (meta « cabinet ») : { trouves: {id: date}, jours: [dates], tresor: {date, id}, carte: {date, n, vue}, cartes: [{date, n}] }
import * as store from './store.js';
import { DECO, tintement } from './decor.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deux = (n) => String(n).padStart(2, '0');
export const aujourdhui = (d = new Date()) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateFr = (s) => DATE.format(new Date(s + 'T12:00'));

export const OBJETS = [
  ['chat-violet', 'Le chat de verre violet', 'Il a dormi des années sur un rebord de fenêtre. Il garde un peu de soleil dans le ventre.'],
  ['calice', 'Le calice améthyste', 'Pour trinquer aux petites victoires, même celles que personne n’a vues.'],
  ['fiole-fleurs', 'La fiole aux fleurs séchées', 'Un été entier, bouché au liège. On l’ouvre les jours gris.'],
  ['medaillon-pensee', 'Le médaillon à la pensée', 'Une pensée, la fleur. Et peut-être aussi l’autre sens du mot.'],
  ['flacon-chat', 'Le flacon au chat de lune', 'Il sent la nuit d’août et les étoiles filantes.'],
  ['grimoire', 'Le grimoire au lotus', 'Les pages sont vierges : c’est toi qui écris les sortilèges.'],
  ['lapin', 'Le lapin de fonte', 'Lourd, patient, immobile. Il sait attendre le bon moment.'],
  ['crapaud', 'Le crapaud rose', 'Tu peux l’embrasser. Il restera crapaud, et c’est très bien comme ça.'],
  ['loupe', 'La loupe torsadée', 'Pour voir les détails que les autres ratent.'],
  ['theiere', 'La théière vitrail', 'Elle s’allume quand on lui parle doucement.'],
  ['aigle', 'L’aigle d’argent', 'Une broche pour les jours où il faut voir les choses de haut.'],
  ['poudrier-lune', 'Le poudrier lune', 'La lune s’y poudre le nez avant de se lever.'],
  ['bouteille-poire', 'La bouteille poire', 'Verte comme une forêt après la pluie.'],
  ['boite-papillon', 'La boîte papillon', 'Dedans, des rouages de montre et un temps qui ne presse pas.'],
  ['boite-laiton', 'La boîte de laiton ajourée', 'Pour les secrets qui ont besoin de respirer.'],
  ['bocal-des', 'Le bocal de dés', 'Chaque dé se souvient d’une partie. Le hasard aussi a de la mémoire.', 'Collage d’objets : @itswafflesmix'],
  ['coffret-argent', 'Le coffret d’argent', 'Il est vide. Il attend ce qui mérite d’y entrer.'],
  ['flacon-etoile', 'Le flacon étoile', 'Un fond d’ambre et une étoile en bouchon. À ouvrir pour un vœu.'],
  ['chaton', 'Le chaton de porcelaine', 'Il a l’air surpris d’être là. Toi aussi, parfois, et c’est normal.'],
].map(([id, nom, texte, credit]) => ({ id, type: 'objet', nom, texte, credit, img: `${DECO}curios/${id}.webp` }));

export const STICKERS = [
  ['soleil', 'Le soleil qui sourit', 'Il se lève même quand tu n’en as pas envie.'],
  ['etoile-or', 'L’étoile dorée', 'Une bonne note, pour rien. Parce que tu es là.'],
  ['papillon-vert', 'Le papillon céladon', 'Vert d’eau et brun d’écorce, échappé d’une planche de naturaliste.'],
  ['marguerite', 'La touffe de marguerites', 'Un peu, beaucoup, passionnément…'],
  ['aile-fee', 'L’aile de fée', 'Quelqu’un l’a perdue en passant. Elle brille encore.'],
  ['etoile-filante', 'L’étoile filante', 'Fais un vœu, vite.'],
  ['etoile-perlee', 'L’étoile perlée', 'Brodée perle à perle, pendant des soirées entières.'],
  ['monarque', 'Le monarque', 'Il traverse un continent sans carte.'],
  ['crapaud-fee', 'Le crapaud fêtard', 'Chapeau pointu et ailes de libellule : il ne rate aucune fête.'],
  ['bouton-brun', 'Le bouton de manteau', 'Tombé d’un manteau qui a vu des hivers.'],
  ['champignon', 'Le champignon brodé', 'Trois perles sur le chapeau. Il pousse dans les coins de forêt qu’on garde pour soi.'],
  ['etoile-brodee', 'L’étoile au fil d’or', 'Cousue main, un peu de travers, parfaite.'],
  ['nuage', 'Le nuage gravé', 'Il vient d’un vieux livre et n’annonce jamais la pluie.'],
  ['bouton-creme', 'Le bouton crème', 'Celui qui manquait à ta veste préférée.'],
  ['faon', 'Le faon brodé', 'Il se cache dans les fougères et regarde passer le monde.'],
].map(([id, nom, texte]) => ({ id, type: 'sticker', nom, texte, img: `${DECO}stickers/${id}.webp` }));

export const TOUT = [...OBJETS, ...STICKERS];
const parId = new Map(TOUT.map((o) => [o.id, o]));
export const objet = (id) => parId.get(id);

// Tarot de Rider-Waite-Smith (1909), illustré par Pamela Colman Smith, domaine public.
export const CARTES = [
  ['Le Mat', 'Un pas dans le vide, le nez au vent. Qu’oserais-tu commencer sans tout savoir ?'],
  ['Le Magicien', 'Tout est déjà sur la table. Quel outil prends-tu en main aujourd’hui ?'],
  ['La Papesse', 'Le silence en sait long. Que sens-tu, sans pouvoir encore l’expliquer ?'],
  ['L’Impératrice', 'Ce qui pousse a besoin de soin. Que peux-tu faire grandir aujourd’hui ?'],
  ['L’Empereur', 'Un cadre, ça libère. Quelle règle simple t’aiderait cette semaine ?'],
  ['Le Hiérophante', 'Apprendre de celles et ceux qui sont passés avant. Qui peux-tu écouter aujourd’hui ?'],
  ['Les Amoureux', 'Un choix qui vient du cœur. Qu’est-ce qui te ressemble vraiment ?'],
  ['Le Chariot', 'Les deux chevaux tirent chacun de leur côté. Où veux-tu aller, toi ?'],
  ['La Force', 'La douceur tient le lion. Que peux-tu apaiser au lieu de le combattre ?'],
  ['L’Ermite', 'Une lanterne suffit pour le prochain pas. De quel moment seul as-tu besoin ?'],
  ['La Roue de Fortune', 'Tout tourne. Qu’est-ce qui change en ce moment, et qu’en fais-tu ?'],
  ['La Justice', 'Peser, puis trancher. Quelle décision attend depuis trop longtemps ?'],
  ['Le Pendu', 'Voir le monde à l’envers, ça aide parfois. Et si tu changeais de point de vue ?'],
  ['L’Arcane sans nom', 'Une fin qui fait de la place. Que peux-tu laisser partir ?'],
  ['La Tempérance', 'Mélanger, doser, prendre son temps. Où mettre un peu d’équilibre ?'],
  ['Le Diable', 'Les chaînes sont lâches, on peut les enlever. Qu’est-ce qui te retient sans raison ?'],
  ['La Tour', 'Ce qui tombe était fragile. Que reconstruirais-tu autrement ?'],
  ['L’Étoile', 'Après l’orage, l’eau claire. Quel espoir mérite d’être arrosé ?'],
  ['La Lune', 'Tout n’est pas clair, et c’est permis. Quelle intuition suivre à tâtons ?'],
  ['Le Soleil', 'Simple, chaud, joyeux. Qu’est-ce qui te fait du bien sans effort ?'],
  ['Le Jugement', 'Un appel, un réveil. À quoi as-tu envie de dire oui, enfin ?'],
  ['Le Monde', 'Une boucle se ferme. Qu’as-tu accompli que tu oublies de fêter ?'],
].map(([nom, texte], n) => ({ n, nom, texte, img: `${DECO}tarot/t${deux(n)}.webp` }));

// Planches d'Ernst Haeckel, Kunstformen der Natur (1904), domaine public. Une par semaine dans le cabinet.
export const PLANCHES = [
  ['008', 'Discomedusae', 'Méduses discoïdes'], ['074', 'Orchidae', 'Orchidées'], ['058', 'Tineida', 'Petits papillons de nuit'],
  ['072', 'Muscinae', 'Mousses'], ['049', 'Actiniae', 'Anémones de mer'], ['062', 'Nepenthaceae', 'Plantes carnivores'],
  ['099', 'Trochilidae', 'Colibris'], ['028', 'Discomedusae', 'Méduses discoïdes'],
].map(([n, latin, nom]) => ({ n, latin, nom, img: `${DECO}haeckel/h${n}.webp` }));
export function planche(d = new Date()) {
  const semaine = Math.floor((d - new Date(2026, 0, 5)) / (7 * 864e5));
  return PLANCHES[((semaine % PLANCHES.length) + PLANCHES.length) % PLANCHES.length];
}

/* ---------- L'état ---------- */
function alea(g) { let s = g >>> 0 || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const num = (s) => +s.replaceAll('-', '');
// ordre de découverte : mélangé une fois pour toutes, avec un sticker tous les deux ou trois objets
const ORDRE = (() => {
  const r = alea(1907), o = OBJETS.map((x) => x.id).sort(() => r() - 0.5), st = STICKERS.map((x) => x.id).sort(() => r() - 0.5);
  const l = ['etoile-or'];
  while (o.length || st.length) { if (o.length) l.push(o.shift()); if (o.length && r() < 0.5) l.push(o.shift()); if (st.length) { const x = st.shift(); if (x !== 'etoile-or') l.push(x); } }
  return l;
})();

export async function lire() {
  const e = (await store.lireMeta('cabinet').catch(() => null)) || {};
  return { trouves: {}, jours: [], cartes: [], ...e };
}
const ecrire = (e) => store.ecrireMeta('cabinet', e).catch(() => {});

/** À l'ouverture de l'accueil : note la visite, prépare le trésor et la carte du jour. */
export async function jour() {
  const e = await lire(), auj = aujourdhui();
  let change = false;
  if (!e.jours.includes(auj)) { e.jours = [...e.jours, auj].slice(-400); change = true; }
  if (e.tresor?.date !== auj) {
    const id = ORDRE.find((x) => !e.trouves[x]);
    e.tresor = { date: auj, id: id || null }; change = true;
  }
  if (e.carte?.date !== auj) {
    const r = alea(num(auj) * 7 + 3), recentes = new Set(e.cartes.slice(-6).map((c) => c.n));
    let n = Math.floor(r() * 22); for (let k = 0; k < 22 && recentes.has(n); k++) n = (n + 5) % 22;
    e.carte = { date: auj, n, vue: false }; change = true;
  }
  if (change) await ecrire(e);
  return e;
}
export async function ramasser(id) {
  const e = await lire();
  if (!e.trouves[id]) e.trouves[id] = aujourdhui();
  await ecrire(e);
  return e;
}
export async function retournerCarte() {
  const e = await lire();
  if (e.carte && !e.carte.vue) { e.carte.vue = true; e.cartes = [...e.cartes.filter((c) => c.date !== e.carte.date), { date: e.carte.date, n: e.carte.n }].slice(-120); await ecrire(e); }
  return e;
}
export function serie(e) { // jours d'affilée, aujourd'hui compris
  const s = new Set(e.jours); let n = 0; const d = new Date();
  while (s.has(aujourdhui(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const nbTrouves = (e) => TOUT.filter((o) => e.trouves[o.id]).length;

/* ---------- Sur l'accueil ---------- */
export function tCarte(e) {
  const c = CARTES[e.carte?.n ?? 0], vue = e.carte?.vue;
  return `<article class="tuile t-carte${vue ? ' retournee' : ''}" data-w="carte" aria-label="La carte du jour">
    <span class="scotch" data-cle="carte" aria-hidden="true"></span>
    <h2 class="t-titre">La carte du jour</h2>
    <div class="carte-jeu">
      <button type="button" class="carte-3d" data-carte ${vue ? 'aria-hidden="true" tabindex="-1"' : 'aria-label="Retourne-moi : la carte du jour"'}>
        <span class="face dos" style="--dos:url('${PLANCHES[7].img}')"><span>Retourne-moi</span></span>
        <span class="face recto"><img src="${c.img}" alt="${vue ? esc(`${c.nom}, carte du tarot`) : ''}" loading="lazy" width="300" height="520"></span>
      </button>
      <p class="carte-invite" ${vue ? 'hidden' : ''}>Une carte t’attend. Retourne-la quand tu veux.</p>
      <div class="carte-texte" ${vue ? '' : 'hidden'}><h3>${esc(c.nom)}</h3><p>${esc(c.texte)}</p></div>
    </div>
    <p class="carte-note">Une question pour la journée, pas une prédiction.</p>
  </article>`;
}
export function tCabinet(e) {
  const trouves = TOUT.filter((o) => e.trouves[o.id]).sort((a, b) => (e.trouves[b.id] || '').localeCompare(e.trouves[a.id] || '')).slice(0, 4);
  const n = nbTrouves(e), s = serie(e);
  return `<a class="tuile t-cabinet" data-w="cabinet" href="#/cabinet">
    <h2 class="t-titre">Le cabinet de curiosités</h2>
    <div class="cab-rayon" style="--bord:url('${DECO}bordures/b2.webp')">${trouves.length ? trouves.map((o) => `<img src="${o.img}" alt="" loading="lazy">`).join('') : '<span class="petit">Encore vide : un trésor se cache sur l’accueil.</span>'}</div>
    <p class="petit"><b>${n}</b> sur ${TOUT.length} trouvés${s > 1 ? `, ${s} jours d’affilée` : ''}</p>
  </a>`;
}
// emplacements des stickers trouvés : [tuile, coin, rotation]
const PLACES = [['meteo', 'bd', -12], ['carte', 'hg', 10], ['temps', 'hd', 8], ['calendrier', 'bg', -8], ['priorites', 'bd', 14], ['armoire', 'hd', -6], ['boite', 'bd', 9],
  ['cours', 'hd', -10], ['loge', 'bg', 12], ['musique', 'hd', -4], ['cabinet', 'bd', 6], ['carte', 'bd', -14], ['courses', 'bd', 10], ['ephemeride', 'bd', -9], ['horloge', 'bd', 7]];
const CACHETTES = ['meteo', 'priorites', 'calendrier', 'temps', 'musique', 'carte', 'ephemeride', 'horloge'];
/** Pose les stickers trouvés et le trésor du jour sur les tuiles déjà rendues. */
function coller(vue, s, i, neuf = false) {
  const [w, coin, r] = PLACES[i % PLACES.length];
  const t = vue.querySelector(`[data-w="${w}"]`);
  if (t) t.insertAdjacentHTML('beforeend', `<img class="sticker coin-${coin}${neuf ? ' neuf' : ''}" src="${s.img}" alt="" aria-hidden="true" style="--r:${r}deg" loading="lazy">`);
}
/** Colle un sticker qui vient d'être trouvé, à sa place. */
export function collerSticker(vue, e, id) {
  const i = STICKERS.filter((s) => e.trouves[s.id]).findIndex((s) => s.id === id);
  if (i >= 0) coller(vue, objet(id), i, true);
}
export function decorer(vue, e, stickersVisibles = true) {
  if (stickersVisibles) STICKERS.filter((s) => e.trouves[s.id]).forEach((s, i) => coller(vue, s, i));
  const id = e.tresor?.id;
  if (!id || e.trouves[id]) return;
  const o = objet(id);
  const visibles = CACHETTES.filter((w) => vue.querySelector(`[data-w="${w}"]`));
  if (!o || !visibles.length) return;
  const r = alea(num(e.tresor.date));
  const w = visibles[Math.floor(r() * visibles.length)], coin = ['hd', 'bd', 'bg'][Math.floor(r() * 3)];
  vue.querySelector(`[data-w="${w}"]`).insertAdjacentHTML('beforeend', `<button type="button" class="tresor coin-${coin}" data-tresor="${o.id}" style="--r:${Math.round(r() * 30 - 15)}deg" aria-label="Quelque chose brille ici : le ramasser"><img src="${o.img}" alt=""></button>`);
}

/* ---------- La fiche d'un objet ---------- */
export function ouvrirFiche(o, { trouve = null, nouveau = false } = {}) {
  let dlg = document.getElementById('fiche');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'fiche'; dlg.className = 'feuille fiche';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg || ev.target.closest('[data-fermer]')) dlg.close(); });
  }
  dlg.innerHTML = `<div class="fiche-corps">
    ${nouveau ? `<p class="fiche-tampon">${o.type === 'sticker' ? 'Sticker trouvé' : 'Trésor trouvé'}</p>` : ''}
    <img class="fiche-img type-${o.type}" src="${o.img}" alt="">
    <h2>${esc(o.nom)}</h2>
    <p class="fiche-texte">${esc(o.texte)}</p>
    ${trouve ? `<p class="petit">Trouvé le ${dateFr(trouve)}${o.type === 'sticker' ? ', collé sur ton accueil' : ''}.</p>` : ''}
    ${o.credit ? `<p class="petit">${esc(o.credit)}</p>` : ''}
    <div class="feuille-actions"><a class="btn-sobre" href="#/cabinet" data-fermer>Voir le cabinet</a><button type="button" class="btn" data-fermer>${nouveau ? 'Le ranger' : 'Fermer'}</button></div>
  </div>`;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  if (nouveau) tintement();
}

/* ---------- La page du cabinet ---------- */
export async function rendreCabinet(vue, { barre, pied }) {
  const e = await jour();
  const n = nbTrouves(e), s = serie(e), p = planche();
  const vitrine = (l) => l.map((o) => {
    const t = e.trouves[o.id];
    return t ? `<li><button type="button" class="cab-objet type-${o.type}" data-fiche="${o.id}"><img src="${o.img}" alt="" loading="lazy"><span>${esc(o.nom)}</span></button></li>`
      : `<li><span class="cab-objet manque type-${o.type}"><img src="${o.img}" alt="" loading="lazy"><span><span class="sr">Pas encore trouvé</span><span aria-hidden="true">?</span></span></span></li>`;
  }).join('');
  const cartes = [...e.cartes].reverse().slice(0, 12);
  vue.innerHTML = `${barre('Le cabinet de curiosités')}
  <section class="page cabinet" style="--bord:url('${DECO}bordures/b2.webp');--bord2:url('${DECO}bordures/b6.webp')">
    <p class="cab-chiffres"><b>${n}</b> trouvés sur ${TOUT.length}. ${s > 1 ? `Tu passes au grenier depuis ${s} jours d’affilée.` : 'Reviens demain : un autre trésor se cachera sur l’accueil.'}</p>
    <div class="meuble">
      <h2 class="meuble-titre">Les objets</h2>
      <ul class="etageres">${vitrine(OBJETS)}</ul>
    </div>
    <div class="planche-stickers">
      <h2>Les stickers</h2>
      <p class="petit">Ceux que tu trouves se collent tout seuls sur ton accueil.</p>
      <ul class="stickers-liste">${vitrine(STICKERS)}</ul>
    </div>
    ${cartes.length ? `<div class="cartes-tirees"><h2>Tes cartes</h2><ul>${cartes.map((c) => { const k = CARTES[c.n]; return `<li><img src="${k.img}" alt="" loading="lazy"><span><b>${esc(k.nom)}</b><small>${dateFr(c.date)}</small></span></li>`; }).join('')}</ul></div>` : ''}
    <figure class="planche-semaine">
      <span class="scotch" data-cle="planche" aria-hidden="true"></span>
      <img src="${p.img}" alt="${esc(p.nom)}, planche d’Ernst Haeckel" loading="lazy">
      <figcaption><b>La planche de la semaine</b> ${esc(p.nom)} (${esc(p.latin)}), Ernst Haeckel, <i>Kunstformen der Natur</i>, 1904. Domaine public.</figcaption>
    </figure>
    <p class="petit credits">Cartes : tarot Rider-Waite-Smith, 1909, illustré par Pamela Colman Smith, domaine public.</p>
  </section>${pied()}`;
  vue.onclick = (ev) => {
    const b = ev.target.closest('[data-fiche]');
    if (b) ouvrirFiche(objet(b.dataset.fiche), { trouve: e.trouves[b.dataset.fiche] });
  };
}
