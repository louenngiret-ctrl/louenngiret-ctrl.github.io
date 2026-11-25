// Données de référence de la Loge, issues de recherches web (25/11/2026).
// Indicatif seulement : la durée imprimée sur l'emballage (pot ouvert « 6M », « 12M »…)
// et l'avis du perceur ou du tatoueur passent toujours avant.

// Durée d'utilisation après ouverture (PAO), en mois. Sources : elle.be, consoglobe.com,
// parisselectbook.com (avis de dermatologues : mascara et eye-liner liquide 3 mois max).
export const PAO = {
  'Mascara': 3,
  'Eye-liner liquide': 3,
  'Crayon yeux ou lèvres': 12,
  'Fard à paupières poudre': 12,
  'Fond de teint, anti-cernes': 12,
  'Blush, poudre': 12,
  'Rouge à lèvres, gloss': 12,
  'Vernis à ongles': 24,
  'Crème, sérum': 12,
  'Parfum': 24,
  'Autre': 12,
};

export const CATEGORIES = {
  makeup: ['Teint', 'Yeux', 'Sourcils', 'Lèvres', 'Joues', 'Outils'],
  soin: ['Nettoyant', 'Tonique', 'Sérum', 'Crème', 'Solaire', 'Masque', 'Cheveux', 'Corps'],
  ongles: ['Vernis', 'Base et top coat', 'Inspiration'],
  coiffure: ['Inspiration', 'Essai', 'Produit'],
  tatouage: ['Idée', 'Projet', 'Fait'],
};

// Temps de cicatrisation indicatifs, en semaines [min, max]. Sources croisées : Sutter Health,
// Torbay Council, Holier Than Thou (UK), Fiat Lux SF (membre de l'APP), HealthLinkBC.
// Les fourchettes varient beaucoup selon la personne : on affiche toujours « jusqu'à ».
// x, y : position du point sur le dessin (viewBox 0 0 320 200) ; null = hors dessin.
export const ZONES = [
  { id: 'lobe', nom: 'Lobe', semaines: [6, 16], x: 74, y: 168 },
  { id: 'lobe-haut', nom: 'Lobe haut', semaines: [6, 16], x: 66, y: 150 },
  { id: 'helix', nom: 'Hélix', semaines: [16, 40], x: 92, y: 26 },
  { id: 'industriel', nom: 'Industriel', semaines: [24, 52], x: 60, y: 30 },
  { id: 'rook', nom: 'Rook', semaines: [16, 40], x: 70, y: 70 },
  { id: 'daith', nom: 'Daith', semaines: [16, 40], x: 58, y: 96 },
  { id: 'tragus', nom: 'Tragus', semaines: [16, 40], x: 34, y: 112 },
  { id: 'anti-tragus', nom: 'Anti-tragus', semaines: [16, 40], x: 56, y: 140 },
  { id: 'conque', nom: 'Conque', semaines: [16, 40], x: 72, y: 112 },
  { id: 'snug', nom: 'Snug', semaines: [24, 52], x: 88, y: 88 },
  { id: 'sourcil', nom: 'Sourcil', semaines: [6, 12], x: 236, y: 52 },
  { id: 'narine', nom: 'Narine', semaines: [12, 36], x: 252, y: 108 },
  { id: 'septum', nom: 'Septum', semaines: [6, 12], x: 230, y: 118 },
  { id: 'levre', nom: 'Lèvre, labret', semaines: [6, 12], x: 212, y: 150 },
  { id: 'langue', nom: 'Langue', semaines: [4, 6], x: 226, y: 140 },
  { id: 'nombril', nom: 'Nombril', semaines: [24, 52], x: null, y: null },
  { id: 'surface', nom: 'Surface, dermal', semaines: [24, 52], x: null, y: null },
  { id: 'autre', nom: 'Autre', semaines: [12, 52], x: null, y: null },
];

export const ZONES_TATOUAGE = ['Avant-bras', 'Bras', 'Épaule', 'Main', 'Doigts', 'Nuque', 'Dos', 'Côtes', 'Ventre', 'Hanche', 'Cuisse', 'Mollet', 'Cheville', 'Pied', 'Derrière l’oreille', 'Autre'];

export const SOURCES = [
  ['Elle Belgique, durée de vie des cosmétiques', 'https://www.elle.be/fr/4108-conseils-quand-jeter-mascara.html'],
  ['Generali, DDM et PAO', 'https://www.generali.fr/actu/conservation-produits-cosmetiques/'],
  ['Sutter Health, temps de cicatrisation', 'https://www.sutterhealth.org/health/body-piercing'],
  ['Holier Than Thou, temps de cicatrisation', 'https://www.holier-than-thou.co.uk/advice-and-guidance/piercing/piercing-healing-times/'],
  ['Fiat Lux (APP), FAQ piercing', 'https://fiatluxsf.com/pages/piercing-faqs'],
];
