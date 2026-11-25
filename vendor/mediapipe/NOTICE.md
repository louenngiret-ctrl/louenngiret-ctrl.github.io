# MediaPipe Tasks Vision 1.2.3

Copié depuis le paquet npm `@mediapipe/tasks-vision` (Google), licence Apache-2.0.
https://www.npmjs.com/package/@mediapipe/tasks-vision

**Seule modification** de `vision_bundle.mjs` : l'envoi périodique de statistiques d'usage vers
`odml.pa.googleapis.com` est coupé (la méthode `flush` du journal vide sa file sans rien envoyer).
Ainsi, rien ne quitte l'appareil quand le filtre tourne.

## Modèles (`modeles/`)

Modèles de Google MediaPipe, licence Apache-2.0, octets non modifiés :

- `face_landmarker.task` (BlazeFace, Face Mesh V2, Blendshape V2), SHA-256
  `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`, identique au fichier officiel
  `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- `hair_segmenter.tflite`, SHA-256 `2628cf3ce5f695f604cbea2841e00befcaa3624bf80caf3664bef2656d59bf84`.

Récupérés le 25/11/2026 dans le paquet npm `@beautinique/frontend-tryon-assets` 1.0.2, qui les redistribue tels quels.

## Maillage du visage

`malles/loge/visage.js` reprend les sommets et triangles de `canonical_face_model.obj`
(dépôt google-ai-edge/mediapipe, licence Apache-2.0).
