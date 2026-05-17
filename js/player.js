// ── PLAYER MODULE V4 - Anti-freeze, Stall Detection, Pre-check ──
const Player = (() => {
  let hls = null;
  let muted = false;
  let current = null;
  let _playTimer = null;
  let _retryCount = 0;
  let _stallWatcher = null;
  let _lastTime = 0;
  let _statsInterval = null;
  let _statsVisible = false;
  let _abortController = null;

  const video = () => document.getElementById('video');
  const overlay = () => document.getElementById('overlay');
  const statusBar = () => document.getElementById('status-bar');
  const nowPlaying = () => document.getElementById('now-playing');
  const statsEl = () => document.getElementById('player-stats');

  // Proxys tries in order
  const STREAM_PROXIES = [
    url => url,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  // Detect iOS
  function _isiOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // Detect slow device
  function _isSlowDevice() {
    return (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  // ── STATUS ──
  function setStatus(type, msg) {
    const bar = statusBar();
    bar.className = type;
    bar.textContent = msg;
    bar.style.display = type ? 'block' : 'none';
  }
  function clearStatus() { setStatus('', ''); }

  // ── GEO BLOCK BANNER ──
  function showGeoBanner() {
    const b = document.getElementById('geo-banner');
    if (b) b.hidden = false;
  }
  function hideGeoBanner() {
    const b = document.getElementById('geo-banner');
    if (b) b.hidden = true;
  }
  function checkGeoBlock(ch) {
    const n = (ch?.name || '').toLowerCase();
    if (n.includes('geo-block') || n.includes('geoblocked')) {
      setTimeout(showGeoBanner, 1500);
    }
  }

  // ── TIMEOUT MANAGER ──
  function _startTimeout(ms = 10000) {
    clearTimeout(_playTimer);
    _playTimer = setTimeout(() => {
      _retryCount++;
      if (_retryCount < 2) {
        if (current) play(current, { proxyIndex: (current._proxyIdx || 0) + 1 });
      } else {
        setStatus('error', 'Flux indisponible (timeout)');
        _retryCount = 0;
        _checkSimilarChannels();
      }
    }, ms);
  }
  function _clearTimeout() {
    if (_playTimer) { clearTimeout(_playTimer); _playTimer = null; }
  }

  // ── STALL DETECTION ──
  function _startStallWatch() {
    _stopStallWatch();
    const vid = video();
    _lastTime = vid?.currentTime || 0;
    _stallWatcher = setInterval(() => {
      if (!vid || vid.paused || vid.ended || vid.readyState < 2) return;
      if (vid.currentTime === _lastTime) {
        console.warn('[Player] Stall detecte, recovery...');
        Player.hls?.recoverMediaError?.();
      }
      _lastTime = vid.currentTime;
    }, 3500);
  }
  function _stopStallWatch() {
    if (_stallWatcher) { clearInterval(_stallWatcher); _stallWatcher = null; }
  }

  // ── STATS DISPLAY ──
  function _updateStats() {
    if (!_statsVisible) return;
    const el = statsEl();
    if (!el) return;
    const vid = video();
    let text = '';
    if (Player.hls) {
      try {
        const level = Player.hls.levels?.[Player.hls.currentLevel];
        const bw = Math.round(Player.hls.bandwidthEstimate / 1000);
        const buf = vid.buffered?.length ? (vid.buffered.end(vid.buffered.length - 1) - vid.currentTime).toFixed(1) : '0';
        text = level ? `${level.width}x${level.height} | ${bw} kbps | buf: ${buf}s` : `${bw} kbps | buf: ${buf}s`;
      } catch (_) { }
    } else {
      const buf = vid.buffered?.length ? (vid.buffered.end(vid.buffered.length - 1) - vid.currentTime).toFixed(1) : '0';
      text = `natif | buf: ${buf}s`;
    }
    const res = `${vid.videoWidth || '?'}x${vid.videoHeight || '?'}`;
    el.textContent = `${res} | ${text}`;
  }

  function toggleStats() {
    _statsVisible = !_statsVisible;
    const el = statsEl();
    if (el) el.style.display = _statsVisible ? 'block' : 'none';
    if (_statsVisible && !_statsInterval) {
      _statsInterval = setInterval(_updateStats, 1000);
    } else if (!_statsVisible && _statsInterval) {
      clearInterval(_statsInterval); _statsInterval = null;
    }
  }

  // ── PRE-CHECK URL ──
  async function _preCheckUrl(url, timeoutMs = 3000) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, mode: 'no-cors' });
      clearTimeout(t);
      return true; // opaque = repond
    } catch (e) {
      if (e.name === 'AbortError') return true; // timeout = peut-etre vivant
      return false; // reseau mort
    }
  }

  // ── SIMILAR CHANNELS ──
  function _checkSimilarChannels() {
    try {
      const { channels, filtered } = App.state;
      if (!current || !channels?.length) return;
      const similar = channels
        .filter(c => c.group === current.group && c.url !== current.url)
        .slice(0, 3);
      if (similar.length) {
        const names = similar.map(c => c.name).join(', ');
        setStatus('error', `Indisponible. Essayer: ${names}`);
        let existing = document.getElementById('similar-suggest');
        if (existing) existing.remove();
        const bar = document.getElementById('status-bar');
        const suggestDiv = document.createElement('div');
        suggestDiv.id = 'similar-suggest';
        suggestDiv.style.cssText = 'display:flex;gap:6px;padding:6px 14px;flex-wrap:wrap';
        similar.forEach(ch => {
          const btn = document.createElement('button');
          btn.textContent = ch.name;
          btn.className = 'ctrl-btn';
          btn.style.fontSize = '11px';
          btn.onclick = () => {
            const idx = filtered.indexOf(ch);
            if (idx >= 0) App.playAt(idx);
          };
          suggestDiv.appendChild(btn);
        });
        bar.parentNode.insertBefore(suggestDiv, bar.nextSibling);
        setTimeout(() => suggestDiv?.remove(), 10000);
      }
    } catch (_) { }
  }

  // ── RADIO DETECTION ──
  function isRadioChannel(channel) {
    if (!channel) return false;
    if (channel.is_radio === true) return true;
    const url = (channel.url || '').toLowerCase();
    return url.endsWith('.mp3') ||
           url.endsWith('.aac') ||
           url.endsWith('.ogg') ||
           url.includes('icecast') ||
           url.includes('shoutcast') ||
           url.includes('/stream') ||
           (url.includes('/live') && !url.includes('.m3u8'));
  }

  // ── PLAY ──
  async function play(ch, { proxyIndex = 0 } = {}) {
    if (!ch) return;
    if (!current || current.url !== ch.url) _retryCount = 0;
    current = ch;
    ch._proxyIdx = proxyIndex;
    _statsVisible = false;
    const sel = statsEl();
    if (sel) sel.style.display = 'none';

    hideGeoBanner();

    await _cleanupMedia();
    const vid = video();
    overlay().style.display = 'none';

    setStatus('loading', `${Lang.t('conn_to')} ${ch.name}...`);

    const rawUrl = ch.url;
    const url = STREAM_PROXIES[proxyIndex] ? STREAM_PROXIES[proxyIndex](rawUrl) : rawUrl;
    
    const isRadio = isRadioChannel(ch);
    const isHls = !isRadio && (rawUrl.match(/\.m3u8(\?|$)/i) || rawUrl.includes('/hls/') || rawUrl.includes('.m3u'));

    if (proxyIndex === 0) {
      const alive = await _preCheckUrl(rawUrl, 2000);
      if (!alive) {
        setStatus('loading', 'Lien direct inaccessible, essai proxy...');
        return play(ch, { proxyIndex: 1 });
      }
    }

    vid.preload = 'none';
    vid.autoplay = false;

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      _playHls(url, ch, rawUrl, proxyIndex);
    } else {
      _playNative(url, ch, rawUrl, proxyIndex);
    }

    _updateNowPlaying(ch);
    try { App.addHistory(ch); } catch (_) { }
    checkGeoBlock(ch);
  }

  // ── HLS PLAYBACK ──
  function _playHls(url, ch, rawUrl, proxyIndex) {
    _startTimeout(15000);

    const isIOS = _isiOS();
    const isSlow = _isSlowDevice();
    Player.hls = new Hls({
      enableWorker:           !isIOS,
      lowLatencyMode:         true,
      liveSyncDurationCount:  3,
      liveMaxLatencyDurationCount: 10,
      backbufferLength:       isSlow ? 6 : 10,       // 30 -> 10 : economise la memoire
      maxBufferLength:        isSlow ? 10 : 15,
      maxMaxBufferLength:     isSlow ? 15 : 30,
      maxBufferSize:          isSlow ? 15 * 1024 * 1024 : 30 * 1024 * 1024,
      maxBufferHole:          1.0,      // 0.5 -> 1.0 : plus tolerant aux trous
      fragLoadingMaxRetry:    3,
      manifestLoadingMaxRetry:3,
      levelLoadingMaxRetry:   2,
      fragLoadingTimeOut:     10000,
      manifestLoadingTimeOut: 10000,
      startLevel:             isSlow ? 0 : -1,
      capLevelToPlayerSize:   true,
    });

    Player.hls.loadSource(url);
    Player.hls.attachMedia(video());

    Player.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      _clearTimeout();
      _startStallWatch();
      const levels = Player.hls.levels || [];
      if (levels.length > 1) {
        const mid = Math.floor(levels.length / 2);
        Player.hls.currentLevel = mid;
      }
      setStatus('ok', `${Lang.t('playback_ok')} - ${ch.name}`);
      video().play().catch(() => { });
      setTimeout(clearStatus, 3000);
    });

    let fragLoadFailCount = 0;
    Player.hls.on(Hls.Events.LEVEL_LOADED, () => _clearTimeout());
    Player.hls.on(Hls.Events.FRAG_LOADED, () => { _retryCount = 0; fragLoadFailCount = 0; });

    Player.hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try { Player.hls.recoverMediaError(); return; } catch (_) { }
      }

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        fragLoadFailCount++;
        if (fragLoadFailCount < 3) return; // Keep trying
      }

      _stopStallWatch();
      if (Player.hls) {
        try { Player.hls.stopLoad(); Player.hls.detachMedia(); Player.hls.destroy(); } catch (_) { }
        Player.hls = null;
      }

      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', `${Lang.t('retrying')} (proxy ${next})`);
        setTimeout(() => play(ch, { proxyIndex: next }), 500);
      } else {
        setStatus('error', Lang.t('err_cors'));
        _checkSimilarChannels();
      }
    });
  }

  // ── NATIVE PLAYBACK ──
  function _playNative(url, ch, rawUrl, proxyIndex) {
    const vid = video();
    _startTimeout(15000);
    setStatus('loading', Lang.t('retrying'));

    vid.removeAttribute('src');
    vid.load();

    requestAnimationFrame(() => {
      vid.src = url;
      vid.preload = 'metadata';
    });

    vid.onloadedmetadata = () => {
      _clearTimeout();
      _startStallWatch();
      vid.play().catch(() => { });
      setStatus('ok', `${Lang.t('playback_ok')} - ${ch.name}`);
      setTimeout(clearStatus, 3000);
    };

    vid.onerror = () => {
      _clearTimeout();
      _stopStallWatch();
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setTimeout(() => _playNative(STREAM_PROXIES[next](rawUrl), ch, rawUrl, next), 300);
      } else {
        setStatus('error', Lang.t('err_cors'));
        _checkSimilarChannels();
      }
    };

    vid.onstalled = () => {
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setTimeout(() => _playNative(STREAM_PROXIES[next](rawUrl), ch, rawUrl, next), 300);
      }
    };
  }

  // ── CLEANUP (async to prevent Hls conflicts) ──
  async function _cleanupMedia() {
    _stopStallWatch();
    if (Player.hls) {
      try { 
        Player.hls.stopLoad();
        Player.hls.detachMedia();
        Player.hls.destroy(); 
      } catch (_) { }
      Player.hls = null;
    }
    const vid = video();
    if (vid) {
      try {
        vid.removeAttribute('src');
        vid.load();
      } catch (_) { }
    }
    if (_abortController) { try { _abortController.abort(); } catch (_) { } _abortController = null; }
    document.getElementById('similar-suggest')?.remove();

    await new Promise(r => setTimeout(r, 50));
  }

  // For backward compatibility / external stop
  function _destroyFull() {
    _cleanupMedia();
  }

  // ── STOP ──
  async function stop() {
    await _cleanupMedia();
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
    if (ch.logo) { logo.src = ch.logo; logo.style.display = 'block'; logo.loading = 'lazy'; }
    else { logo.style.display = 'none'; }
    document.getElementById('np-live').textContent = Lang.t('live');
  }

  // ── VOLUME ──
  function setVolume(v) { video().volume = parseFloat(v); _updateVolIcon(v == 0); }
  function toggleMute() { muted = !muted; video().muted = muted; _updateVolIcon(muted); }
  function _updateVolIcon(isMuted) {
    const btn = document.getElementById('vol-icon');
    if (!btn) return;
    const iconName = isMuted ? 'volume-x' : 'volume-2';
    btn.innerHTML = Icons.get(iconName);
  }

  // ── NAVIGATION ──
  function prev() {
    const { filtered, currentIdx } = App.state;
    if (!filtered.length) return;
    App.playAt(currentIdx <= 0 ? filtered.length - 1 : currentIdx - 1);
  }
  function next() {
    const { filtered, currentIdx } = App.state;
    if (!filtered.length) return;
    App.playAt(currentIdx >= filtered.length - 1 ? 0 : currentIdx + 1);
  }

  // ── FULLSCREEN ──
  function toggleFullscreen() {
    const vid = video();
    if (_isiOS() && vid.webkitEnterFullscreen) {
      vid.webkitEnterFullscreen();
      return;
    }
    if (!document.fullscreenElement) {
      document.getElementById('player-area').requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.().catch(() => { });
    }
  }

  // ── PICTURE-IN-PICTURE ──
  function togglePiP() {
    const vid = video();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => { });
    } else if (document.pictureInPictureEnabled) {
      vid.requestPictureInPicture().catch(() => {
        setStatus('error', 'PiP non disponible');
        setTimeout(clearStatus, 2000);
      });
    }
  }

  // ── SCREENSHOT ──
  function captureFrame() {
    const vid = video();
    if (!vid.videoWidth || !vid.videoHeight) {
      setStatus('error', 'Aucune video a capturer');
      setTimeout(clearStatus, 2000);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    canvas.getContext('2d').drawImage(vid, 0, 0);
    const a = document.createElement('a');
    a.download = `capture_${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    setStatus('ok', 'Capture enregistree');
    setTimeout(clearStatus, 2000);
  }

  // ── PLAY URL ──
  function playUrl() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return;
    play({ name: url, group: Lang.t('play_url'), logo: '', url });
  }

  // ── ZAPPING ──
  let _zapBuffer = '';
  let _zapTimer = null;
  function initZapping() {
    document.addEventListener('keydown', e => {
      if (e.key >= '0' && e.key <= '9') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        clearTimeout(_zapTimer);
        _zapBuffer += e.key;
        const idx = parseInt(_zapBuffer) - 1;
        const { filtered } = App.state;
        if (idx >= 0 && idx < filtered.length) {
          setStatus('loading', `→ ${filtered[idx].name} (${_zapBuffer})`);
        }
        _zapTimer = setTimeout(() => {
          const num = parseInt(_zapBuffer) - 1;
          if (App.state.filtered[num]) App.playAt(num);
          _zapBuffer = '';
        }, 1000);
      }
    });
  }

  return {
    play, stop, prev, next,
    setVolume, toggleMute, toggleFullscreen,
    playUrl, togglePiP, captureFrame, toggleStats,
    initZapping, hideGeoBanner,
  };
})();

// EXPOSER hls pour les stats
Player.hls = null;
