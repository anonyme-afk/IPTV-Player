/**
 * IPTV Player — App.js
 * Orchestrateur principal. Gere l'etat, le rendu et la coordination des modules.
 */

'use strict';

/* ══════════════════════════════════════════
   ETAT GLOBAL
══════════════════════════════════════════ */
const App = {
  state: {
    channels:    [],      // tableau complet des chaines chargees
    filtered:    [],      // sous-ensemble apres filtre/recherche
    currentIdx:  -1,      // index dans filtered de la chaine en lecture
    currentCat:  'Tous',  // categorie selectionnee
    currentTab:  'all',   // onglet actif : all | fav | hist
    currentSource: '',    // label de la source chargee
    volume:      1,
    muted:       false,
    searchQuery: '',
    renderLimit: 50
  }
};

/* ══════════════════════════════════════════
   INITIALISATION
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Garder la logique init existante, juste reorganiser
  initTheme();
  initSearch();
  initCatsScroll();
  initSidebar();
  initModal();
  initKeyboard();
  registerServiceWorker();
  
  if (typeof Storage !== 'undefined' && Storage.restoreSession) {
    Storage.restoreSession();
  }
});

/* ══════════════════════════════════════════
   THEME
══════════════════════════════════════════ */
const ThemeManager = {
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.setAttribute('data-lucide', theme === 'light' ? 'sun' : 'moon');
      if (window.lucide) lucide.createIcons({ nodes: [icon.parentElement] });
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f8fafc' : '#070a0f';
  },
  toggle() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    // PAS de sauvegarde — revient toujours au sombre au rechargement
    this.apply(cur === 'dark' ? 'light' : 'dark');
  },
  init() {
    this.apply('dark');
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggle());
  }
};

function initTheme() { ThemeManager.init(); }

/* ══════════════════════════════════════════
   RECHERCHE
══════════════════════════════════════════ */
function initSearch() {
  const input = document.getElementById('search');
  const clear = document.getElementById('search-clear');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      App.state.searchQuery = input.value.trim();
      if (clear) clear.hidden = !App.state.searchQuery;
      App.renderList();
    }, 250);
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    App.state.searchQuery = '';
    clear.hidden = true;
    App.renderList();
    input.focus();
  });
}

/* ══════════════════════════════════════════
   SCROLL CATEGORIES
══════════════════════════════════════════ */
function initCatsScroll() {
  const wrap = document.getElementById('cats-wrap');
  const cats = document.getElementById('cats');
  const prev = document.getElementById('cats-prev');
  const next = document.getElementById('cats-next');
  if (!cats || !wrap) return;

  let _scrollTimer;
  function update() {
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => {
      const overflow = cats.scrollWidth > cats.clientWidth + 4;
      const atStart  = cats.scrollLeft <= 4;
      const atEnd    = cats.scrollLeft >= cats.scrollWidth - cats.clientWidth - 4;
      wrap.classList.toggle('has-overflow', overflow);
      wrap.classList.toggle('can-scroll-left',  overflow && !atStart);
      wrap.classList.toggle('can-scroll-right', overflow && !atEnd);
    }, 50);
  }

  prev?.addEventListener('click', () => cats.scrollBy({ left: -180, behavior: 'smooth' }));
  next?.addEventListener('click', () => cats.scrollBy({ left:  180, behavior: 'smooth' }));
  cats.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window._updateCatsScroll = () => {
    update();
    const active = cats.querySelector('.cat-btn.active');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  update();
}

/* ══════════════════════════════════════════
   SIDEBAR MOBILE
══════════════════════════════════════════ */
function initSidebar() {
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay?.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function initModal() {
  const bg = document.getElementById('modal-bg');
  bg?.addEventListener('click', e => {
    if (e.target === bg) App.closeModal();
  });

  // Init onglets modal interne
  document.querySelectorAll('.m-tab').forEach((tab, i) => {
    tab.dataset.mtab = ['url','file','text'][i] ?? 'url';
  });

  // Ecouter fichier M3U local
  const fileInput = document.getElementById('m3u-file');
  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.[0]) App.loadFromInput();
  });
}

App.openModal = function() {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = false;
  // Remplir les onglets statiques au premier chargement
  initStaticTabs();
};

App.closeModal = function() {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = true;
};

/* ══════════════════════════════════════════
   ONGLETS (Tous / Favoris / Historique)
══════════════════════════════════════════ */
App.setTab = function(tab, btn) {
  App.state.currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
  });
  App.renderList();
};

/* ══════════════════════════════════════════
   ONGLETS PRESET (modal)
══════════════════════════════════════════ */
App.switchPresetTab = function(tab, btn) {
  document.querySelectorAll('.ptab').forEach(b => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
  });
  document.querySelectorAll('.preset-grid').forEach(g => {
    const isActive = g.dataset.ptab === tab;
    g.classList.toggle('preset-grid--active', isActive);
    g.style.display = isActive ? 'grid' : 'none';
  });
  // Charger contenu dynamique si besoin
  if (['popular', 'languages', 'regions'].includes(tab)) initStaticTabs();
  if (tab === 'countries') loadFamelackCountriesTab();
  if (tab === 'categories') loadFamelackCategoriesTab();
};

App.switchModalTab = function(tab, btn) {
  document.querySelectorAll('.m-tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.mtab-panel').forEach(p => {
    p.classList.toggle('mtab-panel--active', p.id === `mtab-${tab}`);
  });
};

/* ══════════════════════════════════════════
   CHARGEMENT PLAYLISTS
══════════════════════════════════════════ */
App.loadFromInput = async function() {
  // Lire depuis l'onglet actif (url / file / text)
  const activeTab = document.querySelector('.m-tab.active')?.dataset.mtab || 'url';
  let text = '';
  let sourceLabel = 'Personnalise';

  if (activeTab === 'url') {
    let url = document.getElementById('m3u-url')?.value.trim();
    if (!url) return;
    // Convertir URL GitHub blob -> raw
    url = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    sourceLabel = url.split('/').pop() || url;
    App.showStatus('loading', `Telechargement : ${sourceLabel}...`);
    App.showProgress(0, `Connexion a ${sourceLabel}...`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // JSON famelack ou M3U ?
      if (typeof Parser !== 'undefined' && Parser.isFamelackJSON && Parser.isFamelackJSON(url)) {
        const json = await res.json();
        await App._loadChannels(Parser.parseJSON(json), sourceLabel);
      } else {
        text = await res.text();
        await App._loadChannels(Parser.parse(text), sourceLabel);
      }
    } catch(e) {
      App.showStatus('error', `Erreur : ${e.message}`);
      App.hideProgress();
    }

  } else if (activeTab === 'file') {
    const file = document.getElementById('m3u-file')?.files?.[0];
    if (!file) return;
    sourceLabel = file.name;
    App.showProgress(0, `Lecture de ${file.name}...`);
    text = await file.text();
    await App._loadChannels(Parser.parse(text), sourceLabel);

  } else {
    text = document.getElementById('m3u-text')?.value.trim();
    if (!text) return;
    await App._loadChannels(Parser.parse(text), sourceLabel);
  }
};

App._loadChannels = async function(channels, label = '') {
  if (!channels.length) {
    App.showStatus('error', 'Aucune chaine trouvee dans cette source.');
    App.hideProgress();
    return;
  }
  App.state.channels = channels;
  App.state.filtered = [...channels];
  App.state.currentSource = label;
  App.state.currentCat = 'Tous';
  App.state.searchQuery = '';
  const search = document.getElementById('search');
  if (search) search.value = '';
  App.closeModal();
  App.renderCategories();
  App.renderList();
  App.showStatus('ok', `${channels.length} chaines chargees — ${label}`);
  App.hideProgress();
  setTimeout(() => App.hideStatus(), 4000);
  const src = document.getElementById('ch-source');
  if (src) { src.textContent = label; src.title = label; }
};

/* Preset iptv-org M3U */
App.usePreset = async function(url, label = '') {
  const name = label || url.split('/').pop() || url;
  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = true;
  App.showStatus('loading', `Chargement : ${name}...`);
  App.showProgress(0, `Connexion a ${name}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    App.showProgress(50, 'Analyse de la playlist...');
    const text = await res.text();
    await App._loadChannels(Parser.parse(text), name);
  } catch(e) {
    App.showStatus('error', `Erreur : ${e.message}`);
    App.hideProgress();
  }
};

/* ══════════════════════════════════════════
   RENDU CATEGORIES
══════════════════════════════════════════ */
App.renderCategories = function() {
  const cats = document.getElementById('cats');
  if (!cats) return;
  const groups = ['Tous', ...new Set(App.state.channels.map(c => c.group || 'Divers'))].slice(0, 50);
  cats.innerHTML = groups.map(g => `
    <button
      class="cat-btn ${g === App.state.currentCat ? 'active' : ''}"
      onclick="App.selectCategory(this.dataset.cat)"
      data-cat="${escHtml(g)}"
      role="tab"
      aria-selected="${g === App.state.currentCat}"
    >${escHtml(g)}</button>
  `).join('');
  if (typeof window._updateCatsScroll === 'function') window._updateCatsScroll();
};

App.selectCategory = function(cat) {
  App.state.currentCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === cat);
    b.setAttribute('aria-selected', b.textContent === cat);
  });
  App.renderList();
};

/* ══════════════════════════════════════════
   RENDU LISTE
══════════════════════════════════════════ */
App.renderList = function(append = false) {
  const list = document.getElementById('ch-list');
  if (!list) return;

  if (!append) {
    App.state.renderLimit = 50;
  }

  const q = App.state.searchQuery.toLowerCase();
  let src = App.state.channels;

  // Filtre onglet
  if (App.state.currentTab === 'fav') {
    const favs = (typeof Storage !== 'undefined' && Storage.getFavorites) ? Storage.getFavorites() : (window.Store ? window.Store.get('iptv_favs', []) : []);
    src = App.state.channels.filter(c => favs.includes(c.url));
  } else if (App.state.currentTab === 'hist') {
    const hist = (typeof Storage !== 'undefined' && Storage.getHistory) ? Storage.getHistory() : (window.Store ? window.Store.get('iptv_hist', []) : []);
    src = hist.map(u => App.state.channels.find(c => c.url === u)).filter(Boolean);
  } else if (App.state.currentCat !== 'Tous') {
    src = App.state.channels.filter(c => (c.group || 'Divers') === App.state.currentCat);
  }

  // Filtre recherche
  if (q) {
    src = src.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.group || '').toLowerCase().includes(q)
    );
  }

  App.state.filtered = src;

  // Compteur
  const cnt = document.getElementById('ch-count');
  if (cnt) cnt.textContent = `${src.length} chaine${src.length > 1 ? 's' : ''}`;

  // Etat vide
  if (!src.length) {
    list.innerHTML = `
      <div class="ch-empty-state fade-in">
        <i data-lucide="${App.state.channels.length ? 'search-x' : 'tv-off'}"></i>
        <p>${App.state.channels.length ? 'Aucune chaine trouvee' : 'Aucune chaine chargee'}</p>
        ${!App.state.channels.length ? '<p class="ch-empty-sub">Clique sur <strong>Charger</strong></p>' : ''}
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [list] });
    return;
  }

  const favs = (typeof Storage !== 'undefined' && Storage.getFavorites) ? Storage.getFavorites() : (window.Store ? window.Store.get('iptv_favs', []) : []);

  const startIndex = append ? App.state.renderLimit - 50 : 0;
  const toRender = src.slice(startIndex, App.state.renderLimit);

  const html = toRender.map((ch, idx) => {
    const i = startIndex + idx;
    const isCurrent = i === App.state.currentIdx;
    const isFav = favs.includes(ch.url);
    const isRadio = ch.is_radio || (ch.url || '').toLowerCase().endsWith('.mp3');
    const radioClass = isRadio ? ' playing-radio' : '';
    
    // XSS PROTECTION: ensure all dynamic data is escaped and sanitized
    const safeName  = escHtml(ch.name || 'Unnamed');
    const safeGroup = escHtml(ch.group || 'Divers');
    const safeLogo  = escHtml(ch.logo || '');
    const safeUrl   = escHtml(ch.url || '');

    const logo = safeLogo
      ? `<img class="ch-logo" src="${safeLogo}" alt="" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const fallback = `<div class="ch-logo-fallback" style="${safeLogo ? 'display:none' : ''}">
      ${Icons.get(isRadio ? 'radio' : 'tv-2')}
    </div>`;

    return `<div
      class="ch-item ${isCurrent ? 'active playing' : ''}${radioClass} fade-in"
      role="option"
      aria-selected="${isCurrent}"
      onclick="App.playChannel(${i})"
      tabindex="0"
      data-nav
      data-idx="${i}"
    >
      <span class="ch-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="ch-logo-wrap">${logo}${fallback}</div>
      <div class="ch-info">
        <div class="ch-name">${safeName}</div>
        <div class="ch-group">${safeGroup}</div>
      </div>
      ${isCurrent ? `<div class="ch-equalizer">
        <span></span><span></span><span></span>
      </div>` : ''}
      <button
        class="fav-btn ${isFav ? 'faved' : ''}"
        onclick="App.toggleFav(event, this.dataset.url)"
        data-url="${safeUrl}"
        aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
        title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
      >
        ${Icons.get('star')}
      </button>
    </div>`;
  }).join('');

  if (append) {
    const sentinel = document.getElementById('ch-list-sentinel');
    if (sentinel) sentinel.remove();
    list.insertAdjacentHTML('beforeend', html);
  } else {
    list.innerHTML = html;
  }

  if (App.state.renderLimit < src.length) {
    list.insertAdjacentHTML('beforeend', `<div id="ch-list-sentinel" style="height:20px;"></div>`);
  }

  const nextSentinel = document.getElementById('ch-list-sentinel');
  if (nextSentinel) {
    if (App._listObserver) App._listObserver.disconnect();
    App._listObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        App.state.renderLimit += 50;
        App.renderList(true);
      }
    }, { root: list, rootMargin: '200px' });
    App._listObserver.observe(nextSentinel);
  }

  // Scroll vers la chaine active
  if (!append) {
    const active = list.querySelector('.ch-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }
};

/* ══════════════════════════════════════════
   LECTURE
══════════════════════════════════════════ */
App.playChannel = function(idx) {
  if (idx < 0 || idx >= App.state.filtered.length) return;
  App.state.currentIdx = idx;
  const ch = App.state.filtered[idx];

  // Masquer overlay, banniere, stats
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'none';
  if (typeof Player !== 'undefined' && Player.hideGeoBanner) Player.hideGeoBanner();
  hideStats();

  // Now playing
  updateNowPlaying(ch);

  // Historique
  if (typeof Storage !== 'undefined' && Storage.addToHistory) Storage.addToHistory(ch.url);

  // Relire la liste pour mettre a jour l'indicateur
  App.renderList();

  // Lancer le player
  if (typeof Player !== 'undefined' && Player.play) Player.play(ch);

  // Fermer sidebar sur mobile
  closeSidebar();

  // Verifier geoblocage
  setTimeout(() => checkGeoBlock(ch), 2000);
};

App.prevChannel = function() {
  if (!App.state.filtered.length) return;
  const ni = App.state.currentIdx <= 0
    ? App.state.filtered.length - 1
    : App.state.currentIdx - 1;
  App.playChannel(ni);
};

App.nextChannel = function() {
  if (!App.state.filtered.length) return;
  const ni = App.state.currentIdx >= App.state.filtered.length - 1
    ? 0
    : App.state.currentIdx + 1;
  App.playChannel(ni);
};

App.stopStream = function() {
  if (typeof Player !== 'undefined' && Player.stop) Player.stop();
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'flex';
  const np = document.getElementById('now-playing');
  if (np) np.hidden = true;
  App.state.currentIdx = -1;
  App.renderList();
};

App.playDirectUrl = function() {
  const url = document.getElementById('url-input')?.value.trim();
  if (!url) return;
  const ch = { name: 'URL directe', group: 'URL', logo: '', url, id: '' };
  if (typeof Player !== 'undefined' && Player.play) Player.play(ch);
};

/* Compatibility wrapper for shortcuts mapped to App.playAt */
App.playAt = function(idx) {
  App.playChannel(idx);
};

/* ══════════════════════════════════════════
   VOLUME
══════════════════════════════════════════ */
App.setVolume = function(v) {
  App.state.volume = parseFloat(v);
  App.state.muted = App.state.volume === 0;
  const video = document.getElementById('video');
  if (video) video.volume = App.state.volume;
  updateVolIcon();
};

App.toggleMute = function() {
  App.state.muted = !App.state.muted;
  const video = document.getElementById('video');
  if (video) video.muted = App.state.muted;
  const slider = document.getElementById('vol-slider');
  if (slider) slider.value = App.state.muted ? 0 : App.state.volume;
  updateVolIcon();
};

function updateVolIcon() {
  const icon = document.getElementById('vol-icon');
  if (!icon) return;
  const v = App.state.muted ? 0 : App.state.volume;
  const name = v === 0 ? 'volume-x' : v < 0.5 ? 'volume-1' : 'volume-2';
  icon.setAttribute('data-lucide', name);
  if (window.lucide) lucide.createIcons({ nodes: [icon.parentElement] });
}

/* ══════════════════════════════════════════
   PLEIN ECRAN / PiP / CAPTURE
══════════════════════════════════════════ */
App.toggleFullscreen = function() {
  const wrap = document.getElementById('video-wrap');
  const video = document.getElementById('video');
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
  } else {
    if (wrap.requestFullscreen) {
      wrap.requestFullscreen();
    } else if (wrap.webkitRequestFullscreen) {
      wrap.webkitRequestFullscreen();
    } else if (video && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  }
};

App.togglePiP = async function() {
  const video = document.getElementById('video');
  if (!video) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await video.requestPictureInPicture();
    }
  } catch(e) { console.warn('PiP:', e); }
};

App.captureFrame = function() {
  const video = document.getElementById('video');
  if (!video || video.readyState < 2) return;
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const a = document.createElement('a');
  a.download = `iptv-capture-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
};

/* ══════════════════════════════════════════
   STATS TEMPS REEL
══════════════════════════════════════════ */
let _statsInterval = null;
App.toggleStats = function() {
  const overlay = document.getElementById('stats-overlay');
  if (!overlay) return;
  overlay.hidden = !overlay.hidden;
  if (!overlay.hidden) {
    if (!_statsInterval) _statsInterval = setInterval(updateStats, 1000);
    updateStats();
  } else {
    clearInterval(_statsInterval);
    _statsInterval = null;
  }
};

function hideStats() {
  const overlay = document.getElementById('stats-overlay');
  if (overlay) overlay.hidden = true;
  clearInterval(_statsInterval);
  _statsInterval = null;
}

function updateStats() {
  const content = document.getElementById('stats-content');
  const video = document.getElementById('video');
  if (!content || !video) return;
  const hls = (typeof Player !== 'undefined') ? Player.hls : null;
  const level = hls?.levels?.[hls?.currentLevel];
  const bw = hls && hls.bandwidthEstimate ? Math.round(hls.bandwidthEstimate / 1000) : '—';
  const buf = video.buffered.length
    ? (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(1)
    : '0';
  content.innerHTML = [
    ['Resolution', level ? `${level.width}x${level.height}` : '—'],
    ['Bande passante', bw !== '—' ? `${bw} kbps` : '—'],
    ['Buffer',  `${buf}s`],
    ['Niveau', hls?.currentLevel >= 0 ? `#${hls.currentLevel}` : 'auto'],
    ['FPS', video.webkitDecodedFrameCount ?? '—'],
  ].map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
}

/* ══════════════════════════════════════════
   FAVORIS
══════════════════════════════════════════ */
App.toggleFav = function(e, url) {
  e.stopPropagation();
  if (typeof Storage !== 'undefined' && Storage.toggleFavorite) {
    Storage.toggleFavorite(url);
  } else if (window.Store) {
    let favs = window.Store.get('iptv_favs', []);
    const idx = favs.indexOf(url);
    if (idx === -1) favs.push(url); else favs.splice(idx, 1);
    window.Store.set('iptv_favs', favs);
  }
  App.renderList();
};

/* ══════════════════════════════════════════
   STATUTS
══════════════════════════════════════════ */
App.showStatus = function(type, msg) {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  bar.className = type;
  bar.textContent = msg;
};
App.hideStatus = function() {
  const bar = document.getElementById('status-bar');
  if (bar) { bar.className = ''; bar.textContent = ''; }
};

App.showProgress = function(pct, msg) {
  const prog = document.getElementById('modal-progress');
  const fill = document.getElementById('modal-progress-fill');
  const text = document.getElementById('modal-progress-text');
  if (!prog) return;
  prog.hidden = false;
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = msg || '';
};
App.hideProgress = function() {
  const prog = document.getElementById('modal-progress');
  if (prog) prog.hidden = true;
};

/* ══════════════════════════════════════════
   GEOBLOCAGE
══════════════════════════════════════════ */
function showGeoBanner() {
  const b = document.getElementById('geo-banner');
  if (b) b.hidden = false;
}
function hideGeoBanner() {
  const b = document.getElementById('geo-banner');
  if (b) b.hidden = true;
}
document.getElementById('geo-close')?.addEventListener('click', hideGeoBanner);

function checkGeoBlock(ch) {
  if (!ch) return;
  const n = (ch.name || '').toLowerCase();
  if (n.includes('geo-block') || n.includes('geoblocked') || n.includes('[geo')) {
    showGeoBanner();
  }
}

/* ══════════════════════════════════════════
   NOW PLAYING
══════════════════════════════════════════ */
function updateNowPlaying(ch) {
  const el = document.getElementById('now-playing');
  if (el) el.hidden = false;
  
  const logo = document.getElementById('np-logo');
  const fallback = document.getElementById('np-logo-fallback');
  if (logo && ch.logo) {
    logo.src = ch.logo;
    logo.onerror = () => {
      logo.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    };
    logo.style.display = 'block';
    if (fallback) fallback.style.display = 'none';
  } else {
    if (logo) logo.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
  }
  
  const name  = document.getElementById('np-name');
  const group = document.getElementById('np-group');
  const live  = document.getElementById('np-live');
  const radio = document.getElementById('np-radio');
  if (name)  name.textContent  = ch.name || 'Unnamed';
  if (group) group.textContent = ch.group || 'Divers';
  
  const isRadio = ch.is_radio || (ch.url || '').toLowerCase().endsWith('.mp3');
  if (live)  live.hidden  = !!isRadio;
  if (radio) radio.hidden = !isRadio;
}

/* ══════════════════════════════════════════
   CLAVIER
══════════════════════════════════════════ */
let _numBuf = '';
let _numTimer = null;

function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Ne pas intercepter dans les inputs
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) return;

    switch(e.key) {
      case 'ArrowLeft':
      case 'PageUp':    App.prevChannel(); break;
      case 'ArrowRight':
      case 'PageDown':  App.nextChannel(); break;
      case 'f': case 'F': App.toggleFullscreen(); break;
      case 'm': case 'M': App.toggleMute(); break;
      case 't': case 'T': ThemeManager.toggle(); break;
      case 'i': case 'I': App.toggleStats(); break;
      case 'p': case 'P': App.togglePiP(); break;
      case 's': case 'S': App.captureFrame(); break;
      case 'Escape': App.closeModal(); closeSidebar(); break;
    }

    // Zapping numerique
    if (e.key >= '0' && e.key <= '9') {
      clearTimeout(_numTimer);
      _numBuf += e.key;
      App.showStatus('loading', `Chaine : ${_numBuf}`);
      _numTimer = setTimeout(() => {
        const idx = parseInt(_numBuf) - 1;
        if (idx >= 0 && idx < App.state.filtered.length) {
          App.playChannel(idx);
        }
        _numBuf = '';
        App.hideStatus();
      }, 1400);
    }
  });
}

/* ══════════════════════════════════════════
   SERVICE WORKER
══════════════════════════════════════════ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(e => {
      console.warn('SW registration failed:', e);
    });
  }
}

/* ══════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════ */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ══════════════════════════════════════════
   FAMELACK DATA INTEGRATION
══════════════════════════════════════════ */
const FAMELACK_BASE = {
  tv: '/ressource/raw'
};

App.loadFamelack = async function(type = 'tv', by = 'country', code = 'fr', label = null) {
  const subfolder = by === 'country' ? 'countries' : 'categories';
  const url = `${FAMELACK_BASE.tv}/${subfolder}/${code}.json`;

  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = true;
  App.showStatus('loading', `Chargement famelack : ${label || code}...`);
  try {
    App.showProgress(0, 'Connexion Famelack...');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    App.showProgress(40, 'Parsing JSON...');
    const channels = Parser.parseJSON(json);

    App.showProgress(80, 'Rendu interface...');
    await App._loadChannels(channels, label || code);
  } catch(e) {
    console.error(e);
    App.showStatus('error', `Erreur JSON: ${e.message}`);
    App.hideProgress();
  }
};

/* ══════════════════════════════════════════
   FAMELACK — CHARGEMENT DYNAMIQUE PAYS
══════════════════════════════════════════ */
let _famelackCountriesLoaded = false;

async function loadFamelackCountriesTab() {
  if (_famelackCountriesLoaded) return;
  const grid = document.getElementById('presets-grid-countries');
  if (!grid) return;

  grid.innerHTML = '<div class="preset-loading"><i data-lucide="loader" class="spin"></i> Chargement des pays...</div>';
  if (window.lucide) lucide.createIcons({ nodes: [grid] });

  try {
    // Tentative 1 : index famelack via GitHub API
    let countries = [];
    try {
      countries = await Parser.fetchFamelackCountries();
    } catch(e) {
      console.warn('[Famelack] GitHub API echouee, fallback iptv-org', e);
    }

    // Construction de la grille : famelack en premier, puis complement iptv-org
    const famelackCodes = new Set(countries.map(c => c.code));
    const iptvOrgExtra  = IPTV_ORG_COUNTRIES.filter(c => !famelackCodes.has(c.code));

    let html = '';

    // Section famelack (streams valides)
    if (countries.length) {
      html += '<div class="preset-section-title">Sources validees (famelack)</div>';
      html += countries.map(c => presetBtnHtml({
        icon:      'globe',
        label:     `${c.flag} ${c.name}`,
        sub:       c.code,
        css:       'preset-btn--validated',
        onclick:   `App.loadFamelackSource('${c.url}','${escHtml(c.flag + ' ' + c.name)}')`
      })).join('');
    }

    // Section iptv-org par continent
    const byContinent = groupByContinent(iptvOrgExtra);
    for (const [continent, list] of Object.entries(byContinent)) {
      html += `<div class="continent-sep">${continent}</div>`;
      html += list.map(c => presetBtnHtml({
        icon:    'tv',
        label:   `${c.flag} ${c.name}`,
        sub:     c.code,
        onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
      })).join('');
    }

    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCountriesLoaded = true;

  } catch(e) {
    grid.innerHTML = `<div class="preset-error">
      <i data-lucide="alert-triangle"></i> Erreur : ${e.message}
    </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  }
}

/* ══════════════════════════════════════════
   FAMELACK — CHARGEMENT DYNAMIQUE CATEGORIES
══════════════════════════════════════════ */
let _famelackCategoriesLoaded = false;

async function loadFamelackCategoriesTab() {
  if (_famelackCategoriesLoaded) return;
  const grid = document.getElementById('presets-grid-categories');
  if (!grid) return;

  grid.innerHTML = '<div class="preset-loading"><i data-lucide="loader" class="spin"></i> Chargement...</div>';
  if (window.lucide) lucide.createIcons({ nodes: [grid] });

  try {
    const cats = await Parser.fetchFamelackCategories();

    // Icones par categorie
    const CAT_ICONS = {
      news:'newspaper', sport:'trophy', sports:'trophy', music:'music',
      entertainment:'tv-2', kids:'baby', children:'baby',
      documentary:'film', movies:'clapperboard', films:'clapperboard',
      cooking:'utensils', food:'utensils', travel:'map-pin',
      weather:'cloud', religion:'heart', relax:'sun',
      business:'briefcase', science:'flask-conical', health:'heart-pulse',
      education:'graduation-cap', radio:'radio', general:'layout-grid'
    };

    let html = '<div class="preset-section-title">Categories famelack (validees)</div>';
    html += cats.map(c => {
      const icon = CAT_ICONS[c.slug.toLowerCase()] || 'tv';
      return presetBtnHtml({
        icon,
        label:   c.name,
        sub:     'famelack',
        css:     'preset-btn--validated',
        onclick: `App.loadFamelackSource('${c.url}','${escHtml(c.name)}')`
      });
    }).join('');

    // Complement : categories iptv-org
    html += '<div class="preset-section-title">Categories iptv-org</div>';
    html += IPTV_ORG_CATEGORIES.map(c => presetBtnHtml({
      icon:    CAT_ICONS[c.slug] || 'tv',
      label:   c.name,
      sub:     'iptv-org',
      onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
    })).join('');

    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCategoriesLoaded = true;

  } catch(e) {
    // Fallback : categories iptv-org uniquement
    const CAT_ICONS = {
      news:'newspaper', sports:'trophy', music:'music',
      entertainment:'tv-2', kids:'baby', documentary:'film',
      movies:'clapperboard', cooking:'utensils', travel:'map-pin',
      weather:'cloud', business:'briefcase', education:'graduation-cap',
      religion:'heart', general:'layout-grid'
    };
    let html = '<div class="preset-section-title">Categories iptv-org</div>';
    html += IPTV_ORG_CATEGORIES.map(c => presetBtnHtml({
      icon:    CAT_ICONS[c.slug] || 'tv',
      label:   c.name,
      sub:     'iptv-org',
      onclick: `App.usePreset('${c.url}','${escHtml(c.name)}')`
    })).join('');
    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
    _famelackCategoriesLoaded = true;
  }
}

/* Charger une source famelack JSON */
App.loadFamelackSource = async function(url, label) {
  const bg = document.getElementById('modal-bg');
  if (bg) bg.hidden = true;
  App.showStatus('loading', `Chargement : ${label}...`);
  App.showProgress(0, `Connexion a famelack...`);
  try {
    App.showProgress(30, 'Telechargement...');
    const channels = await Parser.fetchFamelack(url);
    App.showProgress(80, 'Traitement...');
    await App._loadChannels(channels, label);
  } catch(e) {
    App.showStatus('error', `Erreur : ${e.message}`);
    App.hideProgress();
  }
};

/* Helper : genere le HTML d'un bouton preset */
function presetBtnHtml({ icon, label, sub, css = '', onclick }) {
  return `<button class="preset-btn ${css}" onclick="${onclick}">
    <i data-lucide="${icon}"></i>
    <span>${escHtml(label)}</span>
    ${sub ? `<small>${escHtml(sub)}</small>` : ''}
  </button>`;
}

/* Regroupe les pays par continent */
function groupByContinent(countries) {
  const CONTINENTS = {
    EU: ['AD','AL','AT','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI',
         'FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MC','MD','ME',
         'MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','TR','UA',
         'VA','XK'],
    AF: ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','EH',
         'ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG',
         'ML','MR','MU','MW','MZ','NA','NE','NG','RW','SC','SD','SL','SN','SO','SS',
         'ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW'],
    AS: ['AE','AF','AM','AZ','BD','BH','BN','BT','CN','CY','GE','ID','IL','IN','IQ',
         'IR','JP','JO','KG','KH','KP','KR','KW','KZ','LA','LB','LK','MM','MN','MY',
         'NP','OM','PH','PK','PS','QA','SA','SG','SY','TH','TJ','TL','TM','TW',
         'UZ','VN','YE'],
    AM: ['AG','AR','BB','BO','BR','BS','BZ','CA','CL','CO','CR','CU','DM','DO','EC',
         'GD','GT','GY','HN','HT','JM','KN','LC','MX','NI','PA','PE','PY','SR',
         'SV','TT','US','UY','VC','VE'],
    OC: ['AU','FJ','FM','KI','MH','NR','NZ','PG','PW','SB','TO','TV','VU','WS'],
    ME: ['AE','BH','IQ','IL','IR','JO','KW','LB','OM','PS','QA','SA','SY','TR','YE']
  };
  const LABELS = {
    EU:'Europe', AF:'Afrique', AS:'Asie', AM:'Ameriques', OC:'Oceanie', ME:'Moyen-Orient'
  };

  const result = {};
  const placed = new Set();

  // Moyen-Orient en premier pour les pays arabes
  for (const [cont, codes] of Object.entries(CONTINENTS)) {
    const label = LABELS[cont];
    const list  = countries.filter(c => codes.includes(c.code) && !placed.has(c.code));
    if (list.length) {
      result[label] = list;
      list.forEach(c => placed.add(c.code));
    }
  }

  // Reste non classe
  const rest = countries.filter(c => !placed.has(c.code));
  if (rest.length) result['Autres'] = rest;

  return result;
}

let _staticTabsInitialized = false;

function initStaticTabs() {
  if (_staticTabsInitialized) return;
  _staticTabsInitialized = true;

  // --- ONG. POPULAIRES ---
  const gridPop = document.getElementById('presets-grid');
  if (gridPop) {
    gridPop.innerHTML = POPULAR_SOURCES.map(s => presetBtnHtml({
      icon:    s.icon,
      label:   s.label,
      sub:     s.sub,
      css:     s.css,
      onclick: `App.usePreset('${s.url}','${escHtml(s.label)}')`
    })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridPop] });
  }

  // --- ONG. LANGUES ---
  const gridLang = document.getElementById('presets-grid-languages');
  if (gridLang) {
    gridLang.innerHTML =
      '<div class="preset-section-title">Langues iptv-org</div>' +
      IPTV_ORG_LANGUAGES.map(l => presetBtnHtml({
        icon:    'languages',
        label:   `${l.flag} ${l.name}`,
        sub:     l.code,
        onclick: `App.usePreset('${l.url}','${escHtml(l.name)}')`
      })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridLang] });
  }

  // --- ONG. REGIONS ---
  const gridReg = document.getElementById('presets-grid-regions');
  if (gridReg) {
    gridReg.innerHTML =
      '<div class="preset-section-title">Regions iptv-org</div>' +
      IPTV_ORG_REGIONS.map(r => presetBtnHtml({
        icon:    'map',
        label:   r.name,
        sub:     r.code,
        onclick: `App.usePreset('${r.url}','${escHtml(r.name)}')`
      })).join('');
    if (window.lucide) lucide.createIcons({ nodes: [gridReg] });
  }

  // Declencher aussi les onglets dynamiques
  loadFamelackCountriesTab();
  loadFamelackCategoriesTab();
}
