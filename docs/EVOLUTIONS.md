# Pistes d'évolution et risques

## Pistes

- **Liens entre tout** : chaque note, fichier ou page peut citer une autre (`[[Journal]]`), avec la liste des
  « pages qui citent celle-ci ». Le champ `liens` des éléments existe déjà.
- **Mémoire du jour** : le tableau de bord ressort une note ou une photo d'il y a un an (le nom My memories l'appelle).
- **Modèles de pages** : une page « projet de film » toute prête (étapes, fichiers, équipe), dupliquable.
- **Apps entre elles** : une app expose des actions que d'autres appellent par le SDK (`mm.apps.appeler`).
- **Thème des apps** : une feuille de style commune fournie par le SDK.
- **Import Notion** : récupérer des pages existantes dans l'arborescence (connecteur Notion, avec accord).

## Risques à surveiller

| Risque | Ce qui protège aujourd'hui | À faire |
| --- | --- | --- |
| Effacement du stockage par le navigateur | `storage.persist()`, archive, dossier du PC | Relais de synchro |
| Base qui grossit (versions, points, photos) | Limites (15 versions par fichier, 5 points auto) | Indicateur de place, nettoyage guidé |
| App ajoutée malveillante | Cadre isolé, permissions, CSP sans `reseau` | Ne jamais ajouter `allow-same-origin` au cadre |
| Changement de schéma mal fait | Migrations par étapes, points de restauration | Tester la migration depuis la version précédente à chaque fois |
| Mise à jour d'une bibliothèque qui change d'API | DEPENDANCES.md, tests de l'app modèle | Relancer les tests apps et sauvegarde |
| Dépôt public | Aucune donnée personnelle dans le dépôt | Garder les données dans IndexedDB, jamais dans le code |
