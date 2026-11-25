// Météo de l'Accueil : Open-Meteo (gratuit, sans clé, données CC BY 4.0, https://open-meteo.com).
// Seules les coordonnées du lieu choisi partent vers Open-Meteo. Le dernier relevé reste sur l'appareil.
const CLE_LIEU = 'grenier.meteo.lieu';
const CLE_CACHE = 'grenier.meteo.cache';
const FRAICHEUR = 30 * 60 * 1000;

export function lieu() { try { return JSON.parse(localStorage.getItem(CLE_LIEU) || 'null'); } catch { return null; } }
export function choisirLieu(l) { localStorage.setItem(CLE_LIEU, JSON.stringify(l)); localStorage.removeItem(CLE_CACHE); }
export function oublierLieu() { localStorage.removeItem(CLE_LIEU); localStorage.removeItem(CLE_CACHE); }
export function releve() { try { return JSON.parse(localStorage.getItem(CLE_CACHE) || 'null'); } catch { return null; } }

export async function chercherVille(nom) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nom)}&count=6&language=fr&format=json`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('recherche');
  const j = await r.json();
  return (j.results || []).map((x) => ({ nom: x.name, detail: [x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }));
}

export function positionActuelle() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error('geo'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ nom: 'Ma position', detail: '', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
      ko, { maximumAge: 3600e3, timeout: 12000 });
  });
}

// Renvoie le relevé en cache s'il est frais, sinon interroge Open-Meteo (et garde l'ancien si le réseau manque).
export async function previsions(forcer = false) {
  const l = lieu();
  if (!l) return null;
  const c = releve();
  if (c && !forcer && Date.now() - c.t < FRAICHEUR && c.lat === l.lat && c.lon === l.lon) return c;
  const p = new URLSearchParams({
    latitude: l.lat, longitude: l.lon, timezone: 'auto', forecast_days: '6',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
  });
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
    if (!r.ok) throw new Error('meteo');
    const d = await r.json();
    const v = { t: Date.now(), lat: l.lat, lon: l.lon, nom: l.nom, d };
    localStorage.setItem(CLE_CACHE, JSON.stringify(v));
    return v;
  } catch (e) {
    return c ? { ...c, ancien: true } : null;
  }
}

/* ---------- Codes météo de l'OMS (WMO) ---------- */
// ciel : clair | voile | nuages | couvert | brume | pluie | neige | orage
export function decrire(code) {
  if (code === 0) return { mot: 'Ciel dégagé', ciel: 'clair' };
  if (code === 1) return { mot: 'Plutôt dégagé', ciel: 'voile' };
  if (code === 2) return { mot: 'Éclaircies', ciel: 'nuages' };
  if (code === 3) return { mot: 'Couvert', ciel: 'couvert' };
  if (code === 45 || code === 48) return { mot: 'Brouillard', ciel: 'brume' };
  if (code >= 51 && code <= 57) return { mot: 'Bruine', ciel: 'pluie' };
  if (code >= 61 && code <= 67) return { mot: code >= 65 ? 'Forte pluie' : 'Pluie', ciel: 'pluie' };
  if (code >= 71 && code <= 77) return { mot: 'Neige', ciel: 'neige' };
  if (code >= 80 && code <= 82) return { mot: 'Averses', ciel: 'pluie' };
  if (code === 85 || code === 86) return { mot: 'Averses de neige', ciel: 'neige' };
  if (code >= 95) return { mot: 'Orage', ciel: 'orage' };
  return { mot: 'Temps variable', ciel: 'nuages' };
}

// Pictogrammes dessinés (un trait, mêmes épaisseurs partout)
const SOLEIL = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>';
const LUNE = '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.8A7 7 0 0 1 15.5 3.5z"/>';
const NUAGE = '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 18.5z"/>';
export function picto(code, jour = true) {
  const { ciel } = decrire(code);
  const astre = jour ? SOLEIL : LUNE;
  let corps;
  if (ciel === 'clair') corps = astre;
  else if (ciel === 'voile' || ciel === 'nuages') corps = `<g transform="translate(-3 -4) scale(.7)">${astre}</g><g transform="translate(2 2) scale(.85)">${NUAGE}</g>`;
  else if (ciel === 'couvert') corps = NUAGE;
  else if (ciel === 'brume') corps = '<path d="M3 9h18M5 13h14M3 17h18"/>';
  else if (ciel === 'pluie') corps = `<g transform="translate(0 -3)">${NUAGE}</g><path d="M8 18.5l-1.2 3M12 18.5l-1.2 3M16 18.5l-1.2 3"/>`;
  else if (ciel === 'neige') corps = `<g transform="translate(0 -3)">${NUAGE}</g><path d="M8 19.5h.01M12 21h.01M16 19.5h.01"/>`;
  else corps = `<g transform="translate(0 -3)">${NUAGE}</g><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>`;
  return `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true">${corps}</svg>`;
}
