// ── PLAYER MODULE ──
const Player = (() => {
  let hls = null;
  let muted = false;
  let current = null;

  const video = () => document.getElementById('video');
  const overlay = () => document.getElementById('overlay');
  const statusBar = () => document.getElementById('status-bar');
  const nowPlaying = () => document.getElementById('now-playing');

  // CORS proxies tried in order when direct playback fails
  const STREAM_PROXIES = [
    url => url,                                                    // direct
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,    // corsproxy.io
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.org/?.${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
    url => `https://cors-anywhere.herokuapp.com/${url}`,
  ];

  // ── STATUS ──
  function setStatus(type, msg) {
    const bar = statusBar();
    bar.className = type;
    bar.textContent = msg;
    bar.style.display = type ? 'block' : 'none';
  }
  function clearStatus() { setStatus('', ''); }

  // ── PLAY ──
  function play(ch, { proxyIndex = 0 } = {}) {
    if (!ch) return;
    current = ch;

    // Clean up previous
    _destroy();
    const vid = video();
    vid.removeAttribute('src');
    vid.onloadeddata = null;
    vid.onerror = null;
    overlay().style.display = 'none';

    setStatus('loading', `${Lang.t('conn_to')} ${ch.name}...`);

    const rawUrl = ch.url;
    const url = STREAM_PROXIES[proxyIndex] ? STREAM_PROXIES[proxyIndex](rawUrl) : rawUrl;
    const isHls = rawUrl.match(/\.m3u8(\?|$)/i) || rawUrl.includes('/hls/');

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      _playHls(url, ch, rawUrl, proxyIndex);
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      _playNative(url, ch, rawUrl, proxyIndex);
    } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      _playHls(url, ch, rawUrl, proxyIndex);
    } else {
      _playNative(url, ch, rawUrl, proxyIndex);
    }

    _updateNowPlaying(ch);
    App.addHistory(ch);
  }

  function _playHls(url, ch, rawUrl, proxyIndex) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      fragLoadingMaxRetry: 3,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 2,
      fragLoadingRetryDelay: 1500,
    });

    hls.loadSource(url);
    hls.attachMedia(video());

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video().play().catch(() => { });
      setStatus('ok', `${Lang.t('playback_ok')} — ${ch.name}`);
      setTimeout(clearStatus, 3000);
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      console.warn('[HLS error]', data.type, data.details);

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        setStatus('loading', Lang.t('recovering'));
        hls.recoverMediaError();
        return;
      }

      // Fatal — try next proxy or fallback to native
      _destroy();
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', Lang.t('retrying'));
        play(ch, { proxyIndex: next });
      } else {
        _playNative(rawUrl, ch, rawUrl, 0);
      }
    });
  }

  function _playNative(url, ch, rawUrl, proxyIndex) {
    const vid = video();
    setStatus('loading', Lang.t('retrying'));
    vid.src = url;

    vid.onloadeddata = () => {
      setStatus('ok', `${Lang.t('playback_ok')} — ${ch.name}`);
      setTimeout(clearStatus, 3000);
    };

    vid.onerror = () => {
      const next = proxyIndex + 1;
      if (next < STREAM_PROXIES.length) {
        setStatus('loading', `${Lang.t('retrying')} (proxy ${next}/${STREAM_PROXIES.length - 1})`);
        vid.onloadeddata = null;
        vid.onerror = null;
        const proxyUrl = STREAM_PROXIES[next](rawUrl);
        vid.src = proxyUrl;
        vid.onloadeddata = () => {
          setStatus('ok', `${Lang.t('playback_ok')} — ${ch.name}`);
          setTimeout(clearStatus, 3000);
        };
        vid.onerror = () => {
          // Try next proxy recursively
          _playNative(STREAM_PROXIES[next](rawUrl), ch, rawUrl, next);
        };
        vid.play().catch(() => { });
      } else {
        setStatus('error', Lang.t('err_cors'));
      }
    };

    vid.play().catch(() => { });
  }

  function _destroy() {
    if (hls) { hls.destroy(); hls = null; }
  }

  function stop() {
    _destroy();
    const vid = video();
    vid.removeAttribute('src');
    vid.onloadeddata = null;
    vid.onerror = null;
    overlay().style.display = 'flex';
    nowPlaying().hidden = true;
    clearStatus();
    current = null;
  }

  function _updateNowPlaying(ch) {
    const np = nowPlaying();
    np.hidden = false;
    document.getElementById('np-name').textContent = ch.name;
    document.getElementById('np-group').textContent = ch.group || '';
    const logo = document.getElementById('np-logo');
    if (ch.logo) { logo.src = ch.logo; logo.style.display = 'block'; }
    else { logo.style.display = 'none'; }
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
      document.getElementById('video-wrap').requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
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
