# Architecture générale

My memories est une appli web installable (PWA) servie par GitHub Pages, sans serveur, sans framework et sans étape
de compilation : HTML, CSS et modules JavaScript natifs. Elle tourne sur le PC (Chrome, Edge) et sur le téléphone
(Samsung A14, Chrome Android), hors connexion comme en ligne.

## Les couches

```
 Interface        accueil.js (tableau de bord)  menus.js (grand menu, dossiers, pages)  admin.js (administration)
                  navigation.js (barre, Explorer, Rechercher, Paramètres)  atelier.js  curiosites.js  hote.js (apps)
                  dossiers.js (Dossiers épinglés)  blocs.js (pages en blocs)
 Services         arbre.js (arborescence)  fichiers.js  apps.js  sauvegarde.js  pc.js (disque)  decor.js  meteo.js
 Stockage         store.js : IndexedDB « grenier », la source de vérité de l'appareil
 Coquille         sw.js (hors connexion, mises à jour)  manifest.webmanifest  index.html
 Apps livrées     malles/carnet (Carnet V2 : achats, armoire)  malles/loge  malles/cours (+ Suite BTS)
 Apps ajoutées    stockées dans IndexedDB, exécutées isolées par hote.js
```

Règle : une couche ne parle qu'à celle du dessous. L'interface ne touche jamais IndexedDB directement, elle passe par
`store.js` ou par un service.

## La base de données (IndexedDB « grenier », schéma 2)

Le nom historique « grenier » est gardé : le changer ferait perdre les données déjà enregistrées.

| Store | Clé | Contenu |
| --- | --- | --- |
| `elements` | `id` | Notes, blocs des pages, captures, données des apps. `malle` = l'identifiant de la page ou de l'app propriétaire (`personnel/journal`, `boite`, `app:mon-app`). Un bloc porte en plus `bloc` (genre), `ordre`, et selon le genre `coche`, `fichier` (image) ou `cible` (lien vers une page). Index `malle`, `modifie`. |
| `meta` | `cle` | Réglages et petits états (cabinet, sauvegarde, version de la graine). |
| `noeuds` | `id` | L'arborescence : dossiers, pages, liens, apps. Index `parent`. |
| `versions` | `id` | Anciennes versions : `noeud:<id>`, `fichier:<id>`, `app:<id>`, `arbre`, et les points de restauration `point:auto` / `point:manuel`. Index `cible`, `date`. |
| `fichiers` | `id` | Fichiers rangés dans les pages (`parent` = id de la page), contenu en Blob. Index `parent`. |
| `apps` | `id` | Apps ajoutées : manifeste, permissions, fichiers (Blob). |
| `journal` | `seq` (auto) | Chaque écriture suivie (elements, noeuds, fichiers, apps) : `{ store, cle, op, date, appareil }`. Sert à la future synchronisation et aux points de restauration. |

Migrations : dans `store.js`, `onupgradeneeded`, une étape par version (`if (e.oldVersion < 2)`). On n'écrit jamais
dans une étape publiée : on en ajoute une.

Autres bases de la même origine : `carnet` (Carnet V2 : `kv`, `thumb`, `full`). Le localStorage garde les réglages
(`grenier.*`, `mm.*`), l'état de Carnet (`carnet.state`), de la Loge et de la Suite. La sauvegarde complète les emporte tous.

## L'arborescence (arbre.js)

- Un nœud : `{ id, parent, ordre, type, nom, desc, sticker | icone | image, couleur, encre, taille, lien, app, epingle, corbeille, cree, modifie }`.
- Types : `dossier` (menu de tuiles), `page` (feuille en blocs et fichiers, voir « Les pages en blocs »), `lien` (adresse interne ou externe), `app` (ouvre une application).
- La racine `racine` est le grand menu. Ses enfants sont les grandes pages.
- À la première ouverture de la 1.0, la graine (`plan.js`) est copiée dans la base. Les identifiants des sous-onglets
  restent `section/sous-onglet`, identiques aux `malle` des notes écrites en 0.9 : aucune note n'est perdue.
- Un identifiant ne change jamais, même si la page est renommée ou déplacée : les notes, fichiers et liens restent attachés.
- Chaque modification garde l'ancienne version (store `versions`). Supprimer = mettre à la corbeille (`corbeille: true`).
- Les couleurs s'héritent : une page sans couleur prend celle de son dossier.
- Les menus, l'Explorer, Rechercher et Ressources lisent tous l'arbre. Un événement `mm:arbre` prévient les vues ouvertes.

## Les pages en blocs (blocs.js)

- Une page est une feuille de blocs. Un bloc = un élément du store `elements` (`malle` = id de la page) : pas de
  nouveau store, pas de migration, et la fusion d'archive (D14) compare bloc par bloc.
- `bloc` : `texte`, `titre`, `sous-titre`, `liste`, `numero`, `case` (`coche`), `citation` → `type: 'note'` (vus par
  Rechercher et par `mm.notes`) ; `image` → `type: 'photo'`, Blob dans `fichier`, légende dans `texte` ;
  `separateur`, `page` (`cible` = id du nœud) → `type: 'bloc'`.
- Ordre : `ordre` (nombres espacés de 1024, un bloc inséré prend le milieu ; renumérotation quand l'écart est trop
  petit). Sans `ordre` (notes d'avant la 1.2, notes ajoutées par une app), la date de création sert d'ordre : elles se
  rangent à la suite.
- La saisie est enregistrée 600 ms après la dernière touche, en file ; tout est vidé en quittant la page.
- Bloc jeté avec du contenu : gardé dans `versions` (cible `blocs:<page>`, 30 au plus), « Blocs jetés » sous la feuille.
- Ressources montre les paragraphes, citations et images ; titres, éléments de liste et cases restent dans leur page
  (Rechercher les trouve).

## Routes

| Route | Vue |
| --- | --- |
| `#/` | Tableau de bord (s'ouvre en premier) |
| `#/accueil` | Grand menu (enfants de la racine) |
| `#/n/<id>` | Un nœud : dossier en tuiles ou page en carnet. `#/s/<id>` reste un alias (anciens liens). |
| `#/pc[/<épingle>/<chemin>]` | Dossiers épinglés (fichiers de l'appareil) |
| `#/app/<id>` | Une application : livrée (pleine page) ou ajoutée (cadre isolé) |
| `#/admin/<arbre/[id] \| apps \| sauvegardes \| corbeille>` | Administration |
| `#/ressources/<principal \| categories \| ressource>` | Ressources |
| `#/deco`, `#/cabinet`, `#/reglages`, `#/nouveautes`, `#/boite`, `#/capture`, `#/malle/<id>` | Inchangées |

## Les applications

Voir [APPS.md](APPS.md). En bref : les apps livrées (Carnet, Armoire, Loge, Cours) sont des pages du dépôt qui
s'ouvrent en pleine page. Les apps ajoutées sont gardées dans IndexedDB et tournent dans un cadre `sandbox` sans
`allow-same-origin` : origine opaque, aucun accès aux données de My memories sauf par le SDK, filtré par permissions.

## Hors connexion et mises à jour (sw.js)

- `COQUILLE` (cache versionné) : le code et les styles, rechargés à chaque version.
- `LOURDS` (cache gardé entre versions) : Carnet, Suite, moteur d'essayage, décor, stickers, icônes, bibliothèques,
  app modèle. Un fichier de `LOURDS` modifié doit changer de nom (ou `LOURDS` doit changer).
- À chaque version : `VERSION` dans `sw.js` et `version` dans `version.json`, plus une entrée « Quoi de neuf ».

## Appareils

Mobile d'abord (360 px), cibles de 44 px, rien ne dépasse. Fonctions propres au PC (sauvegarde dans un dossier,
choix d'un dossier d'app) testées et cachées ailleurs.
