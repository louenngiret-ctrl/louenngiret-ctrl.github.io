// Registre des malles du Grenier.
// Pour ajouter une malle : une entrée ici + un dossier malles/<id>/ (voir la Bible, « Contrat de malle »).
// etat : 'ouverte' (utilisable), 'demenagement' (arrive bientôt depuis Carnet), 'vide' (place libre).

export const MALLES = [
  {
    id: 'achats',
    nom: 'Achats et courses',
    sous: 'listes, panier, envies',
    bois: '#8c4f2e',
    etiquette: '#e8cfa0',
    etat: 'demenagement',
    message: "Ta liste d'achats, ton panier du jour et tes envies arrivent ici à la prochaine version, avec tout ce que contient Carnet.",
  },
  {
    id: 'garde-robe',
    nom: 'Garde-robe',
    sous: 'armoire, tenues, atelier',
    bois: '#5d4a3b',
    etiquette: '#d9c8d8',
    etat: 'demenagement',
    message: "L'armoire, l'atelier et tes tenues arrivent ici à la prochaine version, avec tes photos de Carnet.",
  },
  {
    id: 'boite',
    nom: 'Boîte à trier',
    sous: 'tout ce que tu captures',
    bois: '#9a6a34',
    etiquette: '#f2e6c4',
    etat: 'ouverte',
  },
  {
    id: 'vide',
    nom: 'Malle vide',
    sous: 'la prochaine idée',
    bois: '#6e5a48',
    etiquette: '#ece4d4',
    etat: 'vide',
    message: "Cette malle attend son contenu. Cours, projets, réseau, journal : dis à Claude laquelle ouvrir ensuite.",
  },
];

export const malle = (id) => MALLES.find((m) => m.id === id);
