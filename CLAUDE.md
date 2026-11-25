# Grenier : règles pour Claude

Ce dépôt est le Grenier, l'appli n°1 de Louenn (appli web installable, servie par GitHub Pages sur https://louenngiret-ctrl.github.io).
La référence complète est la Bible du Grenier : https://claude.ai/artifact/Mbnh4gSC5kbSDKU1gxGUcr. Lis-la avant toute modification.

## À chaque nouvelle version
1. Changer `VERSION` dans `sw.js` ET `version` dans `version.json` (les deux, même numéro). Sans ça, la mise à jour automatique ne se déclenche pas.
2. Ajouter une entrée en tête de `historique` dans `version.json` (titre + notes en français, phrases courtes) : c'est l'écran « Quoi de neuf ».
3. Ajouter tout nouveau fichier de la coquille dans la liste `COQUILLE` de `sw.js`.
4. Mettre à jour le journal des versions de la Bible.

## Règles
- HTML, CSS, JavaScript en modules natifs : aucun framework, aucune étape de compilation.
- Une malle = une entrée dans `noyau/malles.js` + un dossier `malles/<id>/`. Ne toucher une autre malle qu'en le disant.
- Données : IndexedDB « grenier » (`noyau/store.js`). Tout changement de schéma = une nouvelle étape de migration, jamais la modification d'une étape publiée.
- Dépôt public : aucune donnée personnelle, aucune photo de Louenn, aucune image qui ne lui appartient pas.
- Mobile d'abord (Samsung A14), cibles tactiles de 44 px minimum, rien qui dépasse à 360 px.
- Textes visibles et noms de fichiers livrés : vrais espaces, jamais de tirets du bas.
- Tester en local (serveur http + navigateur) avant d'envoyer : rendu 360 px et PC, service worker, hors connexion.
