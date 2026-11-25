// Le filtre coiffure : une coupe en 3D posée sur ton visage, en direct à la caméra (comme un filtre Snapchat),
// ou ta vraie chevelure recolorée. Marche sur PC et téléphone ; tout tourne sur l'appareil, rien n'est envoyé.
import * as THREE from '../../vendor/three/three.min.js';
import { Perruque, COUPES, TEINTES, Lisseur } from './cheveux.js';
import { $, $$, esc, toast } from '../../noyau/outils.js';

const URL_MP = new URL('../../vendor/mediapipe/vision_bundle.mjs', import.meta.url).href;
const URL_WASM = new URL('../../vendor/mediapipe/wasm', import.meta.url).href;
const URL_VISAGE = new URL('../../vendor/mediapipe/modeles/face_landmarker.task', import.meta.url).href;
const URL_CHEVEUX = new URL('../../vendor/mediapipe/modeles/hair_segmenter.tflite', import.meta.url).href;
const URL_MANNEQUIN = new URL('../../assets/loge/tete-mannequin.webp', import.meta.url).href;

// Le mannequin de la photo porte les coupes : pose de sa tête réglée à la main (cm, caméra à 63°).
const POSE_MANNEQUIN = new THREE.Matrix4().makeTranslation(-0.6, 11.2, -37.5);
const COTE_MAX = 960; // pixels du plus grand côté de l'image calculée (le A14 suit sans chauffer)

const VERT_FOND = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG_FOND = `
uniform sampler2D tImage; uniform sampler2D tMasque; uniform float actif; uniform vec3 cA; uniform vec3 cB; uniform float force;
varying vec2 vUv;
void main() {
  vec3 v = texture2D(tImage, vUv).rgb;
  float m = actif * smoothstep(0.25, 0.75, texture2D(tMasque, vec2(vUv.x, 1.0 - vUv.y)).r);
  float l = dot(v, vec3(0.299, 0.587, 0.114));
  vec3 teinte = mix(cA, cB, smoothstep(0.05, 0.55, l));
  vec3 r = teinte * (0.5 + 1.35 * l);
  r = mix(r, vec3(1.0), smoothstep(0.7, 1.0, l) * 0.35);
  gl_FragColor = vec4(mix(v, r, m * force), 1.0);
}`;
const srgb = (hex) => new THREE.Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

/* ---------- La cabine : fond (caméra, photo ou mannequin) + perruque ---------- */
class Cabine {
  constructor(toile) {
    this.toile = toile;
    this.rd = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.rd.autoClear = false;
    this.rd.setPixelRatio(1);
    this.camFond = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.masque = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
    this.masque.minFilter = this.masque.magFilter = THREE.LinearFilter; this.masque.needsUpdate = true;
    this.uFond = { tImage: { value: null }, tMasque: { value: this.masque }, actif: { value: 0 }, cA: { value: new THREE.Vector3() }, cB: { value: new THREE.Vector3() }, force: { value: 0.85 } };
    this.fond = new THREE.Scene();
    this.fond.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.uFond, vertexShader: VERT_FOND, fragmentShader: FRAG_FOND, depthTest: false, depthWrite: false })));
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(63, 1, 1, 1000);
    this.perruque = new Perruque();
    this.scene.add(this.perruque.groupe);
  }
  source(el, w, h) {
    const k = Math.min(1, COTE_MAX / Math.max(w, h));
    this.rd.setSize(Math.round(w * k), Math.round(h * k), false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    if (this.tex) this.tex.dispose();
    this.tex = el instanceof HTMLVideoElement ? new THREE.VideoTexture(el) : new THREE.CanvasTexture(el);
    this.tex.colorSpace = THREE.NoColorSpace; // couleurs gardées telles quelles (sRGB) pour le fond
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.uFond.tImage.value = this.tex;
  }
  poser(m) { this.perruque.groupe.matrix.copy(m); this.perruque.groupe.matrixWorldNeedsUpdate = true; }
  masqueCheveux(f32, w, h) {
    if (this.masque.image.width !== w || this.masque.image.height !== h) {
      this.masque.dispose();
      this.masque = new THREE.DataTexture(new Uint8Array(w * h), w, h, THREE.RedFormat);
      this.masque.minFilter = this.masque.magFilter = THREE.LinearFilter;
      this.uFond.tMasque.value = this.masque;
    }
    const d = this.masque.image.data;
    for (let i = 0; i < d.length; i++) d[i] = f32[i] * 255;
    this.masque.needsUpdate = true;
  }
  teinte(t) {
    this.perruque.changerTeinte(t);
    this.uFond.cA.value.copy(srgb(t.racine)); this.uFond.cB.value.copy(srgb(t.pointe));
  }
  rendre(avecPerruque = true) {
    this.rd.clear();
    this.rd.render(this.fond, this.camFond);
    if (avecPerruque) { this.rd.clearDepth(); this.rd.render(this.scene, this.cam); }
  }
}

/* ---------- Le mannequin (fond clair, posé comme sur un présentoir) ---------- */
let mannequinCache = null;
async function toileMannequin() {
  if (mannequinCache) return mannequinCache;
  const img = new Image(); img.src = URL_MANNEQUIN; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(c.width * 0.5, c.height * 0.32, 40, c.width * 0.5, c.height * 0.45, c.height * 0.75);
  g.addColorStop(0, '#efe3cf'); g.addColorStop(1, '#b59a78');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0);
  mannequinCache = c;
  return c;
}

/* ---------- Modèles MediaPipe (embarqués, chargés au premier usage) ---------- */
let modeles = null;
async function chargerVisage() {
  if (modeles?.visage) return modeles;
  const mp = await import(URL_MP);
  const fichiers = await mp.FilesetResolver.forVisionTasks(URL_WASM);
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: URL_VISAGE, delegate }, runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  let visage;
  try { visage = await mp.FaceLandmarker.createFromOptions(fichiers, opts('GPU')); }
  catch { visage = await mp.FaceLandmarker.createFromOptions(fichiers, opts('CPU')); }
  modeles = { mp, fichiers, visage, cheveux: modeles?.cheveux };
  return modeles;
}
async function chargerCheveux() {
  const m = await chargerVisage();
  if (m.cheveux) return m;
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: URL_CHEVEUX, delegate }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
  try { m.cheveux = await m.mp.ImageSegmenter.createFromOptions(m.fichiers, opts('GPU')); }
  catch { m.cheveux = await m.mp.ImageSegmenter.createFromOptions(m.fichiers, opts('CPU')); }
  return m;
}

/* ---------- Vignettes : le mannequin coiffé de chaque coupe ---------- */
async function vignettes(store, teinte, surVignette) {
  const cle = `loge.vignettes.v1.${teinte.id}`;
  const deja = await store.lireMeta(cle).catch(() => null);
  if (deja && typeof deja === 'object') { for (const [id, url] of Object.entries(deja)) surVignette(id, url); if (COUPES.every((c) => deja[c.id])) return; }
  const fond = await toileMannequin();
  const toile = document.createElement('canvas');
  const cab = new Cabine(toile);
  cab.source(fond, 236, 450);
  cab.rd.setSize(170, 324, false);
  cab.teinte(teinte); cab.poser(POSE_MANNEQUIN);
  const faites = { ...(deja || {}) };
  for (const c of COUPES) {
    if (faites[c.id]) continue;
    await new Promise((r) => setTimeout(r, 30));
    cab.perruque.changerCoupe(c.id);
    cab.rendre();
    faites[c.id] = toile.toDataURL('image/webp', 0.8);
    surVignette(c.id, faites[c.id]);
  }
  cab.rd.dispose(); cab.rd.forceContextLoss();
  store.ecrireMeta(cle, faites).catch(() => {});
}

/* ---------- L'écran ---------- */
const MECHE = '<svg viewBox="0 0 40 64" aria-hidden="true"><path d="M20 3c9 5 14 16 11 30-2 9-1 18 3 27-9-3-15-11-16-22C17 26 9 18 6 10c5 2 10 0 14-7z"/></svg>';

export async function ouvrir(vue, { store, retour }) {
  let coupe = (await store.lireMeta('loge.filtre.coupe').catch(() => null)) || 'frange';
  let teinte = TEINTES.find((t) => t.id === (localStorage.getItem('grenier.loge.teinte') || 'chatain')) || TEINTES[2];
  let mode = 'coupe';
  vue.innerHTML = `<section class="rayon filtre">
    <div class="rayon-tete"><h2>Le filtre</h2><a class="btn btn-sobre" href="#coiffure">Retour au miroir</a></div>
    <div class="cabine">
      <svg class="cabine-ampoules" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">${[8, 30, 52, 74, 96, 118].map((y) => `<circle cx="3" cy="${y + 8}" r="2.6"/><circle cx="97" cy="${y + 8}" r="2.6"/>`).join('')}</svg>
      <div class="cabine-glace">
        <canvas id="f-toile" aria-label="Aperçu du filtre"></canvas>
        <p class="cabine-etat" id="f-etat" role="status">Le mannequin porte la coupe. Allume la caméra pour l’essayer sur toi.</p>
        <button type="button" class="cabine-retourner" id="f-retourner" hidden aria-label="Changer de caméra">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/></svg>
        </button>
      </div>
      <div class="cabine-commandes">
        <label class="btn-sobre cabine-photo"><input type="file" id="f-fichier" class="fichier-cache" accept="image/*">Une photo</label>
        <button type="button" class="declencheur" id="f-declencheur" aria-label="Allumer la caméra"><span></span></button>
        <button type="button" class="btn-sobre" id="f-arreter" hidden>Éteindre</button>
      </div>
    </div>
    <div class="filtre-modes" role="radiogroup" aria-label="Type de filtre">
      <button type="button" role="radio" aria-checked="true" data-mode="coupe">Coupe 3D</button>
      <button type="button" role="radio" aria-checked="false" data-mode="couleur">Couleur seule</button>
    </div>
    <h3 class="filtre-titre" id="f-titre-coupes">L’étagère à perruques</h3>
    <div class="etagere-tetes" id="f-coupes" role="radiogroup" aria-labelledby="f-titre-coupes">${COUPES.map((c) => `
      <button type="button" role="radio" aria-checked="${c.id === coupe}" data-coupe="${c.id}">
        <span class="tete-vignette"><img alt="" src="${URL_MANNEQUIN}" data-v="${c.id}"></span><span class="tete-nom">${esc(c.nom)}</span>
      </button>`).join('')}</div>
    <h3 class="filtre-titre" id="f-titre-teintes">Les mèches</h3>
    <div class="meches" id="f-teintes" role="radiogroup" aria-labelledby="f-titre-teintes">${TEINTES.map((t) => `
      <button type="button" role="radio" aria-checked="${t.id === teinte.id}" data-teinte="${t.id}" style="--a:${t.racine};--b:${t.pointe}" aria-label="${esc(t.nom)}">${MECHE}<span>${esc(t.nom)}</span></button>`).join('')}</div>
    <div class="filtre-reglages" id="f-reglages">
      <label class="reglage"><span>Taille</span><input type="range" id="f-taille" min="0.9" max="1.15" step="0.01" value="1"></label>
      <label class="reglage"><span>Hauteur</span><input type="range" id="f-hauteur" min="-1.5" max="1.5" step="0.1" value="0"></label>
      <label class="reglage" id="f-force-l" hidden><span>Intensité</span><input type="range" id="f-force" min="0.3" max="1" step="0.05" value="0.85"></label>
    </div>
    <p class="petit">Tout se calcule sur ton appareil : l’image de la caméra ne quitte jamais le Grenier. Les photos prises vont dans le miroir.</p>
  </section>`;

  const toile = $('#f-toile');
  const etat = (t) => { $('#f-etat').textContent = t; $('#f-etat').hidden = !t; };
  let cab;
  try { cab = new Cabine(toile); }
  catch { etat('Ton navigateur ne sait pas afficher la 3D ici (WebGL coupé).'); return; }
  const lisseur = new Lisseur();
  let flux = null, video = null, photo = null, miroir = false, facing = 'user';
  let boucle = 0, perdu = 0, derniere = -1, image = 0, prendre = false, actif = true;

  const appliquer = () => {
    cab.perruque.changerCoupe(coupe);
    cab.teinte(teinte);
    cab.perruque.regler(+$('#f-taille').value, +$('#f-hauteur').value);
    cab.uFond.force.value = +$('#f-force').value;
  };
  async function montrerMannequin() {
    const c = await toileMannequin();
    cab.source(c, c.width, c.height);
    cab.poser(POSE_MANNEQUIN);
    cab.perruque.visible = mode === 'coupe';
    miroir = false; toile.classList.remove('retourne');
    appliquer(); cab.rendre();
  }
  appliquer();
  await montrerMannequin();
  vignettes(store, teinte, (id, url) => { const im = vue.querySelector(`img[data-v="${id}"]`); if (im) im.src = url; });

  function eclairage(src, w, h) {
    const c = eclairage.c || (eclairage.c = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }));
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, w, h, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4 * 255;
    cab.perruque.eclairer(r / n, g / n, b / n);
  }

  async function tour() {
    if (!actif || !toile.isConnected) return arreter();
    const src = video || photo;
    if (src) {
      const t = performance.now();
      const pret = video ? video.readyState >= 2 && video.currentTime !== derniere : !photo.fait;
      if (pret && modeles) {
        if (video) derniere = video.currentTime;
        try {
          if (mode === 'coupe') {
            const r = modeles.visage.detectForVideo(src, t);
            if (r.facialTransformationMatrixes?.length) { cab.poser(lisseur.pousser(r.facialTransformationMatrixes[0].data)); cab.perruque.visible = true; perdu = 0; etat(''); if (photo) photo.fait = true; }
            else if (++perdu > 6) {
              cab.perruque.visible = false; lisseur.oublier();
              if (photo) { photo.fait = true; etat('Aucun visage trouvé sur cette photo. Essaie une photo de face, bien éclairée.'); }
              else etat('Je ne vois pas de visage. Regarde l’objectif, avec de la lumière devant toi.');
            }
          } else if (modeles.cheveux) {
            const r = modeles.cheveux.segmentForVideo(src, t);
            const m = r.confidenceMasks?.[1] || r.confidenceMasks?.[0];
            if (m) cab.masqueCheveux(m.getAsFloat32Array(), m.width, m.height);
            r.close?.();
            if (photo) photo.fait = true;
          }
        } catch (e) { console.warn(e); if (photo) photo.fait = true; }
        if (image++ % 20 === 0) eclairage(src, video ? video.videoWidth : photo.width, video ? video.videoHeight : photo.height);
      }
    }
    cab.rendre(mode === 'coupe');
    if (prendre) { prendre = false; garderPhoto(); }
    boucle = requestAnimationFrame(tour);
  }

  function garderPhoto() {
    const c = document.createElement('canvas'); c.width = toile.width; c.height = toile.height;
    const x = c.getContext('2d');
    if (miroir) { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(toile, 0, 0);
    c.toBlob(async (blob) => {
      if (!blob) return;
      const nom = mode === 'coupe' ? `${COUPES.find((k) => k.id === coupe).nom}, ${teinte.nom.toLowerCase()}` : `Couleur ${teinte.nom.toLowerCase()}`;
      await store.ajouter({ malle: 'loge', type: 'coiffure', categorie: 'Essai', titre: nom, fichier: blob, notes: 'Photo prise avec le filtre' });
      const g = $('.cabine-glace');
      if (g) { g.classList.remove('eclair'); void toile.offsetWidth; g.classList.add('eclair'); }
      navigator.vibrate?.(15);
      toast('Photo rangée dans le miroir');
    }, 'image/jpeg', 0.9);
  }

  async function allumer() {
    if (!navigator.mediaDevices?.getUserMedia) { etat('Pas de caméra ici : choisis plutôt une photo.'); return; }
    etat('J’allume la caméra…');
    try {
      flux?.getTracks().forEach((t) => t.stop());
      flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      etat(e.name === 'NotAllowedError' ? 'La caméra est refusée. Autorise-la dans le navigateur, ou choisis une photo.' : 'Caméra introuvable. Choisis plutôt une photo.');
      return;
    }
    video = video || Object.assign(document.createElement('video'), { muted: true, playsInline: true });
    video.setAttribute('playsinline', '');
    video.srcObject = flux;
    await video.play();
    photo = null;
    const reglages = flux.getVideoTracks()[0].getSettings?.() || {};
    miroir = (reglages.facingMode || facing) !== 'environment';
    toile.classList.toggle('retourne', miroir);
    cab.source(video, video.videoWidth, video.videoHeight);
    lisseur.oublier(); cab.perruque.visible = false;
    etat('Je prépare le filtre…');
    try { await (mode === 'couleur' ? chargerCheveux() : chargerVisage()); }
    catch (e) { console.warn(e); etat('Le filtre n’a pas pu démarrer sur cet appareil.'); return; }
    etat('');
    $('#f-declencheur').setAttribute('aria-label', 'Prendre la photo');
    $('#f-declencheur').classList.add('pret');
    $('#f-arreter').hidden = false;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    $('#f-retourner').hidden = cams.length < 2;
    cancelAnimationFrame(boucle); boucle = requestAnimationFrame(tour);
  }
  function eteindre() {
    flux?.getTracks().forEach((t) => t.stop()); flux = null;
    if (video) video.srcObject = null;
    video = null;
    if (!toile.isConnected) return;
    $('#f-declencheur').classList.remove('pret'); $('#f-declencheur').setAttribute('aria-label', 'Allumer la caméra');
    $('#f-arreter').hidden = true; $('#f-retourner').hidden = true;
  }
  function arreter() {
    actif = false; cancelAnimationFrame(boucle); eteindre();
    window.removeEventListener('hashchange', surNav);
    document.removeEventListener('visibilitychange', surVisibilite);
  }
  const surNav = () => { if (!location.hash.startsWith('#coiffure/filtre')) arreter(); };
  const surVisibilite = () => { if (!toile.isConnected) return arreter(); if (document.hidden && flux) { eteindre(); cancelAnimationFrame(boucle); montrerMannequin(); etat('Caméra éteinte pendant ton absence.'); } };
  window.addEventListener('hashchange', surNav);
  document.addEventListener('visibilitychange', surVisibilite);

  async function utiliserPhoto(fichier) {
    eteindre(); cancelAnimationFrame(boucle);
    const bmp = await createImageBitmap(fichier);
    const k = Math.min(1, COTE_MAX / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    photo = c; photo.fait = false; miroir = false; toile.classList.remove('retourne');
    cab.source(c, c.width, c.height);
    lisseur.oublier(); cab.perruque.visible = false;
    etat('Je cherche ton visage…');
    try { await (mode === 'couleur' ? chargerCheveux() : chargerVisage()); }
    catch (e) { console.warn(e); etat('Le filtre n’a pas pu démarrer sur cet appareil.'); return; }
    perdu = 0;
    $('#f-declencheur').classList.add('pret'); $('#f-declencheur').setAttribute('aria-label', 'Garder la photo');
    boucle = requestAnimationFrame(tour);
  }

  // commandes
  $('#f-declencheur').addEventListener('click', () => { if ($('#f-declencheur').classList.contains('pret')) prendre = true; else allumer(); });
  $('#f-arreter').addEventListener('click', () => { eteindre(); cancelAnimationFrame(boucle); montrerMannequin(); etat('Caméra éteinte.'); });
  $('#f-retourner').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; allumer(); });
  $('#f-fichier').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) utiliserPhoto(f); e.target.value = ''; });
  $('#f-coupes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-coupe]'); if (!b) return;
    coupe = b.dataset.coupe; $$('#f-coupes [data-coupe]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    store.ecrireMeta('loge.filtre.coupe', coupe).catch(() => {});
    if (mode !== 'coupe') choisirMode('coupe');
    appliquer(); if (photo) photo.fait = false; if (!video && !photo) cab.rendre();
  });
  $('#f-teintes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-teinte]'); if (!b) return;
    teinte = TEINTES.find((t) => t.id === b.dataset.teinte);
    $$('#f-teintes [data-teinte]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    localStorage.setItem('grenier.loge.teinte', teinte.id);
    cab.teinte(teinte); if (!video && !photo) cab.rendre();
    vignettes(store, teinte, (id, url) => { const im = vue.querySelector(`img[data-v="${id}"]`); if (im) im.src = url; });
  });
  for (const id of ['#f-taille', '#f-hauteur', '#f-force']) $(id).addEventListener('input', () => { appliquer(); if (!video && !photo) cab.rendre(); });
  async function choisirMode(m) {
    mode = m;
    $$('.filtre-modes [data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.mode === m)));
    cab.uFond.actif.value = m === 'couleur' ? 1 : 0;
    $('#f-force-l').hidden = m !== 'couleur';
    $('#f-taille').closest('label').hidden = $('#f-hauteur').closest('label').hidden = m === 'couleur';
    if (m === 'couleur' && (video || photo)) { etat('Je repère tes cheveux…'); try { await chargerCheveux(); etat(''); } catch { etat('La couleur seule ne marche pas sur cet appareil.'); } if (photo) photo.fait = false; }
    if (m === 'coupe' && photo) photo.fait = false;
    if (!video && !photo) { cab.perruque.visible = m === 'coupe'; cab.rendre(m === 'coupe'); if (m === 'couleur') etat('La couleur seule teint tes vrais cheveux : allume la caméra ou choisis une photo.'); }
  }
  $('.filtre-modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) choisirMode(b.dataset.mode); });
}
