# Décisions techniques

Chaque décision : le choix, la raison, ce qu'il empêche ou coûte. On n'en change qu'en écrivant ici pourquoi.

**D1. Local d'abord.** IndexedDB de chaque appareil est la source de vérité ; un futur serveur ne sera qu'un relais.
Raison : l'appli doit marcher hors connexion, vite, sans compte. Coût : la synchro devra gérer les conflits (SYNCHRO.md).

**D2. Pas de framework, pas de compilation.** Modules natifs, servis tels quels par GitHub Pages. Raison : tout reste
lisible et modifiable sans outil. Coût : les bibliothèques sont copiées dans `vendor/` en version ES module.

**D3. Le nom de base « grenier » est gardé.** Le renommer ferait perdre les données. Les nouveaux noms vivent dans le code.

**D4. Identifiants stables.** Un nœud garde son `id` à vie (renommé, déplacé) ; les sous-onglets de départ gardent
`section/sous-onglet`, la clé des notes 0.9. Raison : aucune donnée orpheline. Coût : un id peut ne plus ressembler au nom.

**D5. Versions et corbeille dans la même base.** Tout changement d'un nœud, d'un fichier ou d'une app garde l'ancienne
version ; supprimer = corbeille. Raison : « rien ne se perd » sans fichier à gérer. Coût : de la place ; les fichiers
gardent 15 versions, les points automatiques 5.

**D6. Apps isolées par cadre `sandbox` sans `allow-same-origin`, fichiers en `blob:` créés dans le cadre.**
Essayé et écarté : servir `/apps/<id>/…` par le service worker — un cadre isolé n'est pas contrôlé par le service worker
(vérifié dans Chromium le 26/11/2026), et sans isolement l'app lirait toute la base. Raison : vraie sécurité, pas
d'origine séparée disponible sur GitHub Pages. Coût : réécriture des imports (es-module-lexer), pas d'IndexedDB direct
pour les apps (elles passent par `mm.stockage`).

**D7. Permission « reseau » appliquée par CSP.** Sans elle, la page de l'app reçoit une règle `connect-src blob: data:`.
Raison : une app ne peut pas envoyer de données dehors à l'insu de Louenn.

**D8. Apps livrées = pages du dépôt.** Carnet, Loge, Cours restent des pages pleines (`#/app/<id>` y redirige).
Raison : ne rien casser (Carnet ne se modifie pas sans demande). Coût : elles ne passent pas par le SDK.

**D9. Archive = copie générique de toutes les bases + localStorage.** Raison : une sauvegarde qui oublie Carnet n'est pas
complète. Coût : le format suit les schémas des bases ; il est versionné (`versionFormat`).

**D10. Synchronisation : pas de simulation.** Rien n'apparaît tant que le relais n'existe pas. Relais proposé :
Supabase ; à valider par Louenn avant toute création de compte ou de projet.

**D11. Journal des changements dès maintenant.** Chaque écriture suivie note `{ store, cle, op, date, appareil }`.
Raison : la synchro pourra reprendre l'historique local au lieu de tout comparer. Coût : quelques octets par écriture.

**D12. Bibliothèque d'icônes en WebP 96 px dans `assets/memoires/icones/`.** Découpées dans les planches fournies par
Louenn le 26/11/2026. Cachées dans `LOURDS` : pour changer une icône, lui donner un nouveau numéro.
