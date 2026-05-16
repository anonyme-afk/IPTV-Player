// ── MAIN APPLICATION ──
const App = (() => {
  const state = {
    channels: [],
    filtered: [],
    currentIndex: -1,
    currentCat: '__all__',
    currentTab: 'all',
    favorites: Store.get('iptv_favs', []),
    history: Store.get('iptv_hist', []),
  };

  const FETCH_PROXIES = [
    url => url,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.org/?.${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  ];

  const ITEM_H = 56;
  const OVERSCAN = 5;
  let _searchTimer = null;

  function _registerSW() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  }

  function _isSlowDevice() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    return isMobile || lowMemory || lowCores;
  }

  function _isTVDevice() {
    const ua = navigator.userAgent;
    return /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Roku|AppleTV|Android TV|BRAVIA|Viera|Chromecast|Nexus/i.test(ua) || ua.includes('TV ');
  }

  function _isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  async function init() {
    if (_isiOS()) document.body.classList.add('is-ios');
    if (_isSlowDevice()) document.body.classList.add('is-slow');
    if (_isTVDevice()) document.body.classList.add('is-tv');

    _registerSW();
    Lang.apply();
    if (typeof lucide !== 'undefined') lucide.createIcons();

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
      const lines = saved.text.split(/\r?\n/);
      state.channels = await _parseChunked(lines);
      if (saved.url) document.getElementById('m3u-url').value = saved.url;
      renderCategories();
      _renderVirtualList();
    }
    Nav.init();
  }

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

        const parsed = Parser.parse(chunk.join('\n'));
        results.push(...parsed);

        i = end;
        const pct = Math.round(i / lines.length * 100);

        progressEl.className = 'loading';
        progressEl.textContent = `Parsing... ${pct}% (${results.length} channels)`;
        progressEl.style.display = 'block';

        if (i < lines.length) {
          if (performance.now() - start < 10) setTimeout(next, 0);
          else setTimeout(next, 16);
        } else {
          progressEl.style.display = 'none';
          resolve(results);
        }
      }
      setTimeout(next, 0);
    });
  }

  async function loadM3U() {
    const activeTab = document.querySelector('.m-tab.active')?.dataset.modalTab || 'url';
    let text = '';

    if (activeTab === 'url') {
      let url = document.getElementById('m3u-url').value.trim();
      if (!url) return _alert(Lang.t('enter_url'));

      url = url.replace(/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'raw.githubusercontent.com/$1/$2/')
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

  function renderCategories() {
    const groups = [...new Set(state.channels.map(c => c.group))].slice(0, 60);
    const el = document.getElementById('cats');
    const allLabel = Lang.t('all');
    el.innerHTML = [
      `<button class="cat-btn active" data-cat="__all__" onclick="App.selectCat('__all__')" data-nav>${allLabel}</button>`,
      ...groups.map(g => `<button class="cat-btn" data-cat="${_esc(g)}" onclick="App.selectCat('${_escAttr(g)}')" data-nav>${_esc(g)}</button>`)
    ].join('');
    if (window._updateCatsScroll) setTimeout(window._updateCatsScroll, 50);
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

  function _getFilteredList() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    const { channels, currentTab, currentCat, favorites, history } = state;
    let list = channels;

    if (currentTab === 'fav') {
      const favSet = new Set(favorites);
      list = channels.filter(c => favSet.has(c.url));
    }
    else if (currentTab === 'hist') {
      const histSet = new Set(history);
      const found = {};
      for (let i = 0, len = channels.length; i < len; i++) {
        const c = channels[i];
        if (histSet.has(c.url) && !found[c.url]) found[c.url] = c;
      }
      list = history.map(u => found[u]).filter(Boolean);
    }
    else if (currentCat !== '__all__') {
      list = channels.filter(c => c.group === currentCat);
    }

    if (q) {
      if (!channels._lowerIdx) {
        for (let i = 0, len = channels.length; i < len; i++) {
          channels[i]._lName = channels[i].name.toLowerCase();
          channels[i]._lGrp = (channels[i].group || '').toLowerCase();
        }
        channels._lowerIdx = true;
      }
      list = list.filter(c => c._lName.includes(q) || c._lGrp.includes(q));
    }
    return list;
  }

  function filterChannels() {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => _renderVirtualList(), 250);
  }

  let _scrollAnimFrame = null;
  let _pendingRender = false;

  function _renderVirtualList() {
    const list = _getFilteredList();
    state.filtered = list;
    const container = document.getElementById('ch-list');
    const { currentIndex, favorites } = state;
    const total = list.length;

    if (!total) {
      container.innerHTML = `<div id="no-ch" style="height:100%"><i data-lucide="search-x"></i><p>${Lang.t('no_ch_found')}</p></div>`;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
      container.scrollTop = 0;
      return;
    }

    const isTV = document.body.classList.contains('is-tv');
    const containerW = container.clientWidth || 320;
    
    // Grid only on TVs (strict case mode) or Ultra-wide desktop screens (> 1300px)
    const isGrid = isTV || containerW >= 1300; 
    const baseW = isTV ? 260 : 180;
    const cols = isGrid ? Math.max(2, Math.floor(containerW / baseW)) : 1;
    const ITEM_H = isGrid ? (isTV ? 220 : 160) : 56;
    const rows = Math.ceil(total / cols);

    const scrollTop = container.scrollTop || 0;
    const viewH = container.clientHeight || window.innerHeight;
    
    // Calculate visible rows with overscan
    const firstRow = Math.max(0, Math.floor(scrollTop / ITEM_H) - 2);
    const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + viewH) / ITEM_H) + 2);

    const firstIdx = firstRow * cols;
    const lastIdx = Math.min(total - 1, (lastRow + 1) * cols - 1);

    let html = `<div style="height:${firstRow * ITEM_H}px"></div>`;
    html += `<div style="position:relative; height:${(lastRow - firstRow + 1) * ITEM_H}px">`;

    for (let i = firstIdx; i <= lastIdx; i++) {
      const ch = list[i];
      const faved = favorites.includes(ch.url);
      const active = i === currentIndex ? 'active' : '';
      const safeUrl = _escAttr(ch.url);
      const logo = ch.logo
        ? `<img class="ch-logo" src="${_esc(ch.logo)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ch-logo-fallback" style="display:none"><i data-lucide="tv"></i></div>`
        : `<div class="ch-logo-fallback"><i data-lucide="tv"></i></div>`;

      const row = Math.floor(i / cols) - firstRow;
      const col = i % cols;
      const top = row * ITEM_H;
      const leftPct = (col / cols) * 100;
      const widthPct = 100 / cols;

      if (isGrid) {
        html += `
          <div style="position:absolute;top:${top}px;left:${leftPct}%;width:${widthPct}%;height:${ITEM_H}px;padding:6px">
            <div class="ch-item is-grid ${active}" data-index="${i}" onclick="App.playAt(${i})" data-nav tabindex="0" onkeydown="if(event.key==='Enter')App.playAt(${i})" style="width:100%;height:100%;margin:0">
              ${logo}
              <div class="ch-info"><div class="ch-name">${_esc(ch.name)}</div><div class="ch-group">${_esc(ch.group || '')}</div></div>
              <button class="fav-btn ${faved ? 'faved' : ''}" onclick="event.stopPropagation();App.toggleFav(this.dataset.url)" data-url="${safeUrl}" data-nav aria-label="Favori"><i data-lucide="${faved ? 'star' : 'star-off'}"></i></button>
            </div>
          </div>`;
      } else {
        html += `
          <div class="ch-item ${active}" data-index="${i}" onclick="App.playAt(${i})" data-nav tabindex="0" onkeydown="if(event.key==='Enter')App.playAt(${i})" style="position:absolute;top:${top}px;left:0;right:0;height:${ITEM_H}px;margin-top:2px;margin-bottom:2px;">
            <span class="ch-num">${String(i + 1).padStart(2, '0')}</span>${logo}
            <div class="ch-info"><div class="ch-name">${_esc(ch.name)}</div><div class="ch-group">${_esc(ch.group || '')}</div></div>
            <button class="fav-btn ${faved ? 'faved' : ''}" onclick="event.stopPropagation();App.toggleFav(this.dataset.url)" data-url="${safeUrl}" data-nav aria-label="Favori"><i data-lucide="${faved ? 'star' : 'star-off'}"></i></button>
          </div>`;
      }
    }
    html += `</div>`;
    html += `<div style="height:${(rows - lastRow - 1) * ITEM_H}px"></div>`;

    const prevScrollTop = container.scrollTop;
    container.style.position = 'relative';
    container.style.height = '100%';
    container.innerHTML = html;
    container.scrollTop = prevScrollTop;

    if (typeof lucide !== 'undefined') { try { lucide.createIcons({ nodes: [container] }); } catch (_) { } }
    if (typeof Nav !== 'undefined') Nav._invalidateCache?.();
  }

  function _onListScroll() {
    if (_pendingRender) return;
    _pendingRender = true;
    cancelAnimationFrame(_scrollAnimFrame);
    _scrollAnimFrame = requestAnimationFrame(() => {
      _pendingRender = false;
      _renderVirtualList();
    });
  }

  function toggleFav(url) {
    const idx = state.favorites.indexOf(url);
    if (idx === -1) state.favorites.push(url); else state.favorites.splice(idx, 1);
    Store.set('iptv_favs', state.favorites);
    _renderVirtualList();
  }

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

  function _setStatus(type, msg) {
    const bar = document.getElementById('status-bar');
    bar.className = type; bar.textContent = msg; bar.style.display = type ? 'block' : 'none';
  }
  function _clearStatus() { _setStatus('', ''); }

  function _showSkeleton() {
    const container = document.getElementById('ch-list');
    container.innerHTML = Array(10).fill(0).map(() => `
      <div class="ch-item" style="pointer-events:none;gap:10px;position:absolute">
        <div class="skel" style="width:22px;height:10px;border-radius:3px"></div>
        <div class="skel" style="width:36px;height:36px;border-radius:6px;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="skel" style="width:65%;height:13px"></div><div class="skel" style="width:40%;height:10px"></div>
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

  function _alert(msg) { _setStatus('error', msg); setTimeout(_clearStatus, 4000); }
  function _esc(s) { return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"'); }
  function _escAttr(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '"'); }

  return {
    state, init, loadM3U, playAt, addHistory, renderCategories, 
    renderList: _renderVirtualList, selectCat, switchTab, filterChannels, 
    toggleFav, usePreset, exportFavorites, _onListScroll
  };
})();

// ── CATEGORIES SCROLL ──
function initCatsScroll() {
  const wrap = document.getElementById('cats-wrap');
  const cats = document.getElementById('cats');
  const prev = document.getElementById('cats-prev');
  const next = document.getElementById('cats-next');
  if (!cats || !wrap) return;

  function update() {
    const overflow = cats.scrollWidth > cats.clientWidth + 4;
    const atStart = cats.scrollLeft <= 4;
    const atEnd = cats.scrollLeft >= cats.scrollWidth - cats.clientWidth - 4;
    wrap.classList.toggle('has-overflow', overflow);
    wrap.classList.toggle('can-scroll-left', overflow && !atStart);
    wrap.classList.toggle('can-scroll-right', overflow && !atEnd);
  }

  if (prev) prev.addEventListener('click', () => cats.scrollBy({ left: -180, behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => cats.scrollBy({ left: 180, behavior: 'smooth' }));

  cats.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window._updateCatsScroll = update;
  update();
}

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

window.addEventListener('DOMContentLoaded', () => {
  App.init();
  const cl = document.getElementById('ch-list');
  if (cl) cl.addEventListener('scroll', App._onListScroll, { passive: true });
  initCatsScroll();
  setTimeout(() => Player.initZapping?.(), 1000);
});
