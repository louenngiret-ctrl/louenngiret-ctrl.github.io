// Petits outils partagés par les malles (Loge, Cours…).

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// Photo réduite (1600 px de côté par défaut) en JPEG ; si quelque chose échoue, on garde l'originale.
export async function compresserPhoto(fichier, cote = 1600, type = 'image/jpeg') {
  try {
    const img = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const k = Math.min(1, cote / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    const b = await new Promise((r) => c.toBlob(r, type, 0.85));
    return b && (b.size < fichier.size || type === 'image/png') ? b : fichier;
  } catch (e) { return fichier; }
}

// Adresses temporaires pour afficher des photos stockées en Blob, libérées en bloc.
const urls = [];
export function urlPhoto(blob) { const u = URL.createObjectURL(blob); urls.push(u); return u; }
export function libererPhotos() { while (urls.length) URL.revokeObjectURL(urls.pop()); }

// Ambiance choisie dans le Grenier (même réglage partout).
export function appliquerAmbiance() {
  let a = 'auto';
  try { a = localStorage.getItem('grenier.ambiance') || 'auto'; } catch (e) { /* rien */ }
  const h = new Date().getHours();
  document.documentElement.dataset.amb = a === 'auto' ? (h >= 20 || h < 7 ? 'nuit' : 'liege') : a;
}

export const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const aujourdhui = () => new Date().toISOString().slice(0, 10);
