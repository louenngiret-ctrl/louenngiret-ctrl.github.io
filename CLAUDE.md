# My memories : règles pour Claude

Ce dépôt est My memories (anciennement le Grenier), l'appli n°1 de Louenn (appli web installable, servie par GitHub Pages sur https://louenngiret-ctrl.github.io).
La référence complète est la Bible (titre resté « Bible du Grenier ») : https://claude.ai/artifact/Mbnh4gSC5kbSDKU1gxGUcr. Lis-la avant toute modification.

## À chaque nouvelle version
1. Changer `VERSION` dans `sw.js` ET `version` dans `version.json` (les deux, même numéro). Sans ça, la mise à jour automatique ne se déclenche pas.
2. Ajouter une entrée en tête de `historique` dans `version.json` (titre + notes en français, phrases courtes) : c'est l'écran « Quoi de neuf ».
3. Ajouter tout nouveau fichier de la coquille dans la liste `COQUILLE` de `sw.js`.
4. Mettre à jour le journal des versions de la Bible.

## Règles
- HTML, CSS, JavaScript en modules natifs : aucun framework, aucune étape de compilation.
- Une malle = une entrée dans `noyau/malles.js` + un dossier `malles/<id>/`. Ne toucher une autre malle qu'en le disant.
- Données : IndexedDB « grenier » (`noyau/store.js`). Tout changement de schéma = une nouvelle étape de migration, jamais la modification d'une étape publiée.
- Dépôt public : aucune donnée personnelle, aucune photo de Louenn. Exceptions choisies par Louenn le 25/11/2026 : Carnet V2 (`malles/carnet/index.html`) garde toutes ses images d'origine, sans remplacement ; les images que Louenn a fournies pour décorer la Loge (collages Pinterest, objets, outils, vis, mannequin) sont découpées dans `assets/loge/`.
- Carnet V2 a été déménagé tel quel : ne pas modifier son contenu sans demande explicite. Seul ajout : le lien « Grenier » en fin de fichier.
- Suite BTS (`malles/cours/suite/index.html`) : fichier de Louenn, mis à jour par Louenn de temps en temps. Pour une nouvelle version : remplacer le fichier tel quel, remettre le lien « Grenier » avant le dernier `</body>`, et changer `LOURDS` dans `sw.js`. Même règle (`LOURDS`) quand Carnet change.
- Les gros fichiers (Carnet, Suite, `vendor/`, modèles MediaPipe) vivent dans le cache `LOURDS`, gardé d'une version à l'autre : ne pas les mettre dans `COQUILLE`.
- Filtre coiffure (`malles/loge/filtre.js`, `cheveux.js`) : MediaPipe et three.js sont embarqués dans `vendor/`, modèles compris. Dans `vendor/mediapipe/vision_bundle.mjs`, l'envoi de statistiques vers Google est coupé : à refaire si on met à jour MediaPipe (voir `vendor/mediapipe/NOTICE.md`).
- Noms de classes : vérifier qu'un nom n'existe pas déjà ailleurs (`.miroir`, `.flash`, `.rayon`, `.apercu`, `.sticker` ont déjà causé des bugs).
- Décor (`noyau/decor.js`, `decor.css`) : un seul réglage (localStorage `grenier.decor`) appliqué sur toutes les pages via `appliquerAmbiance()` d'`outils.js`. L'univers impose l'ambiance (nuit ou claire). Les attaches s'appliquent à tout élément `.scotch`. Images dans `assets/deco/` (crédits dans `assets/deco/CREDITS.md`) : gardées dans le cache `LOURDS`, donc pour modifier une image, lui donner un nouveau nom plutôt que l'écraser. Rituels (trésor du jour, carte du jour, cabinet) : `noyau/curiosites.js`, état dans la meta IndexedDB `cabinet`.
- Plan (`noyau/plan.js`) : la seule liste des six grandes pages et de leurs sous-onglets. Menus (`noyau/menus.js`), Explorer et Rechercher (`noyau/navigation.js`) et Ressources s'en servent tous. Ajouter une page = une ligne dans le plan. Un sous-onglet sans `lien` est déjà un carnet de notes (malle `section/sous-onglet`) : la vraie page devra reprendre ces notes.
- Routes : `#/` tableau de bord (s'ouvre en premier), `#/accueil` grand menu, `#/s/<section>` et `#/s/<section>/<sous>`, `#/ressources/<principal|categories|ressource>`.
- Licences : ne jamais mettre dans le dépôt public des fichiers dont la licence interdit la redistribution (refusés le 26/11/2026 : textures TextureVault « grunge halftone », papiers Novanture). Les remplacer par des effets CSS ou SVG.
- Mobile d'abord (Samsung A14), cibles tactiles de 44 px minimum, rien qui dépasse à 360 px.
- Textes visibles et noms de fichiers livrés : vrais espaces, jamais de tirets du bas.
- Tester en local (serveur http + navigateur) avant d'envoyer : rendu 360 px et PC, service worker, hors connexion.
