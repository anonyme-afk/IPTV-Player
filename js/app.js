// ── MAIN APPLICATION ──
const App = (() => {

  // ── STATE ──
  const state = {
    channels: [],
    filtered: [],
    currentIndex: -1,
    currentCat: '__all__',
    currentTab: 'all',
    favorites: Store.get('iptv_favs', []),
    history: Store.get('iptv_hist', []),
  };

  // ── CORS PROXIES FOR PLAYLIST FETCH ──
  const FETCH_PROXIES = [
    url => url,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.org/?.${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  ];

  // ── INIT ──
  async function init() {
    Lang.apply();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // URL param auto-load
    const params = new URLSearchParams(location.search);
    const m3uParam = params.get('m3u');
    if (m3uParam) {
      document.getElementById('m3u-url').value = m3uParam;
      await loadM3U();
      return;
    }

    // Restore persisted playlist
    const saved = Store.get('iptv_session', null);
    if (saved && saved.text) {
      _showSkeleton();
      await _sleep(200);
      state.channels = Parser.parse(saved.text);
      if (saved.url) document.getElementById('m3u-url').value = saved.url;
      renderCategories();
      renderList();
    }

    Nav.init();
  }

  // ── LOAD M3U ──
  async function loadM3U() {
    const activeTab = document.querySelector('.m-tab.active')?.dataset.modalTab || 'url';
    let text = '';

    if (activeTab === 'url') {
      let url = document.getElementById('m3u-url').value.trim();
      if (!url) return _alert(Lang.t('enter_url'));

      // Fix GitHub blob URL → raw
      url = url
        .replace(/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'raw.githubusercontent.com/$1/$2/')
        .replace(/^(https?:\/\/)raw\.githubusercontent\.com/, '$1raw.githubusercontent.com');

      _setStatus('loading', Lang.t('downloading'));
      text = await _fetchWithProxies(url);
      if (text === null) return;

      // Save URL+text for persistence
      Store.set('iptv_session', { url, text });

    } else if (activeTab === 'file') {
      const file = document.getElementById('m3u-file').files[0];
      if (!file) return _alert(Lang.t('select_file'));
      text = await file.text();
      Store.set('iptv_session', { url: null, text });

    } else {
      text = document.getElementById('m3u-text').value;
      if (!text.trim()) return _alert(Lang.t('paste_m3u'));
      Store.set('iptv_session', { url: null, text });
    }

    state.channels = Parser.parse(text);
    state.currentIndex = -1;

    if (!state.channels.length) {
      _setStatus('error', Lang.t('no_ch_found'));
      return;
    }

    _clearStatus();
    closeModal();
    renderCategories();
    renderList();
    _setStatus('ok', `${state.channels.length} ${Lang.t('loaded_channels')}`);
    setTimeout(_clearStatus, 3000);
  }

  async function _fetchWithProxies(url) {
    for (let i = 0; i < FETCH_PROXIES.length; i++) {
      const fetchUrl = FETCH_PROXIES[i](url);
      try {
        const res = await fetch(fetchUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trim()) return text;
        throw new Error('Empty response');
      } catch (e) {
        if (i === FETCH_PROXIES.length - 1) {
          _setStatus('error', `${Lang.t('failed_load')} ${e.message}`);
          return null;
        }
        _setStatus('loading', `${Lang.t('retrying')} (${i + 1}/${FETCH_PROXIES.length - 1})`);
      }
    }
    return null;
  }

  // ── PLAY ──
  function playAt(index) {
    const ch = state.filtered[index];
    if (!ch) return;
    state.currentIndex = index;
    renderList();
    Player.play(ch);
    closeSidebar();
  }

  function addHistory(ch) {
    state.history = [ch.url, ...state.history.filter(u => u !== ch.url)].slice(0, 100);
    Store.set('iptv_hist', state.history);
  }

  // ── CATEGORIES ──
  function renderCategories() {
    const groups = [...new Set(state.channels.map(c => c.group))].slice(0, 60);
    const el = document.getElementById('cats');
    const allLabel = Lang.t('all');

    el.innerHTML = [
      `<button class="cat-btn active" data-cat="__all__" onclick="App.selectCat('__all__')" data-nav>${allLabel}</button>`,
      ...groups.map(g =>
        `<button class="cat-btn" data-cat="${_esc(g)}" onclick="App.selectCat('${_escAttr(g)}')" data-nav>${_esc(g)}</button>`
      )
    ].join('');
  }

  function selectCat(cat) {
    state.currentCat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    renderList();
  }

  // ── TABS ──
  function switchTab(tab, btn) {
    state.currentTab = tab;
    // Sync all tab buttons (topbar + mobile sidebar)
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderList();
  }

  // ── FILTER ──
  function filterChannels() { renderList(); }

  function renderList() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    const { channels, currentTab, currentCat, favorites, history } = state;
    let list = channels;

    if (currentTab === 'fav') {
      list = channels.filter(c => favorites.includes(c.url));
    } else if (currentTab === 'hist') {
      list = history
        .map(url => channels.find(c => c.url === url))
        .filter(Boolean);
    } else if (currentCat !== '__all__') {
      list = channels.filter(c => c.group === currentCat);
    }

    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.group && c.group.toLowerCase().includes(q))
      );
    }

    state.filtered = list;
    const container = document.getElementById('ch-list');

    if (!list.length) {
      container.innerHTML = `
        <div id="no-ch">
          <i data-lucide="search-x"></i>
          <p>${Lang.t('no_ch_found')}</p>
        </div>`;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = list.map((ch, i) => {
      const faved = favorites.includes(ch.url);
      const active = i === state.currentIndex ? 'active' : '';
      const safeUrl = _escAttr(ch.url);
      const logo = ch.logo
        ? `<img class="ch-logo" src="${_esc(ch.logo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="ch-logo-fallback" style="display:none"><i data-lucide="tv"></i></div>`
        : `<div class="ch-logo-fallback"><i data-lucide="tv"></i></div>`;

      return `
        <div class="ch-item ${active}" data-index="${i}" onclick="App.playAt(${i})" data-nav tabindex="0"
             onkeydown="if(event.key==='Enter')App.playAt(${i})">
          <span class="ch-num">${String(i + 1).padStart(2, '0')}</span>
          ${logo}
          <div class="ch-info">
            <div class="ch-name">${_esc(ch.name)}</div>
            <div class="ch-group">${_esc(ch.group || '')}</div>
          </div>
          <button class="fav-btn ${faved ? 'faved' : ''}"
                  onclick="event.stopPropagation();App.toggleFav(this.dataset.url)"
                  data-url="${safeUrl}"
                  data-nav aria-label="Favori">
            <i data-lucide="${faved ? 'star' : 'star-off'}"></i>
          </button>
        </div>`;
    }).join('');

    // Optimisation: ne recreer les icones Lucide que si le container est visible
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: [container] }); } catch (_) { }
    }

    // Scroll to active avec fallback smooth
    const activeEl = container.querySelector('.ch-item.active');
    if (activeEl) {
      try { activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch (_) { activeEl.scrollIntoView(); }
    }
  }

  // ── FAVORITES ──
  function toggleFav(url) {
    const idx = state.favorites.indexOf(url);
    if (idx === -1) state.favorites.push(url);
    else state.favorites.splice(idx, 1);
    Store.set('iptv_favs', state.favorites);
    renderList();
  }

  // ── HELPERS ──
  function _setStatus(type, msg) {
    const bar = document.getElementById('status-bar');
    bar.className = type;
    bar.textContent = msg;
  }
  function _clearStatus() { _setStatus('', ''); }

  function _showSkeleton(count = 10) {
    document.getElementById('ch-list').innerHTML = Array(count).fill(0).map(() => `
      <div class="ch-item" style="pointer-events:none;gap:10px">
        <div class="skel" style="width:22px;height:10px;border-radius:3px"></div>
        <div class="skel" style="width:36px;height:36px;border-radius:6px;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="skel" style="width:65%;height:13px"></div>
          <div class="skel" style="width:40%;height:10px"></div>
        </div>
      </div>`).join('');
  }

  // ── PRESET PLAYLISTS ──
  function usePreset(url) {
    document.getElementById('m3u-url').value = url;
    // Highlight selected
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('onclick').includes(url));
    });
    // Auto-load immediately
    loadM3U();
  }

  function _alert(msg) {
    _setStatus('error', msg);
    setTimeout(_clearStatus, 4000);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return {
    state,
    init,
    loadM3U,
    playAt,
    addHistory,
    renderCategories,
    renderList,
    selectCat,
    switchTab,
    filterChannels,
    toggleFav,
    usePreset,
  };
})();

// ── MODAL HELPERS (global scope for inline HTML) ──
function openModal() {
  document.getElementById('modal-bg').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
}
function switchModalTab(tab, btn) {
  document.querySelectorAll('.m-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.modal-panel').forEach(p => p.hidden = true);
  document.getElementById(`mtab-${tab}`).hidden = false;
}
function switchPresetTab(tab, btn) {
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[id^="presets-grid"]').forEach(g => {
    g.classList.remove('preset-grid-active');
    g.classList.add('preset-grid-hidden');
  });
  const target = document.querySelector(`[id^="presets-grid"][data-ptab="${tab}"]`);
  if (target) {
    target.classList.remove('preset-grid-hidden');
    target.classList.add('preset-grid-active');
  }
}
document.getElementById('modal-bg')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ── SIDEBAR HELPERS ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── BOOT ──
window.addEventListener('DOMContentLoaded', () => App.init());
