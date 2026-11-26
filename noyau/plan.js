// Le plan de My memories : la seule liste des grandes pages et de leurs sous-onglets.
// Le menu d'accueil, les menus de section, l'Explorer, Rechercher et Ressources se construisent tous à partir d'ici.
// Pour ajouter une page plus tard : une ligne ici suffit. Sans « lien », la page existe déjà comme carnet de notes
// (malle « section/sous-onglet » dans IndexedDB), donc rien n'est perdu quand la vraie page arrive.

const ICI = new URL('../assets/memoires/', import.meta.url).href;
export const IMG = (n) => `${ICI}stickers/${n}.webp`;
export const COLLAGE = (n) => `${ICI}collage/${n}.webp`;
export const DENTELLE = (i) => `${ICI}dentelles/d${i}.webp`;

const s = (id, nom, desc, sticker, lien) => ({ id, nom, desc, sticker, lien: lien || null });

export const SECTIONS = [
  {
    id: 'creation', nom: 'Création', taille: 'xxl', couleur: '#b3362b', encre: '#fff3dc', dentelle: 1,
    desc: 'Tes projets et tes idées : films, dessins, écriture, tout ce que tu fabriques.',
    hero: 'chat-sorcier', deco: 'crapaud-sorcier', fond: COLLAGE('retro'),
    sous: [
      s('projets', 'Projets', 'Chaque projet avec ses étapes, de l’idée au rendu final.', 'chat-sorcier'),
      s('idees', 'Idées', 'Les idées en vrac, avant qu’elles deviennent des projets.', 'champi-fantome'),
    ],
  },
  {
    id: 'organisation', nom: 'Organisation', taille: 'xl', couleur: '#d29a2e', encre: '#2a1a0c', dentelle: 6,
    desc: 'Ton temps : calendrier, emploi du temps, rendez-vous, choses à faire, habitudes et objectifs.',
    hero: 'souris-escargot', deco: 'bourdon-the',
    sous: [
      s('calendrier', 'Calendrier', 'Le mois et tes rendez-vous, sur le tableau de bord.', 'pleine-lune', '#/'),
      s('emploi-du-temps', 'Emploi du temps', 'Ta semaine type : cours, travail, activités.', 'bourdon'),
      s('rendez-vous', 'Rendez-vous', 'Les rendez-vous à ne pas rater.', 'colibri'),
      s('a-faire', 'To do list', 'Ce qu’il reste à faire, coché quand c’est fait.', 'grenouille-chapeau'),
      s('habitudes', 'Habitudes', 'Les petites choses que tu veux faire chaque jour.', 'champi-fraise'),
      s('objectifs', 'Objectifs', 'Ce que tu vises, et les étapes pour y arriver.', 'souris-archer'),
      s('boite', 'Boîte à trier', 'Tout ce que tu as capturé avec le bouton +.', 'oie', '#/boite'),
    ],
  },
  {
    id: 'personnel', nom: 'Personnel', taille: 'm', couleur: '#7d4f7e', encre: '#fbeefa', dentelle: 4,
    desc: 'Journal, réflexions, moodboard, humeurs, loisirs, vie perso et social.',
    hero: 'croissant', deco: 'fees',
    sous: [
      s('journal', 'Journal', 'Ce que tu as vécu, à ta façon.', 'chat-tasse'),
      s('reflexions', 'Réflexions', 'Les pensées qui tournent et que tu veux poser.', 'nuage-pleure'),
      s('moodboard', 'Moodboard', 'Des images, des couleurs, des envies.', 'papillon-bleu'),
      s('humeurs', 'Piste d’humeurs', 'Une couleur par jour pour suivre ton humeur.', 'soleil-rouge'),
      s('loisirs', 'Loisirs', 'Ce que tu aimes faire, voir, lire, écouter.', 'grenouille-amanite'),
      s('vie-perso', 'Vie personnelle', 'Ce qui compte pour toi, en dehors du reste.', 'jonquille'),
      s('social', 'Social', 'Les gens, les sorties, les nouvelles à prendre.', 'ronde-fees'),
      s('cabinet', 'Cabinet de curiosités', 'Les trésors ramassés chaque jour.', 'crapaud-chambre', '#/cabinet'),
    ],
  },
  {
    id: 'apprentissage', nom: 'Apprentissage', taille: 'm', couleur: '#2e6b66', encre: '#eefbf6', dentelle: 2,
    desc: 'Études, formations et ressources pour apprendre.',
    hero: 'herisson-livre', deco: 'souris-champi',
    sous: [
      s('etudes', 'Études : BTS', 'Le BTS Audiovisuel et la Suite de cours.', 'herisson-livre', 'malles/cours/index.html'),
      s('formations', 'Formations', 'Les formations suivies ou à suivre.', 'souris-archer'),
      s('ressources', 'Ressources', 'Tutos, livres, liens utiles pour apprendre.', 'souris-champi'),
    ],
  },
  {
    id: 'quotidien', nom: 'Vie quotidienne', taille: 'm', couleur: '#5f7d36', encre: '#f4fbe6', dentelle: 3,
    desc: 'Routine, santé, armoire et loge : le quotidien.',
    hero: 'chat-nouilles', deco: 'jonquille',
    sous: [
      s('routine', 'Routine', 'Le matin, le soir, ce qui revient.', 'bourdon-the'),
      s('sante', 'Santé', 'Tes notes de santé, gardées sur ton appareil.', 'herisson-fleur'),
      s('armoire', 'Armoire', 'Tes vêtements, tes tenues, ton atelier.', 'oie', 'malles/carnet/index.html#/armoire'),
      s('loge', 'Loge', 'Coiffure, make-up, soins, ongles, piercings.', 'jonquille', 'malles/loge/index.html#soin'),
    ],
  },
  {
    id: 'gestion', nom: 'Gestion et administration', taille: 'm', couleur: '#2b4669', encre: '#eef3fb', dentelle: 5,
    desc: 'Le professionnel, l’argent et les achats.',
    hero: 'pie-robe', deco: 'timbre-bresil',
    sous: [
      s('professionnel', 'Professionnel', 'Stages, alternance, contacts, candidatures.', 'pie-robe'),
      s('economie', 'Économie', 'Budget du mois, dépenses, économies.', 'chat-bocal'),
      s('achats', 'Achats et courses', 'Tes listes, ton panier, tes envies.', 'champi-fraise', 'malles/carnet/index.html#/home'),
    ],
  },
];

export const section = (id) => SECTIONS.find((x) => x.id === id);
export const sousOnglet = (sec, id) => section(sec)?.sous.find((x) => x.id === id);
/** Où mène un sous-onglet : sa vraie page si elle existe, sinon son carnet de notes. */
export const lienDe = (sec, so) => so.lien || `#/s/${sec}/${so.id}`;
/** L'identifiant de rangement des notes d'un sous-onglet (champ « malle » dans IndexedDB). */
export const rangement = (sec, so) => `${sec}/${so}`;
export const tousLesSous = () => SECTIONS.flatMap((sec) => sec.sous.map((so) => ({ sec, so, lien: lienDe(sec.id, so) })));
/** Retrouve la page d'un élément enregistré, d'après sa malle. */
export function pageDe(malle) {
  if (!malle) return { nom: '', lien: '#/' };
  if (malle.includes('/')) { const [a, b] = malle.split('/'); const so = sousOnglet(a, b); return so ? { nom: `${section(a).nom}, ${so.nom}`, lien: `#/s/${a}/${b}` } : { nom: malle, lien: '#/' }; }
  const t = { boite: ['Boîte à trier', '#/boite'], loge: ['Loge', 'malles/loge/index.html#soin'], agenda: ['Calendrier', '#/'], achats: ['Achats et courses', 'malles/carnet/index.html#/home'], 'garde-robe': ['Armoire', 'malles/carnet/index.html#/armoire'] }[malle];
  return t ? { nom: t[0], lien: t[1] } : { nom: malle, lien: '#/' };
}
/** La grande page d'où vient un élément (pour Ressources, catégories). */
export function sectionDe(malle) {
  if (!malle) return null;
  if (malle.includes('/')) return section(malle.split('/')[0]);
  return { boite: section('organisation'), agenda: section('organisation'), loge: section('quotidien'), 'garde-robe': section('quotidien'), achats: section('gestion') }[malle] || null;
}
