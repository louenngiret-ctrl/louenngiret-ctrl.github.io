// Miroir d'essayage : poser une coiffure de la collection sur sa propre photo.
// Automatique avec MediaPipe (Google, Apache-2.0) : détection du visage + détourage des cheveux.
// Les modèles se téléchargent au premier usage (internet nécessaire), puis restent en cache.
// Sans modèle, tout reste possible à la main : déplacer, agrandir, tourner, transparence.
import { $, esc, toast, compresserPhoto, urlPhoto } from '../../noyau/outils.js';

const MODELE_CHEVEUX = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite';
const MODELE_VISAGE = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let ia = null; // { seg, visage } une fois chargés
async function chargerIA() {
  if (ia) return ia;
  const mp = await import('../../vendor/mediapipe/vision_bundle.mjs');
  const fichiers = await mp.FilesetResolver.forVisionTasks(new URL('../../vendor/mediapipe/wasm', import.meta.url).href);
  const creer = async (delegate) => ({
    seg: await mp.ImageSegmenter.createFromOptions(fichiers, { baseOptions: { modelAssetPath: MODELE_CHEVEUX, delegate }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false }),
    visage: await mp.FaceLandmarker.createFromOptions(fichiers, { baseOptions: { modelAssetPath: MODELE_VISAGE, delegate }, runningMode: 'IMAGE', numFaces: 1 }),
  });
  try { ia = await creer('GPU'); } catch (e) { ia = await creer('CPU'); }
  return ia;
}

// Repères du visage : milieu entre les deux pommettes (234, 454), largeur et inclinaison.
function repere(img, visage) {
  const r = visage.detect(img);
  const p = r.faceLandmarks && r.faceLandmarks[0];
  if (!p) return null;
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const g = { x: p[234].x * W, y: p[234].y * H }, d = { x: p[454].x * W, y: p[454].y * H };
  return { cx: (g.x + d.x) / 2, cy: (g.y + d.y) / 2, largeur: Math.hypot(d.x - g.x, d.y - g.y), angle: Math.atan2(d.y - g.y, d.x - g.x) };
}

// Cheveux seuls (fond transparent), bords adoucis.
function detourerCheveux(img, seg) {
  let masque = null;
  seg.segment(img, (r) => {
    const m = r.categoryMask;
    masque = { w: m.width, h: m.height, data: m.getAsUint8Array().slice() };
  });
  if (!masque) return null;
  const mc = document.createElement('canvas');
  mc.width = masque.w; mc.height = masque.h;
  const id = mc.getContext('2d').createImageData(masque.w, masque.h);
  let n = 0;
  for (let i = 0; i < masque.data.length; i++) { const a = masque.data[i] === 1 ? 255 : 0; id.data[i * 4 + 3] = a; if (a) n++; }
  if (n < masque.data.length * 0.01) return null; // pas de cheveux trouvés
  mc.getContext('2d').putImageData(id, 0, 0);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, W, H);
  x.globalCompositeOperation = 'destination-in';
  x.filter = `blur(${Math.max(1, W / 500)}px)`;
  x.drawImage(mc, 0, 0, W, H);
  return c;
}

const chargerImage = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

export async function ouvrir(vue, { store, items, retour }) {
  const coiffures = items.filter((e) => e.fichier instanceof Blob && e.categorie !== 'Essai');
  vue.innerHTML = `<section class="rayon essayage">
    <div class="rayon-tete"><h2>Essayer sur moi</h2><button type="button" class="btn-sobre" id="e-retour">Retour au miroir</button></div>
    <div class="essai-grille">
      <div class="essai-toile">
        <canvas id="e-toile" width="900" height="1200" aria-label="Aperçu de l'essai"></canvas>
        <p class="essai-vide" id="e-vide">Commence par ta photo : de face, cheveux attachés si possible, bonne lumière.</p>
      </div>
      <div class="essai-outils">
        <label class="outil grand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
          <span>Ma photo</span><input type="file" id="e-visage" accept="image/*" capture="user" hidden></label>
        <p class="champ-label">Coiffure à essayer</p>
        <div class="essai-choix" id="e-choix">${coiffures.map((e) => `<button type="button" data-c="${esc(e.id)}" aria-label="${esc(e.titre || 'Coiffure')}"><img src="${urlPhoto(e.fichier)}" alt=""></button>`).join('')}
          <label class="essai-importer" aria-label="Importer une image">+<input type="file" id="e-importer" accept="image/*" hidden></label></div>
        <p class="petit" id="e-etat">${coiffures.length ? 'Touche une coiffure.' : 'Ajoute d’abord des coiffures dans le miroir, ou importe une image avec +.'}</p>
        <label class="reglage">Taille <input type="range" id="e-taille" min="20" max="300" value="100"></label>
        <label class="reglage">Rotation <input type="range" id="e-rotation" min="-45" max="45" value="0"></label>
        <label class="reglage">Transparence <input type="range" id="e-alpha" min="20" max="100" value="100"></label>
        <p class="petit">Fais glisser la coiffure du doigt pour la placer.</p>
        <div class="feuille-actions"><button type="button" class="btn" id="e-garder" disabled>Garder cet essai</button></div>
      </div>
    </div>
  </section>`;

  const toile = $('#e-toile');
  const ctx = toile.getContext('2d');
  let visage = null, repVisage = null;
  let calque = null; // { img (canvas ou image), ax, ay (point d'ancrage dans l'image), x, y, echelle, rot, alpha }
  const etat = (t) => { $('#e-etat').textContent = t; };

  function dessiner() {
    ctx.clearRect(0, 0, toile.width, toile.height);
    if (visage) ctx.drawImage(visage, 0, 0, toile.width, toile.height);
    if (calque) {
      const k = Number($('#e-taille').value) / 100, r = Number($('#e-rotation').value) * Math.PI / 180;
      ctx.save();
      ctx.globalAlpha = Number($('#e-alpha').value) / 100;
      ctx.translate(calque.x, calque.y);
      ctx.rotate(calque.rot + r);
      ctx.scale(calque.echelle * k, calque.echelle * k);
      ctx.drawImage(calque.img, -calque.ax, -calque.ay);
      ctx.restore();
    }
    $('#e-vide').hidden = Boolean(visage);
    $('#e-garder').disabled = !(visage && calque);
  }

  async function poserVisage(blob) {
    const img = await chargerImage(urlPhoto(blob));
    visage = img;
    toile.width = img.naturalWidth; toile.height = img.naturalHeight;
    repVisage = null;
    calque = null;
    dessiner();
  }

  async function essayer(blob) {
    if (!visage) { toast('Ajoute d’abord ta photo'); return; }
    const img = await chargerImage(urlPhoto(blob));
    // Placement par défaut, à la main : l'image entière, centrée sur le haut du visage.
    const base = { img, ax: img.naturalWidth / 2, ay: img.naturalHeight / 2, x: toile.width / 2, y: toile.height * 0.4, echelle: (toile.width * 0.8) / img.naturalWidth, rot: 0 };
    calque = base;
    $('#e-alpha').value = 70; $('#e-taille').value = 100; $('#e-rotation').value = 0;
    dessiner();
    etat('Je détoure les cheveux… (la première fois, il faut internet)');
    try {
      const { seg, visage: fl } = await chargerIA();
      repVisage = repVisage || repere(visage, fl);
      const repCoiffure = repere(img, fl);
      const cheveux = detourerCheveux(img, seg);
      if (!cheveux) throw new Error('cheveux introuvables');
      calque = { img: cheveux, ax: img.naturalWidth / 2, ay: img.naturalHeight / 2, x: toile.width / 2, y: toile.height * 0.4, echelle: base.echelle, rot: 0 };
      if (repVisage && repCoiffure) {
        calque.ax = repCoiffure.cx; calque.ay = repCoiffure.cy;
        calque.x = repVisage.cx; calque.y = repVisage.cy;
        calque.echelle = repVisage.largeur / repCoiffure.largeur;
        calque.rot = repVisage.angle - repCoiffure.angle;
      }
      $('#e-alpha').value = 100;
      etat(repVisage && repCoiffure ? 'Posée sur ton visage. Ajuste si besoin.' : 'Cheveux détourés, mais je n’ai pas trouvé les deux visages : place-la à la main.');
    } catch (e) {
      etat('Placement automatique indisponible pour l’instant : place la coiffure à la main avec la transparence.');
    }
    dessiner();
  }

  // Glisser pour déplacer (souris ou doigt).
  let glisse = null;
  toile.addEventListener('pointerdown', (e) => { if (!calque) return; e.preventDefault(); toile.setPointerCapture(e.pointerId); glisse = { x: e.clientX, y: e.clientY }; });
  toile.addEventListener('pointermove', (e) => {
    if (!glisse || !calque) return;
    const k = toile.width / toile.getBoundingClientRect().width;
    calque.x += (e.clientX - glisse.x) * k; calque.y += (e.clientY - glisse.y) * k;
    glisse = { x: e.clientX, y: e.clientY };
    dessiner();
  });
  toile.addEventListener('pointerup', () => { glisse = null; });
  ['e-taille', 'e-rotation', 'e-alpha'].forEach((id) => $('#' + id).addEventListener('input', dessiner));

  $('#e-retour').addEventListener('click', retour);
  $('#e-visage').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const b = await compresserPhoto(f, 1200);
    await store.ecrireMeta('loge.visage', b);
    await poserVisage(b);
    etat(coiffures.length ? 'Touche une coiffure.' : 'Importe une coiffure avec +.');
  });
  $('#e-choix').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = coiffures.find((x) => x.id === b.dataset.c);
    if (c) essayer(c.fichier);
  });
  $('#e-importer').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) essayer(await compresserPhoto(f, 1200)); });
  $('#e-garder').addEventListener('click', async () => {
    const blob = await new Promise((r) => toile.toBlob(r, 'image/jpeg', 0.88));
    await store.ajouter({ malle: 'loge', type: 'coiffure', categorie: 'Essai', titre: `Essai du ${new Date().toLocaleDateString('fr-FR')}`, fichier: blob });
    toast('Essai rangé dans le miroir');
  });

  const dejaVisage = await store.lireMeta('loge.visage').catch(() => null);
  if (dejaVisage instanceof Blob) { await poserVisage(dejaVisage); etat(coiffures.length ? 'Touche une coiffure.' : 'Importe une coiffure avec +.'); }
  dessiner();
}
