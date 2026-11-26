# Créer et ajouter ses propres applications

Une application de My memories est un petit site : un dossier avec un fichier `app.json` et des pages HTML, CSS,
JavaScript et images. Elle s'ajoute sans toucher au code de My memories, tourne isolée, et ne voit que ce que Louenn
lui permet. L'exemple complet est dans [`exemples/app-modele`](../exemples/app-modele) : on peut l'installer depuis
Administration, Applications, « Installer l'app modèle ».

## 1. Le manifeste `app.json`

```json
{
  "id": "mon-armoire",
  "nom": "Mon armoire",
  "version": "1.0.0",
  "entree": "index.html",
  "description": "Ce que fait l'app, en une phrase.",
  "icone": "i094",
  "categorie": "quotidien",
  "permissions": ["notes:lire"],
  "materiel": ["camera"]
}
```

| Champ | Obligatoire | Rôle |
| --- | --- | --- |
| `id` | oui | 2 à 40 caractères : minuscules, chiffres, tirets. Ne change plus jamais (ses données y sont attachées). |
| `nom` | oui | Le nom affiché dans les menus. |
| `version` | non | Affichée ; l'ancienne version est gardée à chaque mise à jour. |
| `entree` | non | La page d'ouverture (`index.html` par défaut). |
| `icone` | non | Une icône de la bibliothèque (`i000` à `i178`, visibles dans l'administration). |
| `categorie` | non | L'identifiant du dossier où la ranger par défaut (`creation`, `organisation`, `quotidien`…). |
| `permissions` | non | Ce que l'app peut demander (tableau ci-dessous). Sans permission, elle ne voit que ses propres données. |
| `materiel` | non | `camera`, `micro` : le navigateur redemandera l'accord. |

## 2. Les permissions

| Permission | Autorise |
| --- | --- |
| *(aucune)* | `mm.stockage` (ses propres données), `mm.ui`, `mm.theme`, `mm.fichier` |
| `arbre:lire` | `mm.arbre.lister()` |
| `notes:lire` | `mm.notes.lister(page)` (les blocs écrits de la page : texte, titres, listes, cases, citations) |
| `notes:ecrire` | `mm.notes.ajouter`, `modifier`, `jeter` (seulement les notes des pages) |
| `fichiers:lire` | `mm.fichiers.lister(page)`, `mm.fichiers.lire(id)` |
| `fichiers:ecrire` | `mm.fichiers.ajouter(page, nom, blob)` |
| `reseau` | Se connecter à internet. Sans elle, une règle de sécurité (CSP) bloque toute requête hors du paquet. |

Louenn voit la liste en clair avant d'installer. Une demande non permise est refusée avec un message d'erreur.

## 3. Le SDK : l'objet `mm`

Il est fourni par My memories avant le chargement de la page. Tout renvoie une promesse.

```js
mm.app                        // { id, nom, version, page }
await mm.stockage.ecrire('cle', valeur)   // n'importe quelle valeur clonable (objets, tableaux, Blob…)
await mm.stockage.lire('cle')
await mm.stockage.effacer('cle')
await mm.stockage.cles()
await mm.arbre.lister()       // [{ id, parent, ordre, type, nom, desc }]
await mm.notes.lister('personnel/journal')
await mm.notes.ajouter('personnel/journal', 'texte')
await mm.fichiers.lister('creation/projets'); await mm.fichiers.lire(id)  // → Blob
await mm.ui.toast('Message'); await mm.ui.ouvrir('#/n/creation'); await mm.ui.titre('Nouveau titre')
await mm.theme()              // { univers, ambiance, papier, encre, accent, bois }
mm.fichier('img/fond.png')    // adresse utilisable d'un fichier du paquet
mm.ecouter('arbre', () => {}) // l'arborescence a changé
```

Les données de `mm.stockage` vivent dans la base de My memories (`elements`, malle `app:<id>`) : elles partent dans
les sauvegardes et suivront la future synchronisation.

## 4. Ce qui marche dans une app

- Plusieurs fichiers, sous-dossiers, `import` entre modules (`import { x } from './outils/x.js'`), `import('./x.js')`
  avec une adresse écrite en toutes lettres.
- CSS (`url()`, `@import`), images, polices, sons, vidéos du paquet.
- `fetch('donnees.json')` sur un fichier du paquet.
- Liens vers une autre page HTML du paquet (`<a href="reglages.html">`) : My memories la charge.

Limites (connues et voulues) :
- Pas d'accès direct à IndexedDB, au localStorage ni aux cookies : l'origine de l'app est opaque. Passer par `mm.stockage`.
- Un `import()` dont l'adresse est calculée (`import(nom + '.js')`) n'est pas réécrit.
- Deux modules qui s'importent l'un l'autre (dépendance circulaire) ne se chargent pas.
- Pas de service worker propre à l'app (elle profite du hors connexion de My memories : tout est déjà sur l'appareil).
- 60 Mo au plus par app.

## 5. Ajouter, mettre à jour, retirer

1. Sur PC : Administration, Applications, « Choisir un dossier ». Sur téléphone : compresser le dossier en .zip,
   puis « Choisir un .zip ».
2. Relire ce que l'app pourra faire, choisir où la ranger, « Installer ». Elle apparaît dans ce dossier du menu.
3. Pour une nouvelle version : même chemin, même `id` : « Mettre à jour ». L'ancienne est gardée (« Anciennes versions »).
4. « Exporter en .zip » rend le paquet tel qu'il est installé, pour le modifier sur le PC.
5. « Désinstaller » garde l'app dans ses anciennes versions et garde ses données, sauf si la case « effacer aussi ses
   données » est cochée. Sa tuile part dans la corbeille.

Nom, icône, couleur et place se changent ensuite dans Pages et dossiers, comme pour une page.

## 6. Comment c'est fait (pour les curieux)

`noyau/hote.js` lit le paquet, réécrit les références internes (HTML par DOMParser, modules par es-module-lexer, CSS
par expressions) en marques `__MM(chemin)__`, et classe les fichiers dans l'ordre de leurs dépendances. Le cadre
`sandbox="allow-scripts …"` reçoit un amorçage minuscule (`srcdoc`), puis les fichiers par message ; il crée lui-même
ses adresses `blob:`, définit `window.mm` et écrit la page. Chaque appel du SDK est un message vérifié par l'hôte
(source, permission, page cible). Voir [DECISIONS.md](DECISIONS.md), D6.
