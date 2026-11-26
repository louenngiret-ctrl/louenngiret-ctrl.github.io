# Dépendances embarquées

Aucune dépendance n'est chargée depuis internet au moment de l'usage : tout est dans le dépôt et dans le cache hors connexion.

| Bibliothèque | Version | Licence | Fichier | Sert à |
| --- | --- | --- | --- | --- |
| fflate | 0.8.3 | MIT | `vendor/fflate/fflate.js` | Lire et écrire les .zip (apps, sauvegardes) |
| es-module-lexer | 3.0.5 | MIT | `vendor/es-module-lexer/lexer.js` | Trouver les `import` des apps pour les réécrire |
| three.js | voir `vendor/three` | MIT | `vendor/three/` | Filtre coiffure de la Loge |
| MediaPipe Tasks Vision | 1.2.3 | Apache 2.0 | `vendor/mediapipe/` | Suivi du visage (Loge) ; statistiques vers Google coupées |
| Polices | — | OFL | `assets/fonts/` | Permanent Marker, Special Elite, Patrick Hand, UnifrakturMaguntia, Bodoni Moda |

Images : crédits dans `assets/deco/CREDITS.md` et `assets/memoires/CREDITS.md`. Refusées pour licence : textures
TextureVault, papiers Novanture (remplacées par des effets CSS et SVG).

## Mettre à jour une bibliothèque

1. `npm pack <nom>` dans un dossier vide, prendre la version ES module (`esm/browser.js` pour fflate, `dist/lexer.js`
   pour es-module-lexer) et la licence.
2. Les fichiers de `vendor/` sont gardés dans le cache `LOURDS` : changer le nom du fichier ou `LOURDS` dans `sw.js`.
3. Vérifier l'API : es-module-lexer 3 donne `specifier`, `start`, `end` (et non plus `n`, `s`, `e`) ; pour un
   `import()` dynamique, `start` et `end` englobent les guillemets. `hote.js` gère les deux formes.
4. Retester : installer l'app modèle, l'ouvrir, faire une archive et la remettre.

## Dépendances de services (aucune aujourd'hui côté données)

- Météo : Open-Meteo (sans clé, sans compte).
- Futur relais de synchronisation : Supabase (à valider).
