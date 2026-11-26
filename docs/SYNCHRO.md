# Synchronisation PC, téléphone et compagnon Windows (plan, pas encore construit)

Rien de ce qui est décrit ici n'est actif dans l'appli : aucun bouton ne fait semblant. La version 1.0 pose ce dont
la synchronisation aura besoin (journal des changements, identifiants stables, versions, corbeille, identifiant
d'appareil), pour la brancher sans tout refaire.

## Pourquoi il faut un serveur

GitHub Pages ne sert que des fichiers fixes. Pour que le téléphone voie un fichier du PC quand le PC est éteint, il faut
un endroit toujours allumé qui garde une copie : un « relais ». Ce n'est pas « envoyer des fichiers sur un serveur » :
chaque appareil garde sa copie complète et travaille hors connexion ; le relais ne fait que transmettre et conserver.

## Le relais proposé : Supabase (offre gratuite)

- Postgres (tables), Storage (fichiers), Auth (connexion), règles RLS : chaque ligne n'est lisible que par sa propriétaire.
- Connecteur déjà disponible ; projet à créer **seulement avec l'accord explicite de Louenn** (création de compte et de ressources).
- Alternative étudiée : Google Drive (dossier d'appli caché, API Drive). Plus simple côté compte, mais pas de base de
  données ni de temps réel, et des quotas d'API. Décision à prendre ensemble (voir DECISIONS.md, D10).

Tables prévues :

```
changements (seq bigserial, proprietaire uuid, appareil text, store text, cle text, op text, objet jsonb, date timestamptz)
fichiers_contenu (id text, version text, chemin_storage text, taille bigint, empreinte text)   -- le Blob vit dans Storage
appareils (id text, nom text, type text, vu timestamptz)
epingles_pc (id text, appareil text, chemin text, type text)    -- dossiers épinglés par le compagnon
```

## Le protocole

1. Envoyer : lire le `journal` local depuis le dernier `seq` envoyé, joindre l'objet actuel (ou rien pour `del`),
   pousser dans `changements`. Les Blob partent dans Storage, adressés par empreinte (rien n'est envoyé deux fois).
2. Recevoir : demander les `changements` depuis le dernier `seq` reçu, les appliquer localement sans les remettre dans
   le journal. Les fichiers lourds ne se téléchargent qu'à l'ouverture (ou en Wi-Fi).
3. Conflits : chaque objet porte `modifie` et l'appareil. Même objet modifié des deux côtés depuis la dernière synchro :
   - nœuds, réglages : le plus récent gagne, l'autre va dans `versions` (récupérable) ;
   - notes et fichiers texte : les deux sont gardés, la copie est renommée « (copie du téléphone, 26 nov.) » ;
   - suppression contre modification : la modification gagne, la suppression est annulée et signalée.
4. Temps réel (option) : Supabase Realtime prévient les appareils ouverts qu'il y a du nouveau.

## Le compagnon Windows

Une petite appli de la barre des tâches (icône : l'épingle), installée une fois sur le PC.

- Épingler un fichier ou un dossier : clic droit dans l'Explorateur Windows (« Épingler dans My memories ») ou glisser
  sur l'icône. Il apparaît dans une page « PC » de My memories, sur tous les appareils.
- Il surveille les dossiers épinglés, envoie les changements au relais, et écrit sur le disque ce qui a été modifié
  depuis le téléphone (avec copie de conflit si les deux ont changé).
- PC éteint : le téléphone voit la dernière copie envoyée ; ses modifications attendent dans le relais et arrivent au
  rallumage. Hors connexion : file d'attente locale.
- Sécurité : il ne voit que les dossiers épinglés ; connexion par le même compte ; rien n'est ouvert sur le réseau local.
- Technique proposée : Tauri (Rust, quelques Mo, signable) ou Node avec Electron (plus lourd). À décider au moment de
  le construire ; il ne dépend pas du dépôt public (dépôt séparé, ou dossier `compagnon/` sans données personnelles).

## Ordre de construction

1. Accord de Louenn sur le relais, puis création du projet, des tables et des règles RLS (migration versionnée).
2. Connexion dans My memories (lien magique ou clé d'accès), page Appareils.
3. Synchro des nœuds, notes et réglages ; puis des fichiers ; puis des apps et de leurs données.
4. Compagnon Windows : épingles en lecture, puis écriture et conflits.
5. Sauvegarde automatique dans le relais (remplace le dossier du PC pour le téléphone).
