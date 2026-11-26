// L'Accueil : le tableau de bord du Grenier. Une grille d'objets (bento) : la lucarne, l'horloge, l'éphéméride,
// le calendrier, le temps qui passe, les priorités, et un aperçu de chaque malle.
import * as store from './store.js';
import * as meteo from './meteo.js';
import * as decor from './decor.js';
import * as cab from './curiosites.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* plein */ } };
const deux = (n) => String(n).padStart(2, '0');
const dateLocale = (d = new Date()) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
const FR = (o) => new Intl.DateTimeFormat('fr-FR', o);
const HEURE = FR({ hour: '2-digit', minute: '2-digit' });
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const WIDGETS = [
  ['lucarne', 'La lucarne (heure et ciel)'], ['horloge', 'L’horloge'], ['ephemeride', 'L’éphéméride'], ['meteo', 'La météo'],
  ['carte', 'La carte du jour'], ['cabinet', 'Le cabinet de curiosités'], ['calendrier', 'Le calendrier'], ['priorites', 'Les priorités'], ['temps', 'Le temps qui passe'], ['courses', 'Les courses'],
  ['armoire', 'L’armoire'], ['loge', 'La Loge'], ['boite', 'La Boîte à trier'], ['cours', 'Les cours'], ['musique', 'La musique'], ['devise', 'La devise'],
];
export const widgetsCaches = () => lire('grenier.accueil.caches', []);
export const cacherWidgets = (l) => ecrire('grenier.accueil.caches', l);

/* ---------- Le ciel de la lucarne ---------- */
const minutes = (d) => d.getHours() * 60 + d.getMinutes();
function heureISO(s) { const d = new Date(s); return Number.isNaN(+d) ? null : d; }
function soleilDuJour(m) {
  const d = m?.d?.daily;
  const auj = dateLocale();
  const i = d?.time ? d.time.indexOf(auj) : -1;
  const lever = i >= 0 ? heureISO(d.sunrise[i]) : null, coucher = i >= 0 ? heureISO(d.sunset[i]) : null;
  return { lever: lever ? minutes(lever) : 8 * 60, coucher: coucher ? minutes(coucher) : 17 * 60 + 30, connu: Boolean(lever) };
}
function phase(t, lever, coucher) {
  if (t < lever - 50 || t > coucher + 50) return 'nuit';
  if (t < lever + 40) return 'aube';
  if (t > coucher - 40) return 'crepuscule';
  if (t > coucher - 100) return 'doree';
  return 'jour';
}
const CIELS = {
  nuit: ['#0a1230', '#16244b', '#26365f'],
  aube: ['#2f3f72', '#c98a86', '#f4c99b'],
  jour: ['#4f8fd0', '#86bce4', '#cfe7f2'],
  doree: ['#5d82be', '#d7a676', '#f5cf8e'],
  crepuscule: ['#232a58', '#a85a62', '#f09a62'],
};
function ageLune(d = new Date()) { return (((d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588 + 29.530588) % 29.530588; }
function alea(g) { let s = g >>> 0 || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const NUAGE = (x, y, k, c, o) => `<g transform="translate(${x} ${y}) scale(${k})" fill="${c}" opacity="${o}"><ellipse cx="0" cy="10" rx="46" ry="16"/><ellipse cx="-18" cy="2" rx="22" ry="18"/><ellipse cx="12" cy="-4" rx="26" ry="22"/><ellipse cx="34" cy="6" rx="18" ry="14"/></g>`;

function ciel(now, m) {
  const { lever, coucher } = soleilDuJour(m);
  const t = minutes(now);
  const ph = phase(t, lever, coucher);
  const code = m?.d?.current?.weather_code;
  const quoi = code === undefined ? 'clair' : meteo.decrire(code).ciel;
  const [a, b, c] = CIELS[ph];
  const sombre = ['couvert', 'pluie', 'orage', 'neige'].includes(quoi);
  const rnd = alea(+dateLocale().replaceAll('-', ''));
  let astres = '', meteoSvg = '';
  if (ph === 'nuit') {
    if (!sombre) for (let i = 0; i < 38; i++) astres += `<circle cx="${(rnd() * 400).toFixed(1)}" cy="${(rnd() * 150).toFixed(1)}" r="${(0.5 + rnd() * 1.1).toFixed(2)}" fill="#fff8e6" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
    const nuitDuree = 1440 - coucher + lever;
    const f = ((t - coucher + 1440) % 1440) / nuitDuree;
    const x = 50 + f * 300, y = 150 - Math.sin(Math.PI * Math.min(1, Math.max(0, f))) * 100;
    const age = ageLune(now), k = Math.cos((age / 29.53) * 2 * Math.PI); // 1 nouvelle, -1 pleine
    const dx = (age < 14.77 ? 1 : -1) * (1 - k) * 16; // ombre décalée : 0 à la nouvelle lune, hors du disque à la pleine
    astres += `<clipPath id="lune-c"><circle cx="${x}" cy="${y}" r="15"/></clipPath><g opacity="${sombre ? 0.35 : 1}"><circle cx="${x}" cy="${y}" r="26" fill="#f3ead2" opacity=".12"/><circle cx="${x}" cy="${y}" r="15" fill="#f3ead2"/><circle cx="${x - dx}" cy="${y}" r="15.5" fill="#1b2a52" opacity=".92" clip-path="url(#lune-c)"/></g>`;
  } else {
    const f = Math.min(1, Math.max(0, (t - lever) / (coucher - lever)));
    const x = 40 + f * 320, y = 165 - Math.sin(Math.PI * f) * 120;
    const coul = ph === 'jour' ? '#fff6d8' : '#ffd79a';
    astres = `<circle cx="${x}" cy="${y}" r="38" fill="${coul}" opacity=".22"/><circle cx="${x}" cy="${y}" r="17" fill="${coul}" opacity="${sombre ? 0.4 : 1}"/>`;
  }
  const blanc = ph === 'nuit' ? '#4a5576' : ph === 'jour' ? '#ffffff' : '#f3d6c4';
  const gris = ph === 'nuit' ? '#2c3550' : '#9aa3ad';
  if (quoi === 'voile') meteoSvg = NUAGE(300, 60, 0.8, blanc, 0.75);
  if (quoi === 'nuages') meteoSvg = NUAGE(90, 70, 0.9, blanc, 0.85) + NUAGE(300, 45, 0.7, blanc, 0.75) + NUAGE(220, 120, 1, blanc, 0.9);
  if (sombre) {
    meteoSvg = `<rect width="400" height="200" fill="${gris}" opacity="${ph === 'nuit' ? 0.45 : 0.6}"/>`;
    for (let i = 0; i < 7; i++) meteoSvg += NUAGE(i * 70 - 10 + rnd() * 20, 20 + rnd() * 70, 0.9 + rnd() * 0.5, gris, 0.95);
    if (quoi === 'pluie' || quoi === 'orage') for (let i = 0; i < 46; i++) { const x = rnd() * 420, y = 90 + rnd() * 110; meteoSvg += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l-5 13" stroke="#dfe8f2" stroke-width="1.3" opacity=".6"/>`; }
    if (quoi === 'neige') for (let i = 0; i < 60; i++) meteoSvg += `<circle cx="${(rnd() * 400).toFixed(1)}" cy="${(80 + rnd() * 120).toFixed(1)}" r="${(1 + rnd() * 1.6).toFixed(2)}" fill="#fff"/>`;
    if (quoi === 'orage') meteoSvg += '<path d="M232 70l-18 40h16l-12 34 34-46h-17l13-28z" fill="#fff3b0" opacity=".9"/>';
  }
  if (quoi === 'brume') meteoSvg = '<rect y="60" width="400" height="140" fill="#e8ecef" opacity=".55"/><rect y="110" width="400" height="90" fill="#f1f3f4" opacity=".5"/>';
  return { ph, svg: `<svg class="lucarne-ciel" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="ciel-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#ciel-g)"/>${astres}${meteoSvg}
    <path d="M0 200 L0 176 Q40 160 70 172 T140 168 T210 176 T300 164 T400 174 L400 200Z" fill="${ph === 'nuit' ? '#0d1326' : '#4a5a46'}" opacity=".85"/>
    <path d="M0 200 L0 186 Q60 176 120 186 T260 182 T400 188 L400 200Z" fill="${ph === 'nuit' ? '#070b18' : '#33412f'}"/>
  </svg>` };
}

/* ---------- Les tuiles ---------- */
const SALUT = (h) => (h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir');

/* La lucarne : un cadre (arche, hublot, vitrail, croisée), une vue (le vrai ciel ou une scène animée),
   et ses garnitures (lierre et lanternes, carillon). Un appui sur la vitre change la vue. */
function arcGothique(asp = 0.72, r = 0.6) { // ogive en pourcentages : deux arcs de rayon r (en largeurs) qui se rejoignent en pointe
  const debut = Math.acos((0.5 - r) / r), haut = r * Math.sin(debut) * asp * 100, pts = [];
  for (let i = 0; i <= 16; i++) { const t = Math.PI - (Math.PI - debut) * (i / 16); pts.push([(r + r * Math.cos(t)) * 100, haut - r * Math.sin(t) * asp * 100]); }
  const g = pts.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`), d = pts.slice(0, -1).reverse().map(([x, y]) => `${(100 - x).toFixed(1)}% ${y.toFixed(1)}%`);
  return `polygon(0 100%, ${g.join(', ')}, ${d.join(', ')}, 100% 100%)`;
}
const OGIVE = arcGothique();
function surVitre(cadre) {
  if (cadre === 'hublot') return `<svg class="sur-vitre" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47.5" fill="none" stroke="#b8913f" stroke-width="5"/><circle cx="50" cy="50" r="45" fill="none" stroke="#6d5126" stroke-width=".8"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${(50 + 47.5 * Math.cos(a)).toFixed(2)}" cy="${(50 + 47.5 * Math.sin(a)).toFixed(2)}" r="1.5" fill="#f3d68e" stroke="#5a3f16" stroke-width=".5"/>`; }).join('')}</svg>`;
  if (cadre === 'vitrail') {
    let l = '';
    for (let i = -100; i <= 100; i += 12.5) { l += `<path d="M${i} 100 L${i + 100} 0"/><path d="M${i + 100} 100 L${i} 0"/>`; }
    return `<svg class="sur-vitre" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g class="plombs">${l}</g></svg>`;
  }
  if (cadre === 'croisee') return '<span class="croisillons" aria-hidden="true"></span>';
  return '<span class="croisee" aria-hidden="true"></span>';
}
function contenuVue(vue, svgCiel) {
  if (vue === 'ciel') return svgCiel;
  const src = `${decor.DECO}vues/${vue}`;
  return `<picture><source media="(prefers-reduced-motion: reduce)" srcset="${src}-fixe.webp"><img class="vue-anim" src="${src}.webp" alt="" decoding="async"></picture>`;
}
function tLucarne(now, m) {
  const d = decor.lireDecor();
  const { ph, svg } = ciel(now, m);
  const c = m?.d?.current;
  const temps = c ? `${meteo.decrire(c.weather_code).mot}, ${Math.round(c.temperature_2m)}°` : 'Choisis ta ville pour le ciel réel';
  const vue = decor.VUES.find((v) => v.id === d.vue);
  return `<article class="tuile t-lucarne ph-${ph} cadre-${d.cadre} vue-${d.vue}" data-w="lucarne" aria-label="La lucarne : heure et ciel">
    <div class="vitre">
      ${d.cadre === 'croisee' ? '<span class="volet g" aria-hidden="true"></span><span class="volet d" aria-hidden="true"></span>' : ''}
      <button type="button" class="verre" data-vue-suivante aria-label="Vue : ${esc(vue.nom)}. Changer la vue"${d.cadre === 'vitrail' ? ` style="clip-path:${OGIVE}"` : ''}>${contenuVue(d.vue, svg)}${surVitre(d.cadre)}<span class="reflet" aria-hidden="true"></span></button>
      ${d.cadre === 'vitrail' ? `<span class="ogive-bord" aria-hidden="true" style="clip-path:${OGIVE}"></span>` : ''}
      ${d.lierre ? `<img class="lierre" src="${decor.DECO}fenetre/lierre.webp" alt="" aria-hidden="true">` : ''}
      ${d.carillon ? `<button type="button" class="carillon" data-carillon aria-label="Faire tinter le carillon"><img src="${decor.DECO}fenetre/carillon.webp" alt=""></button>` : ''}
    </div>
    <div class="rebord">
      <p class="lu-heure"><time>${HEURE.format(now)}</time></p>
      <div class="lu-texte"><p class="lu-salut">${SALUT(now.getHours())} Louenn</p>
      <p class="lu-date">${cap(JOURS[now.getDay()])} ${now.getDate()} ${MOIS[now.getMonth()]}</p><p class="lu-temps">${esc(temps)}</p></div>
      <a class="etiq-deco" href="#/deco"><span>Changer le décor</span></a>
    </div>
  </article>`;
}

/* L'horloge : sept cadrans (le laiton dessiné, six cadrans anciens) et trois aiguilles qui tournent
   en CSS, la trotteuse comprise. Un appui change de cadran. */
const AIG = {
  laiton: { cx: 50, cy: 50, k: 1, c: '#2a1c12', s: '#b3261e', forme: 'baton' },
  engrenages: { cx: 52.8, cy: 50.3, k: 0.74, c: '#17130f', s: '#d2a75a', forme: 'fleche' },
  bistrot: { cx: 50, cy: 50, k: 0.93, c: '#ddb763', s: '#f3e6c4', forme: 'lance' },
  squelette: { cx: 50, cy: 50, k: 0.92, c: '#e6d3a3', s: '#c0392b', forme: 'pique' },
  atelier: { cx: 50, cy: 50, k: 0.8, c: '#16110e', s: '#a3271c', forme: 'pique' },
  gare: { cx: 49.4, cy: 50, k: 0.8, c: '#141210', s: '#9c2f1f', forme: 'ornee' },
  chateau: { cx: 50, cy: 50, k: 0.93, c: '#151110', s: '#e0bd62', forme: 'pique' },
};
function aiguille(forme, cx, cy, L, l, c) {
  const y = cy - L, f = (n) => n.toFixed(2);
  if (forme === 'baton') return `<path d="M${f(cx)} ${f(cy + 4)}V${f(y)}" stroke="${c}" stroke-width="${l}" stroke-linecap="round"/>`;
  if (forme === 'lance') return `<path d="M${f(cx - l * 0.4)} ${f(cy + 7)}V${f(y + 7)}H${f(cx - l)}L${f(cx)} ${f(y)}L${f(cx + l)} ${f(y + 7)}H${f(cx + l * 0.4)}V${f(cy + 7)}Z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width=".3"/><circle cx="${f(cx)}" cy="${f(cy + 8)}" r="${f(l * 0.9)}" fill="${c}"/>`;
  if (forme === 'pique') return `<path d="M${f(cx - l * 0.35)} ${f(cy + 5)}V${f(y + L * 0.3)}H${f(cx + l * 0.35)}V${f(cy + 5)}Z" fill="${c}"/><path d="M${f(cx)} ${f(y)}C${f(cx + l * 1.7)} ${f(y + L * 0.16)} ${f(cx + l * 1.5)} ${f(y + L * 0.27)} ${f(cx)} ${f(y + L * 0.33)}C${f(cx - l * 1.5)} ${f(y + L * 0.27)} ${f(cx - l * 1.7)} ${f(y + L * 0.16)} ${f(cx)} ${f(y)}Z" fill="${c}"/><circle cx="${f(cx)}" cy="${f(cy + 6)}" r="${f(l * 0.8)}" fill="${c}"/>`;
  if (forme === 'fleche') return `<path d="M${f(cx)} ${f(cy + 5)}V${f(y + 5)}" stroke="${c}" stroke-width="${l * 0.55}"/><path d="M${f(cx)} ${f(y)}L${f(cx + l)} ${f(y + 6)}L${f(cx)} ${f(y + 4.5)}L${f(cx - l)} ${f(y + 6)}Z" fill="${c}"/>`;
  // ornee : fine, avec un petit ornement aux deux tiers
  return `<path d="M${f(cx)} ${f(cy + 5)}V${f(y)}" stroke="${c}" stroke-width="${l * 0.5}" stroke-linecap="round"/><circle cx="${f(cx)}" cy="${f(cy - L * 0.62)}" r="${f(l * 0.9)}" fill="none" stroke="${c}" stroke-width="${l * 0.45}"/><path d="M${f(cx - l * 1.3)} ${f(cy - L * 0.45)}Q${f(cx)} ${f(cy - L * 0.3)} ${f(cx + l * 1.3)} ${f(cy - L * 0.45)}" fill="none" stroke="${c}" stroke-width="${l * 0.45}"/>`;
}
function tHorloge(now) {
  const style = decor.lireDecor().horloge, a = AIG[style] || AIG.laiton;
  const sec = now.getSeconds() + now.getMilliseconds() / 1000, min = now.getMinutes() + sec / 60, h = (now.getHours() % 12) + min / 60;
  const R = 40 * a.k, o = `transform-origin:${a.cx}px ${a.cy}px`;
  let cadran;
  if (style === 'laiton') {
    const graduations = Array.from({ length: 60 }, (_, i) => { const g = i * 6, long = i % 5 === 0; return `<line x1="50" y1="${long ? 9 : 10.5}" x2="50" y2="${long ? 15 : 13}" transform="rotate(${g} 50 50)" stroke-width="${long ? 1.6 : 0.7}"/>`; }).join('');
    const chiffres = [['12', 50, 24], ['3', 77, 53.5], ['6', 50, 82], ['9', 23, 53.5]].map(([t, x, y]) => `<text x="${x}" y="${y}">${t}</text>`).join('');
    cadran = `<defs><radialGradient id="laiton-g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f6dc9a"/><stop offset=".45" stop-color="#c79f55"/><stop offset="1" stop-color="#7a5a26"/></radialGradient></defs>
      <circle cx="50" cy="50" r="48" class="anneau"/><circle cx="50" cy="50" r="42.5" class="fond-cadran"/><g class="grad">${graduations}</g><g class="chiffres">${chiffres}</g>`;
  } else cadran = `<image href="${decor.DECO}horloges/${style}.webp" x="0" y="0" width="100" height="100"/>`;
  const sw = a.forme === 'baton' ? [3.2, 2] : a.forme === 'lance' ? [2.3, 1.8] : a.forme === 'pique' ? [1.9, 1.5] : [2, 1.6];
  return `<article class="tuile t-horloge h-${style}" data-w="horloge">
    <button type="button" class="horloge-btn" data-horloge-suivante><span class="sr">Horloge ${esc(decor.nomDe('horloge', style))}, il est ${HEURE.format(now)}. Changer de cadran</span>
    <svg viewBox="0 0 100 100" class="cadran" aria-hidden="true">${cadran}
      <g class="aig h" style="${o};animation-delay:-${(h * 3600).toFixed(1)}s">${aiguille(a.forme, a.cx, a.cy, R * 0.56, sw[0] * a.k * 1.25, a.c)}</g>
      <g class="aig m" style="${o};animation-delay:-${(min * 60).toFixed(1)}s">${aiguille(a.forme, a.cx, a.cy, R * 0.84, sw[1] * a.k * 1.25, a.c)}</g>
      <g class="aig s" style="${o};animation-delay:-${sec.toFixed(2)}s"><path d="M${a.cx} ${a.cy + R * 0.24}V${a.cy - R * 0.9}" stroke="${a.s}" stroke-width="${0.7 * Math.max(a.k, 0.85)}" stroke-linecap="round"/><circle cx="${a.cx}" cy="${a.cy + R * 0.2}" r="${1.9 * a.k}" fill="${a.s}"/></g>
      <circle cx="${a.cx}" cy="${a.cy}" r="${2.4 * Math.max(a.k, 0.8)}" fill="${a.s}" stroke="rgba(0,0,0,.4)" stroke-width=".4"/>
    </svg></button>
  </article>`;
}

function semaineISO(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const j = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - j); const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
function jourDeLAnnee(d) { return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5); }
function tEphemeride(now, m, evAujourdhui) {
  const { lever, coucher, connu } = soleilDuJour(m);
  const hm = (x) => `${Math.floor(x / 60)} h ${deux(x % 60)}`;
  const annee = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100) || now.getFullYear() % 400 === 0 ? 366 : 365;
  const style = decor.lireDecor().ephemeride;
  return `<article class="tuile t-ephemeride eph-${style}" data-w="ephemeride" aria-label="Éphéméride">
    ${style === 'ticket' ? `<p class="tk-tete"><span>No. ${deux(jourDeLAnnee(now)).padStart(3, '0')}</span><b>Ticket</b></p>` : '<div class="eph-reliure" aria-hidden="true"></div>'}
    <p class="eph-jour">${cap(JOURS[now.getDay()])}</p>
    <p class="eph-num">${now.getDate()}</p>
    <p class="eph-mois">${MOIS[now.getMonth()]} ${now.getFullYear()}</p>
    <p class="eph-pied">Jour ${jourDeLAnnee(now)} sur ${annee}<br>Semaine ${semaineISO(now)}</p>
    ${connu ? `<p class="eph-soleil">Lever ${hm(lever)}<br>Coucher ${hm(coucher)}</p>` : ''}
    ${evAujourdhui.length ? `<p class="eph-rdv">${evAujourdhui.length === 1 ? '1 rendez-vous' : `${evAujourdhui.length} rendez-vous`} aujourd’hui</p>` : ''}
  </article>`;
}

function tMeteo(m) {
  const l = meteo.lieu();
  if (!l) return `<article class="tuile t-meteo vide-meteo" data-w="meteo" aria-label="Météo">
    <h2 class="t-titre">La météo</h2>
    <p>Où es-tu ? Le ciel de la lucarne suivra le vrai temps.</p>
    <div class="meteo-choix"><button type="button" class="btn" data-geo>Ma position</button>
    <form class="ville" data-ville><label class="sr" for="ville-q">Ville</label><input id="ville-q" name="q" placeholder="Une ville…" autocomplete="off" required><button class="btn-sobre">Chercher</button></form></div>
    <ul class="villes" data-villes></ul>
  </article>`;
  if (!m) return `<article class="tuile t-meteo" data-w="meteo" aria-label="Météo"><h2 class="t-titre">La météo, ${esc(l.nom)}</h2><p>Relevé en cours… (il faut une connexion la première fois)</p></article>`;
  const d = m.d, c = d.current, jour = c.is_day === 1;
  const heures = [];
  const maintenant = Date.now();
  for (let i = 0; i < d.hourly.time.length && heures.length < 8; i++) {
    const t = new Date(d.hourly.time[i]);
    if (+t + 3600e3 < maintenant) continue;
    if (heures.length && (t.getHours() % 2)) continue;
    const h = t.getHours();
    heures.push(`<li><span>${heures.length ? `${h} h` : 'Maint.'}</span>${meteo.picto(d.hourly.weather_code[i], h >= 7 && h < 19)}<b>${Math.round(d.hourly.temperature_2m[i])}°</b>${d.hourly.precipitation_probability?.[i] >= 30 ? `<small>${d.hourly.precipitation_probability[i]} %</small>` : ''}</li>`);
  }
  const jours = d.daily.time.slice(1, 6).map((s, k) => {
    const i = k + 1, dt = new Date(s + 'T12:00');
    return `<li><span>${cap(JOURS[dt.getDay()].slice(0, 3))}.</span>${meteo.picto(d.daily.weather_code[i])}<b>${Math.round(d.daily.temperature_2m_max[i])}°</b><small>${Math.round(d.daily.temperature_2m_min[i])}°</small></li>`;
  }).join('');
  const quand = HEURE.format(new Date(m.t));
  return `<article class="tuile t-meteo" data-w="meteo" aria-label="Météo à ${esc(l.nom)}"><span class="scotch" data-cle="meteo" aria-hidden="true"></span>
    <div class="me-haut">
      <div class="me-actuel">${meteo.picto(c.weather_code, jour)}<p class="me-temp">${Math.round(c.temperature_2m)}°</p></div>
      <div class="me-mots"><h2 class="t-titre">${esc(l.nom)}</h2><p>${esc(meteo.decrire(c.weather_code).mot)}</p>
      <p class="petit">Ressenti ${Math.round(c.apparent_temperature)}°, vent ${Math.round(c.wind_speed_10m)} km/h, humidité ${c.relative_humidity_2m} %</p></div>
    </div>
    <ul class="me-heures" tabindex="0" aria-label="Les prochaines heures">${heures.join('')}</ul>
    <ul class="me-jours">${jours}</ul>
    <p class="me-source">${m.ancien ? 'Hors connexion, dernier relevé' : 'Relevé'} à ${quand}. Données <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. <button type="button" class="lien" data-changer-ville>Changer de ville</button></p>
  </article>`;
}

/* Calendrier mural + agenda (malle « agenda » dans IndexedDB) */
let calMois = null, calJour = null;
function tCalendrier(evts) {
  const auj = new Date();
  if (!calMois) calMois = new Date(auj.getFullYear(), auj.getMonth(), 1);
  if (!calJour) calJour = dateLocale(auj);
  const premier = new Date(calMois), dec = (premier.getDay() + 6) % 7;
  const nb = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
  const parJour = {};
  evts.forEach((e) => { (parJour[e.date] ||= []).push(e); });
  let cases = '';
  for (let i = 0; i < dec; i++) cases += '<span class="case vide" aria-hidden="true"></span>';
  for (let j = 1; j <= nb; j++) {
    const s = `${premier.getFullYear()}-${deux(premier.getMonth() + 1)}-${deux(j)}`;
    const n = (parJour[s] || []).length;
    cases += `<button type="button" class="case${s === dateLocale(auj) ? ' aujourdhui' : ''}${s === calJour ? ' choisi' : ''}" data-jour="${s}" aria-pressed="${s === calJour}" aria-label="${j} ${MOIS[premier.getMonth()]}${n ? `, ${n} rendez-vous` : ''}">${j}${n ? '<i aria-hidden="true"></i>' : ''}</button>`;
  }
  const choisi = (parJour[calJour] || []).sort((a, b) => (a.heure || '99').localeCompare(b.heure || '99'));
  const dj = new Date(calJour + 'T12:00');
  const avenir = evts.filter((e) => e.date >= dateLocale(auj)).sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || ''))).slice(0, 3);
  const style = decor.lireDecor().calendrier;
  const titre = style === 'vitrail'
    ? `<h2 class="t-titre cal-plaque" style="--plaque:url('${decor.DECO}calendrier/plaque.webp')"><span class="sr">${cap(MOIS[premier.getMonth()])} ${premier.getFullYear()}</span><span aria-hidden="true">${cap(MOIS[premier.getMonth()])}</span><small aria-hidden="true">${premier.getFullYear()}</small></h2>`
    : `<h2 class="t-titre">${cap(MOIS[premier.getMonth()])} ${premier.getFullYear()}</h2>`;
  return `<article class="tuile t-calendrier cal-${style}" data-w="calendrier" aria-label="Calendrier">
    ${style === 'etiquette' ? '<span class="oeillet" aria-hidden="true"></span>' : '<span class="scotch" data-cle="calendrier" aria-hidden="true"></span>'}
    <header class="cal-tete">
      <button type="button" class="cal-fleche" data-mois="-1" aria-label="Mois précédent"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      ${titre}
      <button type="button" class="cal-fleche" data-mois="1" aria-label="Mois suivant"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
    </header>
    <div class="cal-grille"><span class="js">L</span><span class="js">M</span><span class="js">M</span><span class="js">J</span><span class="js">V</span><span class="js">S</span><span class="js">D</span>${cases}</div>
    <div class="cal-jour">
      <h3>${cap(JOURS[dj.getDay()])} ${dj.getDate()} ${MOIS[dj.getMonth()]}</h3>
      ${choisi.length ? `<ul class="rdv">${choisi.map((e) => `<li><span class="rdv-h">${esc(e.heure || 'journée')}</span><span class="rdv-t">${esc(e.titre)}</span><button type="button" class="rdv-x" data-retirer="${esc(e.id)}" aria-label="Retirer ${esc(e.titre)}">×</button></li>`).join('')}</ul>` : '<p class="petit">Rien de prévu ce jour-là.</p>'}
      <form class="rdv-ajout" data-rdv><label class="sr" for="rdv-t">Rendez-vous</label><input id="rdv-t" name="titre" placeholder="Ajouter un rendez-vous" required autocomplete="off"><label class="sr" for="rdv-h">Heure</label><input id="rdv-h" name="heure" type="time"><button class="btn">Noter</button></form>
    </div>
    ${avenir.length ? `<div class="cal-avenir"><h3>Bientôt</h3><ul>${avenir.map((e) => { const d = new Date(e.date + 'T12:00'); return `<li><b>${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}.</b> ${esc(e.titre)}${e.heure ? `, ${esc(e.heure)}` : ''}</li>`; }).join('')}</ul></div>` : ''}
  </article>`;
}

function tTemps(now) {
  const debJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pJour = (now - debJour) / 864e5;
  const js = (now.getDay() + 6) % 7, pSem = (js + pJour) / 7;
  const nbM = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), pMois = (now.getDate() - 1 + pJour) / nbM;
  const debA = new Date(now.getFullYear(), 0, 1), finA = new Date(now.getFullYear() + 1, 0, 1), pAn = (now - debA) / (finA - debA);
  const resteAn = Math.ceil((finA - now) / 864e5);
  const ruban = (nom, p, note) => `<li><div class="ru-l"><span>${nom}</span><b>${Math.floor(p * 100)} %</b></div><div class="metre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p * 100)}" aria-label="${nom}"><span style="width:${(p * 100).toFixed(1)}%"></span></div>${note ? `<small>${note}</small>` : ''}</li>`;
  const naiss = lire('grenier.naissance', '');
  let vie = '';
  if (naiss) {
    const n = new Date(naiss + 'T12:00'), ans = (now - n) / (365.2425 * 864e5);
    vie = `<div class="vie"><h3>Ma vie en années</h3><div class="vie-points" role="img" aria-label="${Math.floor(ans)} années vécues sur 90">${Array.from({ length: 90 }, (_, i) => `<i class="${i < Math.floor(ans) ? 'v' : i === Math.floor(ans) ? 'en' : ''}"${i === Math.floor(ans) ? ` style="--p:${((ans % 1) * 100).toFixed(0)}%"` : ''}></i>`).join('')}</div>
      <p class="petit">${Math.floor(ans)} ans et ${Math.floor((ans % 1) * 365)} jours. <button type="button" class="lien" data-naissance-oublier>Retirer</button></p></div>`;
  } else vie = `<form class="vie-regler" data-naissance><label for="naiss">Ta date de naissance, pour voir ta vie en années (gardée sur cet appareil)</label><span><input id="naiss" name="d" type="date" required><button class="btn-sobre">Afficher</button></span></form>`;
  return `<article class="tuile t-temps" data-w="temps" aria-label="Le temps qui passe"><span class="scotch" data-cle="temps" aria-hidden="true"></span>
    <h2 class="t-titre">Le temps qui passe</h2>
    <ul class="rubans">
      ${ruban('La journée', pJour)}
      ${ruban('La semaine', pSem)}
      ${ruban(cap(MOIS[now.getMonth()]), pMois, `encore ${nbM - now.getDate()} jours`)}
      ${ruban(String(now.getFullYear()), pAn, `encore ${resteAn} jours`)}
    </ul>
    ${vie}
  </article>`;
}

function tPriorites(liste) {
  return `<article class="tuile t-priorites" data-w="priorites" aria-label="Priorités du moment">
    <span class="scotch" data-cle="priorites" aria-hidden="true"></span>
    <h2 class="t-titre">Priorités du moment</h2>
    ${liste.length ? `<ul class="prio">${liste.map((p) => `<li><label><input type="checkbox" data-prio="${esc(p.id)}" ${p.fait ? 'checked' : ''}><span>${esc(p.texte)}</span></label></li>`).join('')}</ul>` : '<p class="prio-vide">Note ici les deux ou trois choses qui comptent cette semaine.</p>'}
    <form class="prio-ajout" data-prio-ajout><label class="sr" for="prio-t">Nouvelle priorité</label><input id="prio-t" name="t" placeholder="Ajouter une priorité" autocomplete="off" required maxlength="90"><button class="btn-sobre" aria-label="Ajouter">+</button></form>
    ${liste.some((p) => p.fait) ? '<button type="button" class="lien" data-prio-vider>Ranger celles qui sont faites</button>' : ''}
  </article>`;
}

function carnet() { try { return JSON.parse(localStorage.getItem('carnet.state') || 'null'); } catch { return null; } }
function tCourses(s) {
  const cats = new Map((s?.cats || []).map((c) => [c.id, c.kind]));
  const items = s?.items || [];
  const courses = items.filter((i) => cats.get(i.cat) === 'course' && !i.checked);
  const achats = items.filter((i) => (cats.get(i.cat) || 'achat') === 'achat' && i.status !== 'done');
  const reste = achats.reduce((a, i) => a + (+i.price || 0) * (+i.qty || 1), 0);
  return `<a class="tuile t-courses" data-w="courses" href="malles/carnet/index.html#/list/course">
    <span class="spirale" aria-hidden="true"></span>
    <h2 class="t-titre">Les courses</h2>
    ${courses.length ? `<ul class="liste-courses">${courses.slice(0, 6).map((i) => `<li>${esc(i.name || 'Sans nom')}${+i.qty > 1 ? ` <small>×${esc(i.qty)}</small>` : ''}</li>`).join('')}</ul>${courses.length > 6 ? `<p class="petit">et ${courses.length - 6} autres</p>` : ''}` : '<p class="petit">Rien à acheter pour l’instant.</p>'}
    <p class="co-achats">${achats.length ? `${achats.length} envie${achats.length > 1 ? 's' : ''} en cours${reste ? `, ${reste.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € au total` : ''}` : 'Aucune envie en cours'}</p>
  </a>`;
}
function tArmoire(s) {
  const w = s?.wr || {};
  const pieces = w.pieces || [], tenues = w.outfits || [];
  const prevue = w.plan?.[dateLocale()] ? tenues.find((o) => o.id === w.plan[dateLocale()]) : null;
  const coul = [...new Set(pieces.map((p) => p.color).filter(Boolean))].slice(0, 14);
  return `<a class="tuile t-armoire" data-w="armoire" href="malles/carnet/index.html#/armoire"><span class="scotch" data-cle="armoire" aria-hidden="true"></span>
    <h2 class="t-titre">L’armoire</h2>
    <div class="coupons" aria-hidden="true">${(coul.length ? coul : ['#7b5a7e', '#5e6e3a', '#c7948f', '#3b2e25', '#d8c9a8']).map((c, i) => `<i style="--c:${esc(c)};--r:${(i % 3 - 1) * 4}deg"></i>`).join('')}</div>
    <p>${pieces.length ? `<b>${pieces.length}</b> pièce${pieces.length > 1 ? 's' : ''}, <b>${tenues.length}</b> tenue${tenues.length > 1 ? 's' : ''}` : 'L’armoire attend ses premières pièces.'}</p>
    ${prevue ? `<p class="petit">Aujourd’hui : ${esc(prevue.name || 'tenue prévue')}</p>` : ''}
  </a>`;
}
function tLoge(loge, routine) {
  const soins = loge.filter((e) => e.type === 'soin' && e.moment);
  const etapes = soins.reduce((n, e) => n + (e.moment === 'Matin et soir' ? 2 : 1), 0);
  const faits = routine?.date === dateLocale() ? routine.faits.length : 0;
  const fin = (e) => { if (!e.ouverture || !e.mois) return null; const d = new Date(e.ouverture + 'T12:00'); d.setMonth(d.getMonth() + Number(e.mois)); return d; };
  const bientot = loge.map((e) => ({ e, f: fin(e) })).filter((x) => x.f && (x.f - Date.now()) / 864e5 <= 30).sort((a, b) => a.f - b.f);
  return `<a class="tuile t-loge" data-w="loge" href="malles/loge/index.html#soin"><span class="scotch" data-cle="loge" aria-hidden="true"></span>
    <h2 class="t-titre">La Loge</h2>
    ${etapes ? `<p>Routine du jour</p><div class="metre petit-metre" role="progressbar" aria-valuemin="0" aria-valuemax="${etapes}" aria-valuenow="${Math.min(faits, etapes)}" aria-label="Routine du jour"><span style="width:${Math.min(100, faits / etapes * 100)}%"></span></div><p class="petit">${Math.min(faits, etapes)} sur ${etapes}</p>` : '<p class="petit">Ajoute tes soins pour suivre ta routine ici.</p>'}
    ${bientot.length ? `<p class="lo-alerte">${esc(bientot[0].e.titre || 'Un produit')} ${bientot[0].f < Date.now() ? 'est à jeter' : 'arrive à sa date limite'}${bientot.length > 1 ? `, et ${bientot.length - 1} autre${bientot.length > 2 ? 's' : ''}` : ''}</p>` : ''}
  </a>`;
}
function tBoite(boite) {
  return `<a class="tuile t-boite" data-w="boite" href="#/boite"><span class="scotch" data-cle="boite" aria-hidden="true"></span>
    <h2 class="t-titre">La Boîte à trier</h2>
    ${boite.length ? `<ul class="mini-postits">${boite.slice(0, 3).map((b, i) => `<li style="--r:${[-3, 2, -1][i]}deg">${esc((b.texte || b.titre || 'Une photo').slice(0, 60))}</li>`).join('')}</ul><p class="petit">${boite.length} à trier</p>` : '<p class="petit">Vide. Le bouton + y jette une idée, d’où que tu sois.</p>'}
  </a>`;
}
function tCours() {
  return `<a class="tuile t-cours" data-w="cours" href="malles/cours/suite/index.html"><span class="scotch" data-cle="cours" aria-hidden="true"></span>
    <span class="ecran-mini" aria-hidden="true"><span>SUITE<br>BTS<br><i>&gt; ouvrir</i></span></span>
    <h2 class="t-titre">Les cours</h2><p class="petit">La Suite BTS Audiovisuel</p>
  </a>`;
}
function spotify(url) {
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/.exec(url || '');
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0` : null;
}
function tMusique() {
  const src = spotify(lire('grenier.musique', ''));
  return `<article class="tuile t-musique" data-w="musique" aria-label="Musique">
    <h2 class="t-titre">La musique</h2>
    ${src ? `<iframe title="Lecteur Spotify" src="${esc(src)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe><button type="button" class="lien" data-musique-oublier>Changer de playlist</button>`
    : `<form class="musique-lien" data-musique><label for="mu-l">Colle le lien d’une playlist Spotify</label><span><input id="mu-l" name="l" type="url" placeholder="https://open.spotify.com/playlist/…" required><button class="btn-sobre">Poser</button></span></form>`}
  </article>`;
}
function tDevise() {
  const d = lire('grenier.devise', 'Life is a journey, not a destination');
  return `<article class="tuile t-devise" data-w="devise" aria-label="Devise">
    <blockquote>${esc(d)}</blockquote>
    <button type="button" class="lien" data-devise>Changer la devise</button>
  </article>`;
}

/* ---------- Rendu et interactions ---------- */
/** Les trois objets du haut, pour l'aperçu de l'atelier de déco. */
export function teteAccueil() {
  const now = new Date(), m = meteo.releve();
  return `<div class="accueil-bento en-apercu"><div class="bento-tete">${tLucarne(now, m)}${tEphemeride(now, m, [])}${tHorloge(now)}</div></div>`;
}
function guirlande() {
  const y = (f) => { const t = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5; return f < 0.5 ? (1 - t) ** 2 * 6 + 2 * (1 - t) * t * 40 + t * t * 26 : (1 - t) ** 2 * 26 + 2 * (1 - t) * t * 12 + t * t * 8; };
  const f = Array.from({ length: 9 }, (_, i) => `<img src="${decor.DECO}papiers/fanion-${(i % 4) + 1}.webp" alt="" style="left:${((i + 0.5) / 9 * 100).toFixed(1)}%;top:${(y((i + 0.5) / 9) - 3).toFixed(1)}px;--r:${[-4, 3, -2, 5, -3, 2, -5, 4, -1][i]}deg">`).join('');
  return `<div class="guirlande" aria-hidden="true"><svg viewBox="0 0 1000 60" preserveAspectRatio="none"><path d="M0 6 Q250 40 500 26 T1000 8" fill="none" stroke="#5b4330" stroke-width="2.5"/></svg><div class="fanions">${f}</div></div>`;
}
let minuteur = 0;
export async function rendreAccueil(vue, ctx) {
  const { malles, carteMalle, comptes, pied } = ctx;
  const now = new Date();
  const [boite, loge, agenda, prio, routine, cabinet] = await Promise.all([
    store.parMalle('boite').catch(() => []), store.parMalle('loge').catch(() => []), store.parMalle('agenda').catch(() => []),
    store.lireMeta('accueil.priorites').catch(() => null), store.lireMeta('loge.routine').catch(() => null), cab.jour().catch(() => null),
  ]);
  const m = meteo.releve();
  const s = carnet();
  const d = decor.lireDecor();
  const caches = new Set(widgetsCaches());
  const evAuj = agenda.filter((e) => e.date === dateLocale(now));
  const e = cabinet || { trouves: {}, jours: [], cartes: [], carte: { n: 0 } };
  const tuiles = {
    lucarne: () => tLucarne(now, m), horloge: () => tHorloge(now), ephemeride: () => tEphemeride(now, m, evAuj), meteo: () => tMeteo(m),
    calendrier: () => tCalendrier(agenda), priorites: () => tPriorites(prio || []), temps: () => tTemps(now),
    courses: () => tCourses(s), armoire: () => tArmoire(s), loge: () => tLoge(loge, routine), boite: () => tBoite(boite),
    cours: () => tCours(), musique: () => tMusique(), devise: () => tDevise(), carte: () => cab.tCarte(e), cabinet: () => cab.tCabinet(e),
  };
  vue.innerHTML = `<section class="accueil-bento" aria-label="Accueil">
    <h1 class="sr">Accueil</h1>
    ${d.fanions ? guirlande() : ''}
    <div class="bento-tete">${['lucarne', 'ephemeride', 'horloge'].filter((id) => !caches.has(id)).map((id) => tuiles[id]()).join('')}</div>
    <div class="bento">${['meteo', 'carte', 'priorites', 'devise', 'cabinet', 'cours', 'calendrier', 'courses', 'armoire', 'temps', 'loge', 'boite', 'musique'].filter((id) => !caches.has(id)).map((id) => tuiles[id]()).join('')}</div>
    <section class="etagere-malles" aria-labelledby="t-malles"><h2 id="t-malles" class="t-section">Les malles</h2>
      <div class="malles">${malles.map((x) => carteMalle(x, comptes[x.id])).join('')}</div></section>
    <div id="installer-zone"></div>
    ${pied}
  </section>`;
  if (cabinet) cab.decorer(vue, e, d.stickers);
  brancher(vue, ctx);
  // la météo se met à jour en arrière-plan, puis on redessine ce qui en dépend
  if (meteo.lieu() && (!m || Date.now() - m.t > 30 * 60e3)) meteo.previsions().then((n) => { if (n && vue.isConnected && $('.accueil-bento', vue)) rafraichirMeteo(vue, n, agenda); });
  clearInterval(minuteur);
  minuteur = setInterval(() => {
    if (!$('.accueil-bento', vue)) return clearInterval(minuteur);
    if (!document.hidden) majLucarne(vue, new Date(), meteo.releve());
  }, 20000);
  document.onvisibilitychange = () => {
    if (document.hidden || !$('.accueil-bento', vue)) return;
    remplacer(vue, 'horloge', tHorloge(new Date())); // les aiguilles repartent à l'heure exacte
    majLucarne(vue, new Date(), meteo.releve());
  };
}
// Met l'heure et le ciel à jour sans redessiner la lucarne (la vue animée et le carillon ne sautent pas).
function majLucarne(vue, now, m) {
  const t = $('[data-w="lucarne"]', vue);
  if (!t) return;
  $('.lu-heure time', t).textContent = HEURE.format(now);
  $('.lu-salut', t).textContent = `${SALUT(now.getHours())} Louenn`;
  const c = $('.lucarne-ciel', t);
  if (c) { const { ph, svg } = ciel(now, m); const tp = document.createElement('template'); tp.innerHTML = svg.trim(); c.replaceWith(tp.content.firstElementChild); t.className = t.className.replace(/ph-\w+/, `ph-${ph}`); }
}
function remplacer(vue, id, html) {
  const el = $(`[data-w="${id}"]`, vue);
  if (!el) return;
  const t = document.createElement('template'); t.innerHTML = html.trim();
  const neuf = t.content.firstElementChild;
  // on garde le trésor et les stickers posés sur la tuile
  el.querySelectorAll(':scope > .sticker, :scope > .tresor').forEach((x) => neuf.appendChild(x));
  el.replaceWith(neuf);
}
function rafraichirMeteo(vue, m, agenda) {
  const now = new Date();
  majLucarne(vue, now, m);
  const lu = $('.lu-temps', vue), c = m?.d?.current;
  if (lu && c) lu.textContent = `${meteo.decrire(c.weather_code).mot}, ${Math.round(c.temperature_2m)}°`;
  remplacer(vue, 'meteo', tMeteo(m));
  remplacer(vue, 'ephemeride', tEphemeride(now, m, agenda.filter((e) => e.date === dateLocale(now))));
}

function brancher(vue, ctx) {
  const redessiner = () => rendreAccueil(vue, ctx);
  vue.onclick = async (e) => {
    const t = e.target;
    if (t.closest('[data-vue-suivante]')) {
      const v = decor.suivant('vue'); remplacer(vue, 'lucarne', tLucarne(new Date(), meteo.releve()));
      $('[data-vue-suivante]', vue)?.focus({ preventScroll: true }); return ctx.toast(`Vue : ${v.nom}`);
    }
    const car = t.closest('[data-carillon]');
    if (car) { car.classList.remove('tinte'); void car.offsetWidth; car.classList.add('tinte'); decor.tinter(); navigator.vibrate?.(8); return; }
    if (t.closest('[data-horloge-suivante]')) {
      const h = decor.suivant('horloge'); remplacer(vue, 'horloge', tHorloge(new Date()));
      $('[data-horloge-suivante]', vue)?.focus({ preventScroll: true }); return ctx.toast(`Horloge : ${h.nom}`);
    }
    if (t.closest('[data-carte]')) {
      const art = t.closest('.t-carte');
      if (art.classList.contains('retournee')) return;
      await cab.retournerCarte();
      art.classList.add('retournee'); decor.tintement();
      const b = $('[data-carte]', art); b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1;
      $('.carte-invite', art).hidden = true;
      const tx = $('.carte-texte', art); tx.hidden = false; tx.tabIndex = -1; setTimeout(() => tx.focus({ preventScroll: true }), 50);
      const img = $('.recto img', art); img.alt = `${$('h3', tx).textContent}, carte du tarot`;
      return;
    }
    const tr = t.closest('[data-tresor]');
    if (tr) {
      const id = tr.dataset.tresor, o = cab.objet(id);
      const st = await cab.ramasser(id);
      tr.classList.add('ramasse'); setTimeout(() => tr.remove(), 320);
      navigator.vibrate?.([10, 40, 14]);
      cab.ouvrirFiche(o, { nouveau: true, trouve: st.trouves[id] });
      if (o.type === 'sticker' && decor.lireDecor().stickers) cab.collerSticker(vue, st, id);
      const c = $('[data-w="cabinet"]', vue); if (c) remplacer(vue, 'cabinet', cab.tCabinet(st));
      return;
    }
    if (t.closest('[data-geo]')) {
      t.closest('[data-geo]').textContent = 'Je cherche…';
      try { meteo.choisirLieu(await meteo.positionActuelle()); await meteo.previsions(true); }
      catch { ctx.toast('Position refusée ou introuvable : cherche plutôt ta ville.'); }
      return redessiner();
    }
    const v = t.closest('[data-lieu]');
    if (v) { meteo.choisirLieu(JSON.parse(v.dataset.lieu)); await meteo.previsions(true); return redessiner(); }
    if (t.closest('[data-changer-ville]')) { meteo.oublierLieu(); return redessiner(); }
    const mo = t.closest('[data-mois]');
    if (mo) { calMois = new Date(calMois.getFullYear(), calMois.getMonth() + Number(mo.dataset.mois), 1); return remplacerCal(vue); }
    const j = t.closest('[data-jour]');
    if (j) { calJour = j.dataset.jour; return remplacerCal(vue); }
    const x = t.closest('[data-retirer]');
    if (x) {
      if (x.dataset.sur) { await store.supprimer(x.dataset.retirer); return remplacerCal(vue); }
      x.dataset.sur = '1'; x.textContent = 'Retirer ?'; x.classList.add('sur');
      setTimeout(() => { if (x.isConnected) { delete x.dataset.sur; x.textContent = '×'; x.classList.remove('sur'); } }, 3000);
      return;
    }
    if (t.closest('[data-prio-vider]')) {
      const l = ((await store.lireMeta('accueil.priorites').catch(() => null)) || []).filter((p) => !p.fait);
      await store.ecrireMeta('accueil.priorites', l); return remplacer(vue, 'priorites', tPriorites(l));
    }
    if (t.closest('[data-naissance-oublier]')) { localStorage.removeItem('grenier.naissance'); return remplacer(vue, 'temps', tTemps(new Date())); }
    if (t.closest('[data-musique-oublier]')) { localStorage.removeItem('grenier.musique'); return remplacer(vue, 'musique', tMusique()); }
    if (t.closest('[data-devise]')) {
      const art = t.closest('.t-devise');
      const d = lire('grenier.devise', 'Life is a journey, not a destination');
      art.innerHTML = `<form data-devise-form class="devise-form"><label for="dev" class="sr">Ta devise</label><textarea id="dev" name="d" rows="2" maxlength="140">${esc(d)}</textarea><button class="btn">Garder</button></form>`;
      $('#dev', art).focus();
    }
  };
  vue.onchange = async (e) => {
    const c = e.target.closest('[data-prio]');
    if (!c) return;
    const l = (await store.lireMeta('accueil.priorites').catch(() => null)) || [];
    const p = l.find((x) => x.id === c.dataset.prio); if (p) p.fait = c.checked;
    await store.ecrireMeta('accueil.priorites', l);
    navigator.vibrate?.(10);
    remplacer(vue, 'priorites', tPriorites(l));
  };
  vue.onsubmit = async (e) => {
    const f = e.target;
    const val = (n) => (f.elements[n]?.value || '').trim();
    if (f.matches('[data-ville]')) {
      e.preventDefault();
      const ul = $('[data-villes]', vue);
      ul.innerHTML = '<li class="petit">Je cherche…</li>';
      try {
        const r = await meteo.chercherVille(val('q'));
        ul.innerHTML = r.length ? r.map((x) => `<li><button type="button" class="btn-sobre" data-lieu='${esc(JSON.stringify(x))}'>${esc(x.nom)}<small>${esc(x.detail)}</small></button></li>`).join('') : '<li class="petit">Aucune ville trouvée.</li>';
      } catch { ul.innerHTML = '<li class="petit">Pas de connexion : réessaie plus tard.</li>'; }
    } else if (f.matches('[data-rdv]')) {
      e.preventDefault();
      if (!val('titre')) return;
      await store.ajouter({ malle: 'agenda', type: 'evenement', titre: val('titre'), heure: val('heure'), date: calJour });
      await remplacerCal(vue); $('#rdv-t', vue)?.focus();
    } else if (f.matches('[data-prio-ajout]')) {
      e.preventDefault();
      const l = (await store.lireMeta('accueil.priorites').catch(() => null)) || [];
      l.push({ id: store.nouvelId(), texte: val('t'), fait: false });
      await store.ecrireMeta('accueil.priorites', l);
      remplacer(vue, 'priorites', tPriorites(l)); $('#prio-t', vue)?.focus();
    } else if (f.matches('[data-naissance]')) {
      e.preventDefault(); ecrire('grenier.naissance', val('d')); remplacer(vue, 'temps', tTemps(new Date()));
    } else if (f.matches('[data-musique]')) {
      e.preventDefault();
      if (!spotify(val('l'))) return ctx.toast('Ce lien n’est pas un lien Spotify (playlist, album ou titre).');
      ecrire('grenier.musique', val('l')); remplacer(vue, 'musique', tMusique());
    } else if (f.matches('[data-devise-form]')) {
      e.preventDefault(); ecrire('grenier.devise', val('d') || 'Life is a journey, not a destination'); remplacer(vue, 'devise', tDevise());
    }
  };
}
async function remplacerCal(vue) {
  const agenda = await store.parMalle('agenda').catch(() => []);
  remplacer(vue, 'calendrier', tCalendrier(agenda));
  const now = new Date();
  remplacer(vue, 'ephemeride', tEphemeride(now, meteo.releve(), agenda.filter((e) => e.date === dateLocale(now))));
}
