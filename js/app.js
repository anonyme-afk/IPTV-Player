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

  // ── CORS PROXIES ──
  const FETCH_PROXIES = [
    url => url,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.org/?.${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  ];

  // Virtual scroll constants
  const ITEM_H = 56;
  const OVERSCAN = 5;
  let _searchTimer = null;
  let _lastSearchQ = '';

  // ── SERVICE WORKER ──
  function _registerSW() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { });
      // Listen for update
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] New version available, reloading');
        window.location.reload();
      });
    }
  }

  // ── DETECT SLOW DEVICE ──
  function _isSlowDevice() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    return isMobile || lowMemory || lowCores;
  }

  // ── DETECT iOS SAFARI ──
  function _isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  // ── INIT ──
  async function init() {
    // Apply iOS class for CSS fixes
    if (_isiOS()) document.body.classList.add('is-ios');
    if (_isSlowDevice()) document.body.classList.add('is-slow');

    _registerSW();
    Lang.apply();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // VisualViewport fix for iOS keyboard
    if ('visualViewport' in window) {
      window.visualViewport.addEventListener('resize', () => {
        document.getElementById('app').style.height = window.visualViewport.height + 'px';
      });
    }

    const params = new URLSearchParams(location.search);
    const m3uParam = params.get('m3u');
    if (m3uParam) {
      document.getElementById('m3u-url').value = m3uParam;
      await loadM3U();
      return;
    }

    const saved = Store.get('iptv_session', null);
    if (saved && saved.text) {
      _showSkeleton();
      // Use chunked parsing with progress
      const lines = saved.text.split(/\r?\n/);
      state.channels = await _parseChunked(lines);
      if (saved.url) document.getElementById('m3u-url').value = saved.url;
      renderCategories();
      _renderVirtualList();
    }

    Nav.init();
  }

  // ── CHUNKED PARSING (non-blocking) ──
  function _parseChunked(lines) {
    return new Promise((resolve) => {
      const results = [];
      const CHUNK = 2000;
      let i = 0;
      let progressEl = document.getElementById('status-bar');

      function next() {
        const start = performance.now();
        const end = Math.min(i + CHUNK, lines.length);
        const chunk = lines.slice(i, end);

        // Parse this chunk using existing Parser logic
        const parsed = Parser.parse(chunk.join('\n'));
        results.push(...parsed);

        i = end;
        const pct = Math.round(i / lines.length * 100);

        // Update progress
        progressEl.className = 'loading';
        progressEl.textContent = `Parsing... ${pct}% (${results.length} channels)`;
        progressEl.style.display = 'block';

        if (i < lines.length) {
          // If chunk took less than 10ms, do another chunk immediately
          if (performance.now() - start < 10) {
            setTimeout(next, 0);
          } else {
            setTimeout(next, 16); // ~60fps
          }
        } else {
          progressEl.style.display = 'none';
          resolve(results);
        }
      }
      setTimeout(next, 0);
    });
  }

  // ── LOAD M3U ──
  async function loadM3U() {
    const activeTab = document.querySelector('.m-tab.active')?.dataset.modalTab || 'url';
    let text = '';

    if (activeTab === 'url') {
      let url = document.getElementById('m3u-url').value.trim();
      if (!url) return _alert(Lang.t('enter_url'));

      url = url
        .replace(/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'raw.githubusercontent.com/$1/$2/')
        .replace(/^(https?:\/\/)raw\.githubusercontent\.com/, '$1raw.githubusercontent.com');

      _setStatus('loading', Lang.t('downloading'));
      text = await _fetchWithProxies(url);
      if (text === null) return;
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

    // Chunked parsing
    const lines = text.split(/\r?\n/);
    _showSkeleton();
    state.channels = await _parseChunked(lines);
    state.currentIndex = -1;

    if (!state.channels.length) {
      _setStatus('error', Lang.t('no_ch_found'));
      return;
    }

    _clearStatus();
    closeModal();
    renderCategories();
    _renderVirtualList();
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
    _renderVirtualList();
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
    // Update categories scroll arrows after render
    if (window._updateCatsArrows) setTimeout(window._updateCatsArrows, 50);
  }

  function selectCat(cat) {
    state.currentCat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    _renderVirtualList();
  }

  function switchTab(tab, btn) {
    state.currentTab = tab;
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    _renderVirtualList();
  }

  // ── FILTER (with debounce + pre-index) ──
  function _getFilteredList() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    const { channels, currentTab, currentCat, favorites, history } = state;
    let list = channels;

    if (currentTab === 'fav') {
      list = channels.filter(c => favorites.includes(c.url));
    } else if (currentTab === 'hist') {
      list = history.map(u => channels.find(c => c.url === u)).filter(Boolean);
    } else if (currentCat !== '__all__') {
      list = channels.filter(c => c.group === currentCat);
    }

    if (q) {
      // Pre-indexed lowercase search (compute once)
      if (!channels._lowerIdx) {
        channels._lowerIdx = channels.map(c => ({
          n: c.name.toLowerCase(),
          g: (c.group || '').toLowerCase()
        }));
      }
      list = list.filter(c => {
        const idx = channels.indexOf(c);
        const l = channels._lowerIdx[idx];
        return l && (l.n.includes(q) || l.g.includes(q));
      });
    }

    return list;
  }

  function filterChannels() {
    // Debounce search: wait 250ms
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _renderVirtualList();
    }, 250);
  }

  // ── VIRTUAL SCROLL RENDER ──
  let _scrollAnimFrame = null;
  let _pendingRender = false;

  function _renderVirtualList() {
    const list = _getFilteredList();
    state.filtered = list;

    const container = document.getElementById('ch-list');
    const { currentIndex, favorites } = state;
    const total = list.length;

    if (!total) {
      container.innerHTML = `
        <div id="no-ch" style="height:100%">
          <i data-lucide="search-x"></i>
          <p>${Lang.t('no_ch_found')}</p>
        </div>`;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
      container.scrollTop = 0;
      return;
    }

    const scrollTop = container.scrollTop || 0;
    const viewH = container.clientHeight || window.innerHeight;
    const firstIdx = Math.max(0, Math.floor(scrollTop / ITEM_H) - OVERSCAN);
    const lastIdx = Math.min(total - 1, Math.ceil((scrollTop + viewH) / ITEM_H) + OVERSCAN);
    const visibleCount = lastIdx - firstIdx + 1;

    // Generate only visible items
    let html = `<div style="height:${firstIdx * ITEM_H}px"></div>`;
    for (let i = firstIdx; i <= lastIdx; i++) {
      const ch = list[i];
      const faved = favorites.includes(ch.url);
      const active = i === currentIndex ? 'active' : '';
      const safeUrl = _escAttr(ch.url);
      const logo = ch.logo
        ? `<img class="ch-logo" src="${_esc(ch.logo)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="ch-logo-fallback" style="display:none"><i data-lucide="tv"></i></div>`
        : `<div class="ch-logo-fallback"><i data-lucide="tv"></i></div>`;

      html += `
        <div class="ch-item ${active}" data-index="${i}" onclick="App.playAt(${i})" data-nav tabindex="0"
             onkeydown="if(event.key==='Enter')App.playAt(${i})"
             style="position:absolute;top:${i * ITEM_H}px;left:0;right:0;height:${ITEM_H}px">
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
    }
    html += `<div style="height:${(total - lastIdx - 1) * ITEM_H}px"></div>`;

    // Store scroll position before replacing content
    const prevScrollTop = container.scrollTop;

    // Use innerHTML with a style that enables absolute positioning
    container.style.position = 'relative';
    container.style.height = '100%';
    container.innerHTML = html;

    // Restore scroll position
    container.scrollTop = prevScrollTop;

    // Update Lucide icons only for visible range
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: [container] }); } catch (_) { }
    }

    // Invalidate Nav cache
    if (typeof Nav !== 'undefined') Nav._invalidateCache?.();

    // Scroll to active element if present
    const activeEl = container.querySelector('.ch-item.active');
    if (activeEl && currentIndex >= 0) {
      const targetScroll = Math.max(0, currentIndex * ITEM_H - viewH / 2 + ITEM_H / 2);
      container.scrollTop = targetScroll;
    }
  }

  // ── SCROLL HANDLER (throttled) ──
  function _onListScroll() {
    if (_pendingRender) return;
    _pendingRender = true;
    cancelAnimationFrame(_scrollAnimFrame);
    _scrollAnimFrame = requestAnimationFrame(() => {
      _pendingRender = false;
      _renderVirtualList();
    });
  }

  // ── FAVORITES ──
  function toggleFav(url) {
    const idx = state.favorites.indexOf(url);
    if (idx === -1) state.favorites.push(url);
    else state.favorites.splice(idx, 1);
    Store.set('iptv_favs', state.favorites);
    _renderVirtualList();
  }

  // ── EXPORT FAVORITES AS M3U ──
  function exportFavorites() {
    const favChannels = state.channels.filter(c => state.favorites.includes(c.url));
    if (!favChannels.length) return _alert('Aucun favori a exporter');
    let m3u = '#EXTM3U\n';
    favChannels.forEach(ch => {
      m3u += `#EXTINF:-1 tvg-logo="${ch.logo}" group-title="${ch.group}",${ch.name}\n${ch.url}\n`;
    });
    const blob = new Blob([m3u], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mes_favoris.m3u';
    a.click();
    URL.revokeObjectURL(a.href);
    _setStatus('ok', `${favChannels.length} favoris exportes`);
    setTimeout(_clearStatus, 3000);
  }

  // ── THEME TOGGLE (deprecated — use ThemeManager.toggle() instead) ──
  function toggleTheme() {
    ThemeManager.toggle();
  }

  // ── HELPERS ──
  function _setStatus(type, msg) {
    const bar = document.getElementById('status-bar');
    bar.className = type;
    bar.textContent = msg;
    bar.style.display = type ? 'block' : 'none';
  }
  function _clearStatus() { _setStatus('', ''); }

  function _showSkeleton(count = 10) {
    const container = document.getElementById('ch-list');
    container.innerHTML = Array(count).fill(0).map(() => `
      <div class="ch-item" style="pointer-events:none;gap:10px;position:absolute">
        <div class="skel" style="width:22px;height:10px;border-radius:3px"></div>
        <div class="skel" style="width:36px;height:36px;border-radius:6px;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="skel" style="width:65%;height:13px"></div>
          <div class="skel" style="width:40%;height:10px"></div>
        </div>
      </div>`).join('');
    container.scrollTop = 0;
  }

  function usePreset(url) {
    document.getElementById('m3u-url').value = url;
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('onclick').includes(url));
    });
    loadM3U();
  }

  function _alert(msg) {
    _setStatus('error', msg);
    setTimeout(_clearStatus, 4000);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&').replace(/</g, '<')
      .replace(/>/g, '>').replace(/"/g, '"');
  }

  function _escAttr(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '"');
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── BIND SCROLL LISTENER ──
  function _initListScroll() {
    const container = document.getElementById('ch-list');
    if (!container) return;
    // Remove existing listener, add throttled one
    container.removeEventListener('scroll', _onListScroll);
    container.addEventListener('scroll', _onListScroll, { passive: true });
  }

  return {
    state,
    init,
    loadM3U,
    playAt,
    addHistory,
    renderCategories,
    renderList: _renderVirtualList,
    selectCat,
    switchTab,
    filterChannels,
    toggleFav,
    usePreset,
    exportFavorites,
    toggleTheme,
    _invalidateCache: _renderVirtualList,
  };
})();

// ── CATEGORIES SCROLL (arrows + gradients) ──
function initCatsScroll() {
  const wrap = document.getElementById('cats-wrap');
  const cats = document.getElementById('cats');
  const prev = document.getElementById('cats-prev');
  const next = document.getElementById('cats-next');
  if (!cats || !wrap) return;

  function updateArrows() {
    const hasOverflow = cats.scrollWidth > cats.clientWidth + 2;
    const atStart = cats.scrollLeft <= 2;
    const atEnd = cats.scrollLeft >= cats.scrollWidth - cats.clientWidth - 2;
    if (prev) prev.style.display = hasOverflow ? 'flex' : 'none';
    if (next) next.style.display = hasOverflow ? 'flex' : 'none';
    wrap.classList.toggle('can-scroll-left', hasOverflow && !atStart);
    wrap.classList.toggle('can-scroll-right', hasOverflow && !atEnd);
  }

  function scrollToActive() {
    const active = cats.querySelector('.cat-btn.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  if (prev) prev.addEventListener('click', () => cats.scrollBy({ left: -200, behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => cats.scrollBy({ left: 200, behavior: 'smooth' }));
  cats.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);

  window._updateCatsArrows = () => { updateArrows(); scrollToActive(); };
  updateArrows();
}

// ── MODAL HELPERS ──
function openModal() { document.getElementById('modal-bg').classList.add('open'); }
function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }
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
  if (target) { target.classList.remove('preset-grid-hidden'); target.classList.add('preset-grid-active'); }
}
document.getElementById('modal-bg')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── BOOT ──
window.addEventListener('DOMContentLoaded', () => {
  App.init();
  initCatsScroll();
  setTimeout(() => Player.initZapping?.(), 1000);
});
