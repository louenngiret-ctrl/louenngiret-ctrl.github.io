# Feuille de route

## Maintenant (prochaines versions, sans dépendance extérieure)

1. **Pages en blocs** : chaque page devient un document (texte, titres, cases à cocher, images, fichiers, liens vers
   d'autres pages). Les notes existantes deviennent des blocs. Prépare To do list, Habitudes, Objectifs, Journal.
2. **Pages spécialisées** à partir des carnets : To do list, Habitudes, Emploi du temps, Économie (chaque sous-page
   de départ a déjà ses notes : la vraie page les reprend).
3. **SDK v2** : `mm.fichiers.choisir()` (sélecteur de My memories), événements `notes`, mise à disposition des
   composants visuels (boutons, étiquettes) pour que les apps ressemblent à My memories.
4. **Dossiers épinglés, suite** : lier une page à un dossier du disque (copie dans les deux sens à chaque ouverture), recherche dans les dossiers épinglés.

## À anticiper (à décider avant de construire)

- **Relais de synchronisation** : écarté pour l’instant (D13). Si un jour : Supabase ou Google Drive, avec l’accord de Louenn.
- **Chiffrement** des pages sensibles (Santé, Vie personnelle) avant tout envoi vers un relais.
- **Taille du stockage** : photos et fichiers lourds ; prévoir un nettoyage des anciennes versions et un indicateur.

## Plus tard

- Synchronisation, puis compagnon Windows (SYNCHRO.md, étapes 1 à 5).
- Rappels et notifications (Push), une fois le relais en place.
- Ouvrir une sauvegarde au double-clic sur PC (`file_handlers`).
- Carnet : décor commun et SDK (demande l'accord de Louenn, Carnet ne se modifie pas sinon).

## Dépendant d'autre chose

| Élément | Dépend de |
| --- | --- |
| Compagnon Windows | Relais de synchronisation |
| Sauvegarde cloud automatique sur téléphone | Relais |
| Notifications | Relais (envoi Push) |
| Apps partagées entre appareils | Synchro des apps (étape 3 de SYNCHRO.md) |
