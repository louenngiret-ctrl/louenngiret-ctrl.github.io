# État du projet (version 1.0.0, 26 novembre 2026)

## Marche aujourd'hui

- **Tableau de bord** (`#/`) : lucarne, horloge, éphéméride, calendrier, carte du jour, cabinet de curiosités, météo.
- **Grand menu** (`#/accueil`) façon jeu, construit depuis l'arborescence ; grille sur mesure pour les six grandes
  pages de départ, grille libre dès qu'elles changent.
- **Arborescence administrable** : créer, renommer, décrire, déplacer, réordonner, mettre à la corbeille des dossiers,
  pages, liens et apps ; image (31 stickers, 178 icônes, ou une image importée), couleur héritée ou propre, taille de
  tuile, épingle ; anciennes versions ; retour à l'arborescence de départ (l'actuelle est gardée).
- **Pages** : notes et fichiers (importer, ouvrir, aperçu image, son, vidéo, modifier les textes, renommer,
  télécharger, jeter) avec 15 anciennes versions par fichier.
- **Apps** : livrées (Achats, Armoire, Loge, Cours) et ajoutées (dossier ou .zip), isolées, SDK avec permissions,
  mise à jour avec anciennes versions, export .zip, désinstallation récupérable, app modèle.
- **Sauvegardes** : archive complète .zip, restauration avec aperçu, points de restauration automatiques et manuels,
  archive quotidienne dans un dossier du PC, ancienne sauvegarde .json encore lisible.
- **Corbeille** pour les pages et les fichiers.
- **Explorer, Rechercher** (pages, notes, fichiers, Carnet), **Paramètres** (barre déplaçable), **Ressources**,
  **Atelier de déco**, **capture rapide** (texte, dictée, photo), **partage vers l'appli**.
- Hors connexion complet, mise à jour automatique (PC et A14), 0 violation axe sur les vues testées, 360 px et 1280 px.

## Préparé, pas encore actif

- **Journal des changements** et identifiant d'appareil : rempli à chaque écriture, pas encore envoyé nulle part.
- **Synchronisation PC et téléphone, compagnon Windows** : plan complet dans [SYNCHRO.md](SYNCHRO.md), relais à valider.

## N'existe pas encore

- Éditeur de pages en blocs (titres, listes, images, tableaux) : les pages sont des carnets de notes et de fichiers.
- Ouvrir directement un dossier du PC dans My memories (sans synchro).
- Rappels et notifications (il faut un serveur qui envoie).
- Partage entre personnes.

## Points d'attention

- Le stockage du navigateur est protégé (`navigator.storage.persist`) mais reste celui du navigateur : garder une
  archive récente tant que la synchro n'existe pas.
- Carnet V2 n'est pas modifié (règle) : il ne suit donc pas encore le décor ni le SDK.
