// ── PLAYER MODULE V3 - Optimise appareils basse consommation ──
const Player = (() => {
  let hls = null;
  let muted = false;
  let current = null;
  let _playTimer = null;
  let _retryCount = 0;
  let _abortController = null;

  const video = () => document.getElementById('video');
  const overlay = () => document.getElementById('overlay');
  const statusBar = () => document.getElementById('status-bar');
  const nowPlaying = () => document.getElementById('now-playing');

  // Proxys tries in order (garder ceux qui marchent vraiment)
  const STREAM_PROXIES = [
    url => url,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://corsproxy.org/?.${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
  ];

  // ── STATUS ──
  function setStatus(type, msg) {
    const bar = statusBar();
    bar.className = type;
    bar.textContent = msg;
    bar.style.display = type ? 'block' : 'none';
  }
  function clearStatus() { setStatus('', ''); }

  // ── TIMEOUT MANAGER ──
  function _startTimeout(ms = 15000) {
    _clearTimeout();
    _playTimer = setTimeout(() => {
      console.warn('[Player] Timeout atteint');
      _retryCount++;
      if (_retryCount < 2) {
        setStatus('loading', 'Timeout - Nouvelle tentative...');
        _destroy();
        if (current) play(current, { proxyIndex: current._proxyIdx + 1 || 1 });
      } else {
        setStatus('error', 'Flux indisponible (timeout)');
        _retryCount = 0;
      }
    }, ms);
  }

  function _clearTimeout() {
    if (_playTimer) { clearTimeout(_playTimer); _playTimer = null; }
  }

  // ── PLAY ──
  function play(ch, { proxyIndex = 0 } = {}) {
    if (!ch) return;

    // Reset retry counter on new channel
    if (!current || current.url !== ch.url) _retryCount = 0;
    current = ch;
    ch._proxyIdx = proxyIndex;

    // Clean up previous completely
    _destroy(true);
    const vid = video();
    vid.removeAttribute('src');
    vid.removeAttribute('preload');
    vid.onloadeddata = null;
    vid.onerror = null;
    vid.onwaiting = null;
    vid.onstalled = null;
    vid.onplay = null;
    overlay().style.display = 'none';

    setStatus('loading', `${Lang.t('conn_to')} ${ch.name}...`);

    const rawUrl = ch.url;
    const url = STREAM_PROXIES[proxyIndex] ? STREAM_PROXIES[proxyIndex](rawUrl) : rawUrl;
    const isHls = rawUrl.match(/\.m3u8(\?|$)/i) || rawUrl.includes('/hls/') || rawUrl.includes('.m3u');

    // Preload none + disable autoplay on slow devices
    vid.preload = 'none';
    vid.autoplay = false;

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      _playHls(url, ch, rawUrl, proxyIndex);
    } else {
      _playNative(url, ch, rawUrl, proxyIndex);
    }

    _updateNowPlaying(ch);
    try { App.addHistory(ch); } catch (_) { }
  }

  // ── HLS PLAYBACK (optimise basse consommation) ──
  function _playHls(url, ch, rawUrl, proxyIndex) {
    _startTimeout(20000);

    // Configuration basse consommation pour appareils peu puissants
    hls = new Hls({
      enableWorker: typeof Worker !== 'undefined' && !/iPad|iPhone|iPod|Android.*Mobile/.test(navigator.userAgent),
      lowLatencyMode: false,
      backbufferLength: 30,
      maxBufferLength: 15,
      maxMaxBufferLength: 20,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.5,
      lowLatencyMode: false,
      fragLoadingMaxRetry: 2,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 1,
      fragLoadingRetryDelay: 1000,
      fragLoadingTimeOut: 10000,
      manifestLoadingTimeOut: 10000,
      levelLoadingTimeOut: 10000,
      startLevel: -1, // auto
      capLevelToPlayerSize: true, // important: ne pas decoder plus que necessaire
      debug: false,
    });

    hls.loadSource(url);
    hls.attachMedia(video());

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      _clearTimeout();
      // Detected levels
      const levels = hls.levels || [];
      if (levels.length > 1) {
        // Auto-select best level for device (mid-range by default)
        const mid = Math.floor(levels.length / 2);
        hls.currentLevel = mid;
        console.log(`[Player] ${levels.length} qualites detectees, utilisation niveau ${mid}`);
      }
      setStatus('ok', `${Lang.t('playback_ok')} — ${ch.name}`);
      video().play().catch(() => { });
      setTimeout(clearStatus, 3000);
    });

    hls.on(Hls.Events.LEVEL_LOADED, () => {
      _clearTimeout();
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      _retryCount = 0;
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try {
          hls.recoverMediaError();
          return;
        } catch (_) { }
      }

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
        _clearTimeout();
      }

      _destroy();
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', `${Lang.t('retrying')} (proxy ${next})`);
        setTimeout(() => play(ch, { proxyIndex: next }), 500);
      } else {
        setStatus('error', Lang.t('err_cors'));
      }
    });

    // Stall detection (freeze prevention)
    let stallTimer = null;
    vid.onwaiting = () => {
      if (!stallTimer) {
        stallTimer = setTimeout(() => {
          console.warn('[Player] Stall detecte, tentative de recovery');
          try { hls?.recoverMediaError(); } catch (_) { }
          stallTimer = null;
        }, 8000);
      }
    };
    vid.onplay = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
  }

  // ── NATIVE PLAYBACK ──
  function _playNative(url, ch, rawUrl, proxyIndex) {
    const vid = video();
    _startTimeout(20000);
    setStatus('loading', Lang.t('retrying'));

    // Reset video element completely
    vid.src = '';
    vid.load();

    // Use requestAnimationFrame to not block rendering
    requestAnimationFrame(() => {
      vid.src = url;
      vid.preload = 'metadata';
    });

    vid.onloadedmetadata = () => {
      _clearTimeout();
      vid.play().catch(() => { });
      setStatus('ok', `${Lang.t('playback_ok')} — ${ch.name}`);
      setTimeout(clearStatus, 3000);
    };

    vid.onerror = () => {
      _clearTimeout();
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', `${Lang.t('retrying')} (proxy ${next})`);
        vid.onloadedmetadata = null;
        vid.onerror = null;
        setTimeout(() => _playNative(STREAM_PROXIES[next](rawUrl), ch, rawUrl, next), 300);
      } else {
        setStatus('error', Lang.t('err_cors'));
      }
    };

    // Load timeout
    vid.onstalled = () => {
      _clearTimeout();
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', `Stalled - proxy ${next}`);
        vid.onerror = null;
        vid.onloadedmetadata = null;
        setTimeout(() => _playNative(STREAM_PROXIES[next](rawUrl), ch, rawUrl, next), 300);
      }
    };
  }

  // ── DESTROY (cleanup memoire complet) ──
  function _destroy(full = false) {
    _clearTimeout();

    // Clean up video element
    const vid = video();
    try {
      vid.pause();
      // Clear source properly
      vid.removeAttribute('src');
      // Force garbage collection of media resources
      if (typeof vid.srcObject !== 'undefined') {
        if (vid.srcObject) {
          const tracks = vid.srcObject.getTracks?.() || [];
          tracks.forEach(t => t.stop());
        }
        vid.srcObject = null;
      }
      // Load empty to free memory
      vid.load();
    } catch (_) { }

    // Destroy HLS
    if (hls) {
      try {
        hls.stopLoad();
        hls.detachMedia();
        hls.destroy();
      } catch (_) { }
      hls = null;
    }

    // Cancel any pending fetch
    if (_abortController) {
      try { _abortController.abort(); } catch (_) { }
      _abortController = null;
    }

    if (full) {
      vid.onloadeddata = null;
      vid.onerror = null;
      vid.onwaiting = null;
      vid.onstalled = null;
      vid.onplay = null;
    }
  }

  // ── STOP ──
  function stop() {
    _destroy(true);
    const vid = video();
    vid.removeAttribute('src');
    vid.load();
    overlay().style.display = 'flex';
    nowPlaying().hidden = true;
    clearStatus();
    current = null;
    _retryCount = 0;
  }

  // ── NOW PLAYING ──
  function _updateNowPlaying(ch) {
    const np = nowPlaying();
    np.hidden = false;
    document.getElementById('np-name').textContent = ch.name;
    document.getElementById('np-group').textContent = ch.group || '';
    const logo = document.getElementById('np-logo');
    if (ch.logo) {
      logo.src = ch.logo;
      logo.style.display = 'block';
      logo.loading = 'lazy';
    } else {
      logo.style.display = 'none';
    }
    document.getElementById('np-live').textContent = Lang.t('live');
  }

  // ── VOLUME ──
  function setVolume(v) {
    video().volume = parseFloat(v);
    _updateVolIcon(v == 0);
  }

  function toggleMute() {
    muted = !muted;
    video().muted = muted;
    _updateVolIcon(muted);
  }

  function _updateVolIcon(isMuted) {
    const btn = document.getElementById('vol-icon');
    const icon = isMuted ? 'volume-x' : 'volume-2';
    btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] });
  }

  // ── NAVIGATION ──
  function prev() {
    const { filtered, currentIndex } = App.state;
    if (!filtered.length) return;
    const ni = currentIndex <= 0 ? filtered.length - 1 : currentIndex - 1;
    App.playAt(ni);
  }

  function next() {
    const { filtered, currentIndex } = App.state;
    if (!filtered.length) return;
    const ni = currentIndex >= filtered.length - 1 ? 0 : currentIndex + 1;
    App.playAt(ni);
  }

  // ── FULLSCREEN ──
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.getElementById('video-wrap').requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.().catch(() => { });
    }
  }

  // ── PLAY URL ──
  function playUrl() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return;
    play({ name: url, group: Lang.t('play_url'), logo: '', url });
  }

  return { play, stop, prev, next, setVolume, toggleMute, toggleFullscreen, playUrl };
})();