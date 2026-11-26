// L'atelier de déco : on choisit l'univers, la fenêtre, l'horloge, le calendrier, les attaches…
// Tout s'applique tout de suite, sur toutes les pages, et reste sur l'appareil.
import * as decor from './decor.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function choix(nom, l, val, apercu) {
  return l.map((o) => `<label class="choix-deco">
    <input type="radio" name="${nom}" value="${o.id}" ${o.id === val ? 'checked' : ''}>
    <span class="ap ap-${nom} ap-${o.id}" aria-hidden="true">${apercu(o)}</span>
    <span class="nm">${esc(o.nom)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}${o.credit ? `<small>${esc(o.credit)}</small>` : ''}</span>
  </label>`).join('');
}
function bascule(nom, val, titre, img) {
  return `<label class="choix-deco bascule">
    <input type="checkbox" name="${nom}" ${val ? 'checked' : ''}>
    <span class="ap ap-bascule" aria-hidden="true">${img}</span>
    <span class="nm">${titre}</span>
  </label>`;
}

export async function rendreAtelier(vue, { barre, pied, toast }) {
  const D = decor.DECO;
  const { teteAccueil } = await import('./accueil.js');
  const dessiner = () => {
    const d = decor.lireDecor();
    vue.innerHTML = `${barre('L’atelier de déco')}
    <section class="page atelier">
      <p class="atelier-intro">Tout ce que tu choisis ici s’applique tout de suite, sur toutes les pages. Sur l’accueil, un appui sur la vitre change la vue, un appui sur l’horloge change de cadran.</p>
      <div class="apercu-tete" aria-label="Aperçu de l’accueil">${teteAccueil()}</div>

      <fieldset class="bloc-deco"><legend>L’univers</legend>
        <p class="petit">Le papier peint de toutes les pages. Forêt dorée et Grunge passent en ambiance nuit, Patchwork et Rêverie en ambiance claire.</p>
        <div class="grille-deco large">${choix('univers', decor.UNIVERS, d.univers, () => '')}</div>
      </fieldset>

      <fieldset class="bloc-deco"><legend>La fenêtre</legend>
        <h2 class="sous-titre">Le cadre</h2>
        <div class="grille-deco">${choix('cadre', decor.CADRES, d.cadre, (o) => `<span class="mini-verre m-${o.id}"></span>`)}</div>
        <h2 class="sous-titre">La vue</h2>
        <div class="grille-deco">${choix('vue', decor.VUES, d.vue, (o) => (o.id === 'ciel' ? '<span class="mini-ciel"></span>' : `<img src="${D}vues/${o.id}-fixe.webp" alt="" loading="lazy">`))}</div>
        <h2 class="sous-titre">Les garnitures</h2>
        <div class="grille-deco">
          ${bascule('lierre', d.lierre, 'Lierre et lanternes', `<img src="${D}fenetre/lierre.webp" alt="" loading="lazy">`)}
          ${bascule('carillon', d.carillon, 'Le carillon (touche-le pour l’entendre)', `<img src="${D}fenetre/carillon.webp" alt="" loading="lazy">`)}
          ${bascule('fanions', d.fanions, 'La guirlande de fanions', `<img src="${D}papiers/fanion-2.webp" alt="" loading="lazy">`)}
        </div>
      </fieldset>

      <fieldset class="bloc-deco"><legend>L’horloge</legend>
        <div class="grille-deco">${choix('horloge', decor.HORLOGES, d.horloge, (o) => (o.id === 'laiton' ? '<span class="mini-laiton"></span>' : `<img src="${D}horloges/${o.id}.webp" alt="" loading="lazy">`))}</div>
      </fieldset>

      <fieldset class="bloc-deco"><legend>Le calendrier et l’éphéméride</legend>
        <div class="grille-deco">${choix('calendrier', decor.CALENDRIERS, d.calendrier, (o) => `<span class="mini-cal mc-${o.id}"${o.id === 'vitrail' ? ` style="--plaque:url('${D}calendrier/plaque.webp')"` : ''}><i></i></span>`)}</div>
        <div class="grille-deco">${choix('ephemeride', decor.EPHEMERIDES, d.ephemeride, (o) => `<span class="mini-eph me-${o.id}"><b>26</b></span>`)}</div>
      </fieldset>

      <fieldset class="bloc-deco"><legend>Les attaches</legend>
        <p class="petit">Ce qui tient les papiers au mur : sur l’accueil, les malles, la Boîte, les nouveautés.</p>
        <div class="grille-deco">${choix('attache', decor.ATTACHES, d.attache, (o) => `<span class="mini-papier" data-attache-demo="${o.id}"><span class="scotch" data-cle="demo-${o.id}"></span></span>`)}</div>
      </fieldset>

      <fieldset class="bloc-deco"><legend>Les petits plus</legend>
        <div class="grille-deco">
          ${bascule('stickers', d.stickers, 'Coller les stickers trouvés sur l’accueil', `<img src="${D}stickers/etoile-or.webp" alt="" loading="lazy">`)}
          ${bascule('sons', d.sons, 'Les clochettes (carillon, trésors)', `<img src="${D}stickers/etoile-filante.webp" alt="" loading="lazy">`)}
        </div>
      </fieldset>

      <div class="atelier-fin">
        <a class="btn" href="#/">Voir l’accueil</a>
        <button type="button" class="btn-sobre" data-remettre>Revenir au décor d’origine</button>
      </div>
    </section>${pied()}`;
  };
  dessiner();
  const rafraichirApercu = () => { const a = vue.querySelector('.apercu-tete'); if (a) a.innerHTML = teteAccueil(); };
  vue.onchange = (e) => {
    const i = e.target;
    if (!i.name) return;
    decor.ecrireDecor({ [i.name]: i.type === 'checkbox' ? i.checked : i.value });
    rafraichirApercu();
    if (i.name === 'carillon' && i.checked) decor.tinter(3);
  };
  vue.onclick = (e) => {
    const r = e.target.closest('[data-remettre]');
    if (r) {
      if (!r.classList.contains('sur')) {
        r.classList.add('sur'); r.textContent = 'Sûr ? Appuie encore';
        setTimeout(() => { if (r.isConnected) { r.classList.remove('sur'); r.textContent = 'Revenir au décor d’origine'; } }, 3000);
        return;
      }
      decor.remettreDecor(); dessiner(); toast('Décor d’origine remis');
      return;
    }
    if (e.target.closest('[data-carillon]')) { const c = e.target.closest('[data-carillon]'); c.classList.remove('tinte'); void c.offsetWidth; c.classList.add('tinte'); decor.tinter(); }
    if (e.target.closest('.apercu-tete [data-vue-suivante], .apercu-tete [data-horloge-suivante]')) {
      decor.suivant(e.target.closest('[data-vue-suivante]') ? 'vue' : 'horloge'); dessiner();
    }
  };
}
