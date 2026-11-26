# Sauvegarde et restauration

## Ce qui existe (version 1.1.0)

| Outil | Où | Contenu | Quand |
| --- | --- | --- | --- |
| Archive complète (.zip) | Administration, Sauvegardes ; Réglages | Toutes les bases IndexedDB de l'appli (My memories, Carnet), fichiers, photos, apps, et tout le localStorage | À la demande ; envoyable par le partage du téléphone |
| Dossier du PC | Administration, Sauvegardes (Chrome, Edge sur ordinateur) | La même archive | Une par jour, à l'ouverture de l'appli ; les 14 dernières gardées |
| Points de restauration | Administration, Sauvegardes | Pages, notes, fichiers, réglages internes de la base principale | Un automatique par jour si quelque chose a changé (les 5 derniers) ; à la demande (gardés) ; avant chaque restauration |
| Anciennes versions | Fiche d'une page, d'un fichier, d'une app | L'élément tel qu'il était | À chaque modification |
| Corbeille | Administration, Corbeille | Pages, dossiers, fichiers jetés | Jusqu'à « Effacer pour de bon » |

Restaurer une archive : un point de restauration est pris juste avant, puis les données de l'appareil sont remplacées
(sauf les anciennes versions et points de cet appareil, qui restent). La page se recharge.

Les anciennes sauvegardes `.json` (versions 0.x) se remettent aussi : notes et réglages internes seulement.

## Échange entre appareils (fusion)

Même archive, autre bouton : « Fusionner avec cet appareil ». Règles (D14) : pour chaque page, note, fichier ou app, la
version la plus récente gagne et l'autre va dans les anciennes versions ; contenu identique = rien ne bouge ; ce qui a
été supprimé sur l'autre appareil est supprimé ici seulement si ça n'a pas été modifié depuis ; les anciennes
versions de l'autre appareil s'ajoutent. Carnet, Loge et Suite ne se fusionnent pas : la case « prendre aussi » les
remplace. Un point de restauration est pris avant.

## Format de l'archive

```
My memories sauvegarde AAAA-MM-JJ.zip
  my-memories.json   { format: "my-memories-sauvegarde", versionFormat: 1, appli, exporte, appareil, bases: [...], localStorage: {...}, suppressions: [{ store, cle, date }] }
  octets/0, octets/1…  le contenu des Blob, ArrayBuffer et tableaux typés
  LISEZMOI.txt
```

Chaque base : `{ nom, version, stores: [{ nom, keyPath, autoIncrement, index: [...], lignes: [[cle, valeur], ...] }] }`.
Les valeurs non JSON sont emballées : `{ $blob: "octets/3", type, nom }`, `{ $buffer }`, `{ $vue, classe }`, `{ $date }`.
Exclus : le `journal` (propre à l'appareil, seules ses suppressions partent), les points de restauration, l'identifiant d'appareil `mm.appareil`, les épingles et le dossier de sauvegarde (poignées propres à l'appareil).
Une base absente de l'appareil est recréée avec son schéma. Si `versionFormat` est plus récent que l'appli, la
restauration est refusée (mettre l'appli à jour d'abord).

## Limites honnêtes

- Le dossier du PC n'est écrit que quand My memories est ouverte sur ce PC, et seulement si le navigateur a gardé
  l'autorisation ; sinon un bouton « Autoriser et sauvegarder » apparaît.
- Les points de restauration vivent sur l'appareil : s'il est perdu, seuls l'archive et le dossier du PC restent.
- Le téléphone ne peut pas écrire seul dans un dossier : l'archive s'envoie par le partage (Drive, mail…).
- Pas encore de sauvegarde dans un cloud : elle viendra avec la synchronisation ([SYNCHRO.md](SYNCHRO.md)).
