// Cheveux 3D du filtre coiffure.
// Tout est en centimètres, dans l'espace « canonique » du visage MediaPipe : nez vers +z, haut vers +y.
// Une coiffure = des mèches (courbes) simulées sur un crâne en ellipsoïde, puis habillées de cartes
// texturées (comme dans les jeux vidéo), éclairées avec le modèle de Kajiya-Kay (reflets en bande).
import * as THREE from '../../vendor/three/three.min.js';
import { SOMMETS, FACES } from './visage.js';

const V = THREE.Vector3;
export const CRANE = { c: new V(0, 3.2, -4.2), r: new V(8.45, 10.9, 10.5) };

/* ---------- Coupes et teintes ---------- */
export const COUPES = [
  { id: 'carre', nom: 'Carré', longueur: 40, coupe: -12, raie: 0, volume: 0.5, gravite: 1.6, ondes: 0, frange: null, rentrer: true, densite: 1690 },
  { id: 'longs', nom: 'Longs lisses', longueur: 52, coupe: -34, raie: 0, volume: 0.7, gravite: 1.15, ondes: 0, frange: null, densite: 1950 },
  { id: 'frange', nom: 'Frange et longs', longueur: 46, coupe: -28, raie: 0, volume: 0.8, gravite: 1.1, ondes: 0, frange: 'droite', densite: 1950 },
  { id: 'rideau', nom: 'Frange rideau', longueur: 40, coupe: -22, raie: 0, volume: 1.0, gravite: 1, ondes: 0.5, frange: 'rideau', densite: 1950 },
  { id: 'ondule', nom: 'Ondulé', longueur: 42, coupe: -26, raie: 1.6, volume: 1.5, gravite: 0.9, ondes: 1.4, frange: null, densite: 1950 },
  { id: 'wolf', nom: 'Wolf cut', longueur: 30, coupe: -14, raie: 0, volume: 1.8, gravite: 0.8, ondes: 0.9, frange: 'rideau', degrade: true, densite: 1950 },
  { id: 'pixie', nom: 'Pixie', longueur: 9, coupe: 2, raie: 2.6, volume: 0.6, gravite: 0.35, ondes: 0.2, frange: 'meche', densite: 1690 },
  { id: 'boucles', nom: 'Boucles', longueur: 14, coupe: -11, raie: null, volume: 2.6, gravite: 0.35, boucles: 0.75, frange: null, densite: 2210 },
  { id: 'chignon', nom: 'Chignon', type: 'chignon', volume: 0.35, densite: 1690 },
  { id: 'macarons', nom: 'Macarons', type: 'macarons', volume: 0.35, densite: 1690 },
  { id: 'queue', nom: 'Queue de cheval', type: 'queue', volume: 0.35, densite: 1690 },
  { id: 'tresses', nom: 'Tresses', type: 'tresses', volume: 0.45, densite: 1560 },
];
export const TEINTES = [
  { id: 'noir', nom: 'Noir', racine: '#0d0a09', pointe: '#1d1714', reflet: 0.8 },
  { id: 'brun', nom: 'Brun', racine: '#1f130d', pointe: '#3b2417', reflet: 0.9 },
  { id: 'chatain', nom: 'Châtain', racine: '#3a2416', pointe: '#6e4a2c', reflet: 1 },
  { id: 'auburn', nom: 'Auburn', racine: '#3b160d', pointe: '#8a3a1c', reflet: 1 },
  { id: 'cuivre', nom: 'Cuivre', racine: '#6b2a12', pointe: '#c4652e', reflet: 1.1 },
  { id: 'blond', nom: 'Blond miel', racine: '#6b4a26', pointe: '#c9a066', reflet: 1.1 },
  { id: 'platine', nom: 'Platine', racine: '#8f8270', pointe: '#e8e0cf', reflet: 1.2 },
  { id: 'rose', nom: 'Rose poudré', racine: '#5a2f36', pointe: '#d99aa3', reflet: 1.1 },
  { id: 'mousse', nom: 'Vert mousse', racine: '#1d2614', pointe: '#5e6e3a', reflet: 1 },
  { id: 'violet', nom: 'Violet fané', racine: '#241829', pointe: '#7b5a7e', reflet: 1 },
  { id: 'nuit', nom: 'Bleu nuit', racine: '#0b1020', pointe: '#2a3a66', reflet: 1 },
];

/* ---------- Outils ---------- */
function alea(graine) {
  let s = (graine * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const lisse = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const DEG = Math.PI / 180;

// Hauteur de la ligne d'implantation (élévation en degrés sur le crâne) selon l'angle autour de la tête.
const LISERE = [[0, 30], [40, 25], [65, 14], [90, 9], [105, 0], [120, -22], [150, -36], [180, -40]];
export function lisere(phiDeg) {
  const a = Math.min(180, Math.abs(phiDeg));
  for (let i = 1; i < LISERE.length; i++) {
    const [p1, t1] = LISERE[i], [p0, t0] = LISERE[i - 1];
    if (a <= p1) { const k = lisse(0, 1, (a - p0) / (p1 - p0)); return t0 + (t1 - t0) * k; }
  }
  return -40;
}
// direction unitaire (u) -> point sur le crâne décalé de « off » cm
function surCrane(u, off, out = new V()) {
  return out.set(CRANE.c.x + (CRANE.r.x + off) * u.x, CRANE.c.y + (CRANE.r.y + off) * u.y, CRANE.c.z + (CRANE.r.z + off) * u.z);
}
function normaleCrane(p, out = new V()) {
  return out.set((p.x - CRANE.c.x) / (CRANE.r.x * CRANE.r.x), (p.y - CRANE.c.y) / (CRANE.r.y * CRANE.r.y), (p.z - CRANE.c.z) / (CRANE.r.z * CRANE.r.z)).normalize();
}
// garde le point hors du crâne (+ épaisseur)
function repousser(p, off) {
  const qx = (p.x - CRANE.c.x) / (CRANE.r.x + off), qy = (p.y - CRANE.c.y) / (CRANE.r.y + off), qz = (p.z - CRANE.c.z) / (CRANE.r.z + off);
  const s = Math.hypot(qx, qy, qz);
  if (s < 1 && s > 1e-6) p.set(CRANE.c.x + (CRANE.r.x + off) * qx / s, CRANE.c.y + (CRANE.r.y + off) * qy / s, CRANE.c.z + (CRANE.r.z + off) * qz / s);
}
// le visage reste dégagé : sous la limite, une mèche devant le visage est poussée sur le côté
function degagerVisage(p, limite, cote) {
  if (p.y > limite || p.z < -1.2) return;
  const bord = 7.4 + Math.max(0, (p.y - 2) * -0.05);
  if (Math.abs(p.x) < bord) {
    const s = Math.sign(p.x) || cote;
    p.x = s * bord;
  }
}
// frange rideau : une arche qui s'ouvre au milieu du front et s'écarte vers les pommettes
function arche(p, cote, largeurMilieu) {
  if (p.z < -1.2 || p.y > 9) return;
  const lim = Math.min(7.6, largeurMilieu + Math.max(0, 8.2 - p.y) * 1.15);
  if (Math.abs(p.x) < lim) p.x = (Math.sign(p.x) || cote) * lim;
}
// boucles : la masse reste dans une coque (pas de mèches qui s'envolent)
function contenir(p, off) {
  const qx = (p.x - CRANE.c.x) / (CRANE.r.x + off), qy = (p.y - CRANE.c.y) / (CRANE.r.y + off), qz = (p.z - CRANE.c.z) / (CRANE.r.z + off);
  const s = Math.hypot(qx, qy, qz);
  if (s > 1) p.set(CRANE.c.x + (CRANE.r.x + off) * qx / s, CRANE.c.y + (CRANE.r.y + off) * qy / s, CRANE.c.z + (CRANE.r.z + off) * qz / s);
}
// cou : un cylindre derrière lequel les mèches passent
function cou(p) {
  if (p.y > -5) return;
  const dx = p.x, dz = p.z + 3.2, r = 6;
  const d = Math.hypot(dx, dz);
  if (d < r) { const k = r / (d || 1); p.x = dx * k; p.z = -3.2 + dz * k; }
}

// racines réparties régulièrement sur le crâne, au-dessus de la ligne d'implantation
function racines(n, filtre, rnd) {
  const out = [];
  const total = Math.round(n * 2.6);
  const or = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const y = 1 - (i + 0.5) / total * 2;
    const r = Math.sqrt(1 - y * y), a = i * or + rnd() * 0.05;
    const u = new V(Math.sin(a) * r, y, Math.cos(a) * r);
    const theta = Math.asin(u.y) / DEG, phi = Math.atan2(u.x, u.z) / DEG;
    if (theta < lisere(phi) + 0.5) continue;
    if (filtre && !filtre(u, theta, phi)) continue;
    out.push({ u, theta, phi });
  }
  return out;
}
const projeterTangente = (d, n) => d.sub(n.clone().multiplyScalar(d.dot(n))).normalize();

/* ---------- Mèches qui tombent (carré, longs, frange, ondulé, boucles...) ---------- */
function mechesTombantes(st, rnd) {
  const meches = [];
  const frange = (u, theta, phi) => st.frange && Math.abs(phi) < (st.frange === 'meche' ? 50 : 38) && theta > lisere(phi) && theta < 58 && u.z > 0.2;
  const rs = racines(st.densite, null, rnd);
  for (const { u, theta, phi } of rs) {
    const estFrange = frange(u, theta, phi);
    const p = surCrane(u, 0.15);
    const n = normaleCrane(p);
    const cote = u.x - (st.raie ?? 0) / 8 >= 0 ? 1 : -1;
    let L = st.longueur * (0.9 + rnd() * 0.2);
    if (st.degrade) L *= 0.55 + 0.45 * lisse(70, 20, theta); // wolf : plus court sur le dessus
    let d;
    if (estFrange) {
      L = st.frange === 'meche' ? 15 : st.frange === 'droite' ? 11 + (60 - theta) * 0.05 : 17;
      d = projeterTangente(new V(st.frange === 'rideau' ? cote * 0.3 : st.frange === 'meche' ? 0.55 : 0.03 * cote, -0.9, 0.8), n);
    } else if (st.raie === null) {
      d = n.clone().add(new V(0, -0.25, 0)).normalize(); // boucles : la masse part vers l'extérieur
    } else {
      const avant = Math.max(0, u.z);
      d = projeterTangente(new V(cote * (0.35 + 0.6 * avant), -0.9, -0.8 * avant - 0.1), n);
    }
    const K = Math.max(8, Math.round(L / 2.2)), pas = L / K;
    const pts = [p.clone()];
    // gonflant : plus de volume sur le dessus, pour couvrir les vrais cheveux
    const gonflant = 0.5 + 1.1 * lisse(-10, 60, theta);
    const off = st.volume * (0.6 + rnd() * 0.5) + gonflant;
    // paquets : des mèches voisines partagent la même petite dérive
    const paquet = Math.floor((phi + 180) / 7) * 31 + Math.floor((theta + 90) / 9) * 17;
    const derive = new V(Math.sin(paquet * 1.7) * 0.07, 0, Math.cos(paquet * 2.3) * 0.07);
    for (let i = 1; i <= K; i++) {
      const t = i / K;
      d.y -= st.gravite * (0.22 + 0.6 * t) * (estFrange ? 0.9 : 1);
      if (st.raie === null) d.add(normaleCrane(p).multiplyScalar(0.25 * (1 - t)));
      if (st.rentrer) d.x -= Math.sign(p.x) * (p.y < 2 ? 0.22 : 0.05);
      d.addScaledVector(derive, t);
      d.normalize();
      p.addScaledVector(d, pas);
      const epais = (estFrange ? off * 0.45 : off) * (0.45 + 0.55 * Math.min(1, t * 3));
      const avantP = p.clone();
      repousser(p, epais);
      if (avantP.distanceToSquared(p) > 1e-6) projeterTangente(d, normaleCrane(p)); // glisse sur le crâne
      if (!estFrange) degagerVisage(p, st.frange ? 8.6 : 8.8, cote);
      else if (st.frange === 'rideau') arche(p, cote, 0.9);
      else if (st.frange === 'meche') arche(p, cote, -3.5 * cote + 0.5);
      if (st.boucles) contenir(p, st.volume + 1.8);
      cou(p);
      if (p.y < st.coupe + rnd() * 0.8 && !estFrange) break;
      if (estFrange && st.frange === 'droite' && p.y < 4.2 + rnd() * 0.6) break;
      pts.push(p.clone());
    }
    if (pts.length < 3) continue;
    onduler(pts, (st.ondes || 0.22) * (0.8 + rnd() * 0.4), 7 + rnd() * 3, (paquet % 7) + rnd() * 0.6);
    if (st.boucles) boucler(pts, st.boucles, 2.2 + rnd() * 0.6, rnd() * 6.28);
    meches.push({ pts, largeur: estFrange ? 1.1 : 1.7, frange: estFrange });
  }
  return meches;
}

function repere(pts, i) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const T = b.clone().sub(a).normalize();
  const N = normaleCrane(pts[i]);
  const B = new V().crossVectors(T, N);
  if (B.lengthSq() < 1e-6) B.set(1, 0, 0);
  B.normalize();
  N.crossVectors(B, T).normalize();
  return { T, N, B };
}
function onduler(pts, amp, lambda, phase) {
  let s = 0;
  const dec = pts.map((p, i) => {
    if (i) s += p.distanceTo(pts[i - 1]);
    const { B } = repere(pts, i);
    return B.multiplyScalar(amp * lisse(2, 10, s) * Math.sin(s / lambda * 6.283 + phase));
  });
  pts.forEach((p, i) => p.add(dec[i]));
}
function boucler(pts, rayon, periode, phase) {
  let s = 0;
  const dec = pts.map((p, i) => {
    if (i) s += p.distanceTo(pts[i - 1]);
    const { N, B } = repere(pts, i);
    const a = s / periode * 6.283 + phase, r = rayon * lisse(0, 4, s);
    return B.multiplyScalar(Math.cos(a) * r).add(N.multiplyScalar(Math.sin(a) * r * 0.8));
  });
  pts.forEach((p, i) => p.add(dec[i]));
}
// densifie une courbe pour les boucles (sinon la spirale est anguleuse)
function subdiviser(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < n; k++) out.push(pts[i].clone().lerp(pts[i + 1], k / n));
  out.push(pts[pts.length - 1].clone());
  return out;
}

/* ---------- Cheveux tirés vers un point (chignon, macarons, queue) ---------- */
function mechesTirees(st, rnd, cibles) {
  const meches = [];
  for (const { u } of racines(st.densite, null, rnd)) {
    const p = surCrane(u, 0.12);
    const cible = cibles.length === 1 ? cibles[0] : cibles[u.x < 0 ? 0 : 1];
    const pts = [p.clone()];
    for (let i = 0; i < 40; i++) {
      const n = normaleCrane(p);
      const d = projeterTangente(cible.clone().sub(p), n);
      const reste = p.distanceTo(cible);
      if (reste < 2.2) break;
      p.addScaledVector(d, Math.min(1.6, reste * 0.5));
      repousser(p, st.volume * (0.5 + rnd() * 0.5));
      pts.push(p.clone());
    }
    if (pts.length > 2) meches.push({ pts, largeur: 1.1, tire: true });
  }
  return meches;
}
// pelote : des mèches enroulées autour d'une boule
function pelote(centre, rayon, n, rnd) {
  const meches = [];
  for (let k = 0; k < n; k++) {
    const axe = new V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const ref = Math.abs(axe.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
    const e1 = new V().crossVectors(axe, ref).normalize(), e2 = new V().crossVectors(axe, e1);
    const r = rayon * (0.75 + rnd() * 0.3), a0 = rnd() * 6.28, tours = 0.7 + rnd() * 0.5;
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = a0 + i / 18 * tours * 6.283;
      pts.push(centre.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r));
    }
    meches.push({ pts, largeur: 1.3, pelote: true });
  }
  return meches;
}
function queue(depart, longueur, n, rnd) {
  const meches = [];
  for (let k = 0; k < n; k++) {
    const a = rnd() * 6.28, r = rnd() * 1.4;
    const p = depart.clone().add(new V(Math.cos(a) * r, Math.sin(a) * r * 0.6, 0));
    const d = new V((rnd() - 0.5) * 0.3, -0.2, -1).normalize();
    const L = longueur * (0.8 + rnd() * 0.25), K = 16, pas = L / K;
    const pts = [p.clone()];
    for (let i = 1; i <= K; i++) {
      d.y -= 0.16; d.x += Math.cos(a) * 0.02; d.normalize();
      p.addScaledVector(d, pas); repousser(p, 1.2); cou(p);
      pts.push(p.clone());
    }
    onduler(pts, 0.6, 9, rnd() * 6);
    meches.push({ pts, largeur: 1.2 });
  }
  return meches;
}
function tresse(depart, longueur, cote, rnd) {
  const meches = [];
  const chemin = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    chemin.push(new V(depart.x + cote * (1.2 * t), depart.y - longueur * t, depart.z + 3.5 * Math.sin(t * 1.4) + 1.5 * t));
  }
  for (let brin = 0; brin < 3; brin++) {
    for (let k = 0; k < 16; k++) {
      const j = new V((rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7);
      const pts = chemin.map((c, i) => {
        const s = i / 40 * longueur, w = 1.3 * (1 - 0.35 * i / 40), om = s / 3.6 * 6.283 + brin * 2.094;
        return c.clone().add(new V(Math.sin(om) * w * cote, 0, Math.sin(2 * om) * w * 0.45)).add(j);
      });
      meches.push({ pts, largeur: 1.5 });
    }
  }
  // petite houppe sous l'élastique
  const bout = chemin[40];
  for (let k = 0; k < 14; k++) {
    const d = new V((rnd() - 0.5) * 0.8, -1, (rnd() - 0.5) * 0.8).normalize();
    const pts = []; for (let i = 0; i <= 5; i++) pts.push(bout.clone().addScaledVector(d, i * 0.9));
    meches.push({ pts, largeur: 0.8 });
  }
  return meches;
}

export function genererMeches(st, graine = 7) {
  const rnd = alea(graine + st.id.length * 131);
  if (st.type === 'chignon') {
    const c = new V(0, 14.2, -6.5);
    return [...mechesTirees(st, rnd, [c]), ...pelote(new V(0, 16.6, -7.2), 3.6, 300, rnd)];
  }
  if (st.type === 'macarons') {
    const g = new V(-5.6, 11.8, -3.6), d = new V(5.6, 11.8, -3.6);
    return [...mechesTirees(st, rnd, [g, d]), ...pelote(new V(-7.2, 13.4, -3.8), 2.7, 170, rnd), ...pelote(new V(7.2, 13.4, -3.8), 2.7, 170, rnd)];
  }
  if (st.type === 'queue') {
    const c = new V(0, 9.5, -13.6);
    return [...mechesTirees(st, rnd, [c]), ...queue(new V(0, 9.5, -14.8), 34, 220, rnd)];
  }
  if (st.type === 'tresses') {
    const tire = mechesTirees(st, rnd, [new V(-7.4, -1.5, -5.5), new V(7.4, -1.5, -5.5)]);
    return [...tire, ...tresse(new V(-8.4, -3, -3.5), 30, -1, rnd), ...tresse(new V(8.4, -3, -3.5), 30, 1, rnd)];
  }
  const m = mechesTombantes(st, rnd);
  if (st.boucles) m.forEach((x) => { x.pts = subdiviser(x.pts, 3); boucler(x.pts, 0.25, 1.0, rnd() * 6); x.largeur = 1.0; });
  return m;
}

/* ---------- Géométrie : une carte (ruban) par mèche ---------- */
export function geometrieMeches(meches, graine = 3) {
  const rnd = alea(graine);
  let nv = 0, ni = 0;
  for (const m of meches) { nv += m.pts.length * 2; ni += (m.pts.length - 1) * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), tan = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2), att = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let v = 0, k = 0;
  const g = new V(), cote = new V();
  for (const m of meches) {
    const n = m.pts.length, graineM = rnd(), col = Math.floor(rnd() * 4), incl = (rnd() - 0.5) * 0.9;
    let longueur = 0;
    for (let i = 1; i < n; i++) longueur += m.pts[i].distanceTo(m.pts[i - 1]);
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i) s += m.pts[i].distanceTo(m.pts[i - 1]);
      const t = longueur ? s / longueur : 0;
      const { T, N, B } = repere(m.pts, i);
      cote.copy(B).multiplyScalar(Math.cos(incl)).addScaledVector(N, Math.sin(incl)).normalize();
      const w = m.largeur * (1 - 0.5 * t * t) * 0.5;
      for (let c = -1; c <= 1; c += 2) {
        g.copy(m.pts[i]).addScaledVector(cote, c * w);
        pos.set([g.x, g.y, g.z], v * 3); nor.set([N.x, N.y, N.z], v * 3); tan.set([T.x, T.y, T.z], v * 3);
        uv.set([c < 0 ? 0 : 1, t], v * 2); att.set([graineM, col], v * 2);
        v++;
      }
      if (i < n - 1) { const a = v - 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k); k += 6; }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('tangente', new THREE.BufferAttribute(tan, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('graine', new THREE.BufferAttribute(att, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/* ---------- Texture des mèches, dessinée au lancement (4 variantes côte à côte) ---------- */
let motifCache = null;
function motif() {
  if (motifCache) return motifCache;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const rnd = alea(42);
  for (let col = 0; col < 4; col++) {
    for (let k = 0; k < 70; k++) {
      const bord = rnd();
      const x0 = col * 128 + 8 + (bord * bord * (3 - 2 * bord)) * 112;
      const lg = 512 * (0.78 + rnd() * 0.22), larg = 0.9 + rnd() * 1.8, clair = Math.floor(120 + rnd() * 135);
      const derive = (rnd() - 0.5) * 10, freq = 1 + rnd() * 2, ph = rnd() * 6.28;
      for (let y = 0; y < lg; y += 6) {
        const t = y / lg, a = (0.55 + rnd() * 0.1) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
        x.strokeStyle = `rgba(${clair},${clair},${clair},${a.toFixed(3)})`;
        x.lineWidth = larg * (1 - 0.6 * t);
        const xa = x0 + derive * t + Math.sin(t * freq * 6.28 + ph) * 1.5;
        const xb = x0 + derive * (t + 6 / lg) + Math.sin((t + 6 / lg) * freq * 6.28 + ph) * 1.5;
        x.beginPath(); x.moveTo(xa, y); x.lineTo(xb, y + 6.5); x.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.flipY = false;
  motifCache = tex;
  return tex;
}

const VERT = /* glsl */`
attribute vec3 tangente;
attribute vec2 graine;
varying vec2 vUv; varying vec3 vT; varying vec3 vN; varying vec3 vVue; varying vec2 vG;
void main() {
  vUv = uv; vG = graine;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vVue = -mv.xyz;
  vT = normalize(normalMatrix * tangente);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform sampler2D motif;
uniform vec3 cRacine; uniform vec3 cPointe; uniform vec3 cLumiere; uniform vec3 cAmbiance; uniform vec3 dirLumiere;
uniform float brillance; uniform float opacite;
varying vec2 vUv; varying vec3 vT; varying vec3 vN; varying vec3 vVue; varying vec2 vG;
void main() {
  vec4 tx = texture2D(motif, vec2((vG.y + clamp(vUv.x, 0.02, 0.98)) * 0.25, vUv.y));
  float a = tx.a * opacite;
  if (a < 0.26) discard;
  vec3 T = normalize(vT), N = normalize(vN), V = normalize(vVue), L = normalize(dirLumiere);
  if (dot(N, V) < 0.0) N = -N;
  vec3 H = normalize(L + V);
  float t = vUv.y;
  vec3 base = mix(cRacine, cPointe, smoothstep(0.0, 0.75, t));
  base *= mix(0.7, 1.2, tx.r) * mix(0.88, 1.12, vG.x);
  float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  float ao = mix(0.5, 1.0, smoothstep(0.0, 0.35, t));
  vec3 T1 = normalize(T + N * (-0.1 + (tx.r - 0.5) * 0.5));
  vec3 T2 = normalize(T + N * 0.15);
  float c1 = dot(T1, H), c2 = dot(T2, H);
  float s1 = pow(sqrt(max(0.0, 1.0 - c1 * c1)), 90.0);
  float s2 = pow(sqrt(max(0.0, 1.0 - c2 * c2)), 22.0);
  vec3 col = base * (cAmbiance + cLumiere * diff) * ao;
  float face = pow(clamp(dot(N, H), 0.0, 1.0), 3.0);
  col += (mix(cLumiere, base * 2.0, 0.5) * s1 * 0.07 + base * cLumiere * s2 * 0.35) * face * brillance;
  col *= mix(0.78, 1.0, vG.x);
  gl_FragColor = vec4(col, smoothstep(0.26, 0.5, a));
  #include <colorspace_fragment>
}`;
// calotte : une couche de cheveux serrés sous les mèches, pour que le crâne ne se voie jamais
const FRAG_CALOTTE = /* glsl */`
uniform vec3 cRacine; uniform vec3 cLumiere; uniform vec3 cAmbiance; uniform vec3 dirLumiere;
uniform vec3 centre; uniform vec3 rayons;
varying vec3 vP; varying vec3 vN; varying vec3 vO;
float lisere(float a) {
  a = min(180.0, abs(a));
  if (a < 40.0) return mix(30.0, 25.0, smoothstep(0.0, 40.0, a));
  if (a < 65.0) return mix(25.0, 14.0, smoothstep(40.0, 65.0, a));
  if (a < 90.0) return mix(14.0, 9.0, smoothstep(65.0, 90.0, a));
  if (a < 105.0) return mix(9.0, 0.0, smoothstep(90.0, 105.0, a));
  if (a < 120.0) return mix(0.0, -22.0, smoothstep(105.0, 120.0, a));
  if (a < 150.0) return mix(-22.0, -36.0, smoothstep(120.0, 150.0, a));
  return mix(-36.0, -40.0, smoothstep(150.0, 180.0, a));
}
void main() {
  vec3 u = normalize(vO);
  float theta = degrees(asin(u.y)), phi = degrees(atan(u.x, u.z));
  float bord = theta - lisere(phi);
  float stries = 0.5 + 0.5 * sin(phi * 9.0 + theta * 0.7 + sin(theta * 0.4) * 3.0);
  float a = smoothstep(-1.5, 4.5, bord) * (0.7 + 0.3 * stries);
  if (a < 0.45) discard;
  vec3 N = normalize(vN), L = normalize(dirLumiere);
  vec3 col = cRacine * (0.8 + 0.2 * stries) * (cAmbiance + cLumiere * clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0)) * 0.85;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const VERT_CALOTTE = /* glsl */`
varying vec3 vP; varying vec3 vN; varying vec3 vO;
void main() { vO = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;

/* ---------- La perruque : occulteurs + calotte + mèches ---------- */
export class Perruque {
  constructor() {
    this.groupe = new THREE.Group();
    this.groupe.matrixAutoUpdate = false;
    this.uniformes = {
      motif: { value: motif() },
      cRacine: { value: new THREE.Color() }, cPointe: { value: new THREE.Color() },
      cLumiere: { value: new THREE.Color(1, 0.97, 0.92) }, cAmbiance: { value: new THREE.Color(0.32, 0.3, 0.3) },
      dirLumiere: { value: new V(0.35, 0.75, 0.6).normalize() },
      brillance: { value: 1 }, opacite: { value: 1 },
      centre: { value: CRANE.c.clone() }, rayons: { value: CRANE.r.clone().addScalar(0.15) },
    };
    // occulteurs : visage, arrière du crâne, cou (invisibles, ils cachent ce qui passe derrière)
    const masque = new THREE.MeshBasicMaterial({ colorWrite: false });
    const gVisage = new THREE.BufferGeometry();
    gVisage.setAttribute('position', new THREE.BufferAttribute(SOMMETS, 3));
    gVisage.setIndex(new THREE.BufferAttribute(FACES, 1));
    const visage = new THREE.Mesh(gVisage, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
    const crane = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), masque);
    crane.scale.copy(CRANE.r).multiplyScalar(0.985); crane.position.copy(CRANE.c);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.2, 26, 24, 1, true), masque);
    cyl.position.set(0, -15, -3.2);
    for (const o of [visage, crane, cyl]) { o.renderOrder = 0; this.groupe.add(o); }
    this.occulteurs = [visage, crane, cyl];
    // calotte
    const matCal = new THREE.ShaderMaterial({ uniforms: this.uniformes, vertexShader: VERT_CALOTTE, fragmentShader: FRAG_CALOTTE });
    this.calotte = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), matCal);
    this.calotte.scale.copy(CRANE.r).addScalar(0.15); this.calotte.position.copy(CRANE.c);
    this.calotte.renderOrder = 1;
    // les cheveux sont dans un sous-groupe qu'on peut agrandir ou monter un peu (réglages « Taille » et « Hauteur »)
    this.cheveux = new THREE.Group();
    this.cheveux.add(this.calotte);
    this.groupe.add(this.cheveux);
    this.matMeches = new THREE.ShaderMaterial({ uniforms: this.uniformes, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, alphaToCoverage: true, transparent: false });
    this.meches = null;
    this.cache = new Map();
  }
  changerCoupe(id) {
    const st = COUPES.find((c) => c.id === id) || COUPES[0];
    let geo = this.cache.get(st.id);
    if (!geo) { geo = geometrieMeches(genererMeches(st)); this.cache.set(st.id, geo); }
    if (this.meches) this.cheveux.remove(this.meches);
    this.meches = new THREE.Mesh(geo, this.matMeches);
    this.meches.renderOrder = 2;
    this.meches.frustumCulled = false;
    this.cheveux.add(this.meches);
    this.coupe = st;
  }
  changerTeinte(t) {
    this.uniformes.cRacine.value.set(t.racine);
    this.uniformes.cPointe.value.set(t.pointe);
    this.uniformes.brillance.value = t.reflet;
    this.teinte = t;
  }
  // lumière de la pièce estimée sur l'image de la caméra (moyenne r, g, b entre 0 et 1)
  eclairer(r, g, b) {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const k = 0.55 + lum * 1.1;
    this.uniformes.cLumiere.value.setRGB(Math.min(1.4, k * (0.8 + r * 0.4)), Math.min(1.4, k * (0.8 + g * 0.4)), Math.min(1.4, k * (0.8 + b * 0.4)));
    this.uniformes.cAmbiance.value.setRGB(0.15 + r * 0.4, 0.15 + g * 0.4, 0.15 + b * 0.4);
  }
  regler(taille = 1, hauteur = 0) {
    this.cheveux.scale.setScalar(taille);
    this.cheveux.position.copy(CRANE.c).multiplyScalar(1 - taille).add(new V(0, hauteur, 0));
  }
  set visible(v) { this.groupe.visible = v; }
}

// Lisse la pose du visage d'une image à l'autre (moins de tremblements, sans retard quand on bouge vite).
export class Lisseur {
  constructor() { this.p = new V(); this.q = new THREE.Quaternion(); this.s = new V(1, 1, 1); this.pret = false; this.m = new THREE.Matrix4(); }
  pousser(donnees) {
    const m = new THREE.Matrix4().fromArray(donnees);
    const p = new V(), q = new THREE.Quaternion(), s = new V();
    m.decompose(p, q, s);
    if (!this.pret) { this.p.copy(p); this.q.copy(q); this.s.copy(s); this.pret = true; }
    else {
      const vitesse = p.distanceTo(this.p);
      const a = Math.min(1, 0.35 + vitesse * 0.25);
      this.p.lerp(p, a); this.q.slerp(q, Math.min(1, a + 0.1)); this.s.lerp(s, 0.2);
    }
    return this.m.compose(this.p, this.q, this.s);
  }
  oublier() { this.pret = false; }
}
