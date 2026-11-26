// Le décor du Grenier : un seul réglage, appliqué à toutes les pages (accueil, malles, Loge, Cours).
// Gardé sur l'appareil (localStorage « grenier.decor »). Les images vivent dans assets/deco/.

const CLE = 'grenier.decor';
export const DECO = new URL('../assets/deco/', import.meta.url).href;

export const DEFAUT = {
  univers: 'grenier', cadre: 'arche', vue: 'ciel', lierre: true, carillon: true, fanions: true,
  horloge: 'laiton', calendrier: 'mural', ephemeride: 'bloc', attache: 'washi', stickers: true, sons: true,
};

// sombre : true force l'ambiance nuit, false l'ambiance claire, null laisse choisir (Réglages)
export const UNIVERS = [
  { id: 'grenier', nom: 'Le grenier', desc: 'Liège, kraft ou nuit, selon l’ambiance', sombre: null },
  { id: 'foret', nom: 'Forêt dorée', desc: 'Lierre, racines et bijoux d’or', sombre: true },
  { id: 'grunge', nom: 'Grunge', desc: 'Collage sombre, ailes et fleurs à yeux', sombre: true },
  { id: 'patchwork', nom: 'Patchwork', desc: 'Des rubans de washi cousus ensemble', sombre: false },
  { id: 'reverie', nom: 'Rêverie', desc: 'Papier lilas, étoiles et papillons', sombre: false },
];
export const CADRES = [
  { id: 'arche', nom: 'L’arche en plâtre' }, { id: 'hublot', nom: 'Le hublot en laiton' },
  { id: 'vitrail', nom: 'Le vitrail' }, { id: 'croisee', nom: 'La croisée à volets' },
];
export const VUES = [
  { id: 'ciel', nom: 'Le vrai ciel', desc: 'Il suit l’heure, le soleil, la lune et la météo' },
  { id: 'etoiles', nom: 'La pluie d’étoiles' }, { id: 'lune', nom: 'La lune et les lucioles' },
  { id: 'tourbillon', nom: 'Le tourbillon' }, { id: 'phalene', nom: 'La phalène', credit: 'Animation de Jana Heidersdorf' },
  { id: 'cactus', nom: 'Le cactus en fleur' },
];
export const HORLOGES = [
  { id: 'laiton', nom: 'Laiton' }, { id: 'engrenages', nom: 'Engrenages' }, { id: 'bistrot', nom: 'Bistrot' },
  { id: 'squelette', nom: 'Squelette' }, { id: 'atelier', nom: 'Atelier' }, { id: 'gare', nom: 'Gare' }, { id: 'chateau', nom: 'Château' },
];
export const CALENDRIERS = [{ id: 'mural', nom: 'Mural ligné' }, { id: 'vitrail', nom: 'Vitrail' }, { id: 'etiquette', nom: 'Grande étiquette' }];
export const EPHEMERIDES = [{ id: 'bloc', nom: 'Bloc à reliure rouge' }, { id: 'ticket', nom: 'Ticket ancien' }];
export const ATTACHES = [{ id: 'washi', nom: 'Washi' }, { id: 'pinces', nom: 'Pinces' }, { id: 'scotch', nom: 'Scotch' }, { id: 'punaises', nom: 'Punaises' }];

const LISTES = { univers: UNIVERS, cadre: CADRES, vue: VUES, horloge: HORLOGES, calendrier: CALENDRIERS, ephemeride: EPHEMERIDES, attache: ATTACHES };

export function lireDecor() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { d = {}; }
  const r = { ...DEFAUT, ...d };
  for (const [k, l] of Object.entries(LISTES)) if (!l.some((x) => x.id === r[k])) r[k] = DEFAUT[k];
  return r;
}
export function ecrireDecor(patch) {
  const d = { ...lireDecor(), ...patch };
  try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* plein */ }
  appliquerDecor();
  return d;
}
export function remettreDecor() { try { localStorage.removeItem(CLE); } catch (e) { /* rien */ } appliquerDecor(); }
/** L'option suivante d'une liste (pour changer d'un appui). */
export function suivant(cle) {
  const l = LISTES[cle], d = lireDecor();
  const x = l[(l.findIndex((o) => o.id === d[cle]) + 1) % l.length];
  ecrireDecor({ [cle]: x.id });
  return x;
}
export const nomDe = (cle, id) => (LISTES[cle].find((o) => o.id === id) || {}).nom || id;

/* ---------- Ambiance : celle des Réglages, sauf si l'univers impose le jour ou la nuit ---------- */
export function ambianceReelle() {
  const u = UNIVERS.find((x) => x.id === lireDecor().univers);
  if (u && u.sombre === true) return 'nuit';
  if (u && u.sombre === false) return 'liege';
  let a = 'auto';
  try { a = localStorage.getItem('grenier.ambiance') || 'auto'; } catch (e) { /* rien */ }
  const h = new Date().getHours();
  return a === 'auto' ? (h >= 20 || h < 7 ? 'nuit' : 'liege') : a;
}

export function appliquerDecor() {
  const d = lireDecor(), html = document.documentElement;
  html.dataset.univers = d.univers;
  html.dataset.attache = d.attache;
  html.dataset.stickers = d.stickers ? '1' : '0';
  html.style.setProperty('--deco', `url("${DECO}")`);
  const amb = ambianceReelle();
  html.dataset.amb = amb;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = { liege: '#3a2618', kraft: '#4a3622', nuit: '#14110f' }[amb] || '#3a2618';
  habiller();
  return d;
}

/* ---------- Attaches : chaque bout de scotch reçoit son washi ou sa pince, toujours la même ---------- */
const NB_WASHI = 14, NB_PINCES = 14;
function graine(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function habiller(racine = document) {
  racine.querySelectorAll?.('.scotch:not([data-h])').forEach((el, i) => {
    const cle = (el.dataset.cle || el.parentElement?.textContent || '').trim().slice(0, 40) + i;
    const g = graine(cle);
    el.style.setProperty('--washi', `url("${DECO}washi/w${g % NB_WASHI}.webp")`);
    el.style.setProperty('--pince', `url("${DECO}pinces/p${(g >>> 4) % NB_PINCES}.webp")`);
    el.style.setProperty('--wx', `${(g >>> 8) % 200}px`);
    el.style.setProperty('--wr', `${((g >>> 12) % 9) - 4}deg`);
    el.dataset.h = '1';
  });
}
let observe = false;
export function brancherDecor() {
  appliquerDecor();
  if (observe || !('MutationObserver' in window)) return;
  observe = true;
  let prevu = 0;
  new MutationObserver(() => { if (!prevu) prevu = requestAnimationFrame(() => { prevu = 0; habiller(); }); })
    .observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', (e) => { if (e.key === CLE || e.key === 'grenier.ambiance') appliquerDecor(); });
}

/* ---------- Sons : des clochettes synthétisées, seulement après un geste ---------- */
let audio = null;
function ctx() {
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  audio ||= new A();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}
function cloche(c, f, t, fort = 0.18) {
  const sortie = c.createGain();
  sortie.gain.setValueAtTime(0, t);
  sortie.gain.linearRampToValueAtTime(fort, t + 0.005);
  sortie.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);
  sortie.connect(c.destination);
  // partiels inharmoniques d'une petite cloche de laiton
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([k, v]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f * k; g.gain.value = v;
    o.connect(g); g.connect(sortie); o.start(t); o.stop(t + 2.7);
  });
}
export function tinter(n = 4) {
  if (!lireDecor().sons) return;
  const c = ctx(); if (!c) return;
  const notes = [659.3, 784, 880, 987.8, 1174.7, 1318.5]; // gamme pentatonique
  let t = c.currentTime + 0.02;
  for (let i = 0; i < n; i++) { cloche(c, notes[Math.floor(Math.random() * notes.length)], t, 0.12 + Math.random() * 0.06); t += 0.09 + Math.random() * 0.22; }
}
export function tintement() {
  if (!lireDecor().sons) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime + 0.02;
  cloche(c, 1318.5, t, 0.12); cloche(c, 1975.5, t + 0.12, 0.08);
}
