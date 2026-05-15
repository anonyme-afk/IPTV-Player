// ── 2D SPATIAL NAVIGATION V2 (TV Remote / Keyboard / Gamepad) ──
const Nav = (() => {

  let _initialized = false;
  let _autoFocusTimer = null;
  let _gamepadInterval = null;
  let _debug = false;
  let _lastMoveTime = 0;
  let _moveThrottle = 0;
  let _visibleElementsCache = [];
  let _cacheInvalidated = true;

  // ── DEBUG TOGGLE ──
  function _log(...args) {
    if (_debug) console.log('[Nav]', ...args);
  }

  // ── INVALIDATE CACHE WHEN DOM CHANGES ──
  function _invalidateCache() {
    _cacheInvalidated = true;
  }

  // ── GET VISIBLE NAVIGABLE ELEMENTS (CACHED) ──
  function getElements(force = false) {
    if (!force && !_cacheInvalidated && _visibleElementsCache.length) return _visibleElementsCache;

    const start = performance.now();
    const visible = Array.from(document.querySelectorAll('[data-nav]')).filter(el => {
      if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (el.offsetParent === null && !el.classList.contains('ch-item')) return false;
      if (s.opacity === '0' || parseFloat(s.opacity) < 0.1) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      // Check if element is within viewport bounds (performance optimization)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (r.right < -100 || r.left > vw + 100 || r.bottom < -100 || r.top > vh + 100) return false;
      return true;
    });

    _visibleElementsCache = visible;
    _cacheInvalidated = false;
    _log(`getElements: ${visible.length} found (${(performance.now() - start).toFixed(1)}ms)`);
    return visible;
  }

  // ── GET CENTER WITH OFFSET FOR BETTER GRID NAVIGATION ──
  function center(el, { biasX = 0, biasY = 0 } = {}) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 + biasX,
      y: r.top + r.height / 2 + biasY,
      w: r.width,
      h: r.height,
    };
  }

  // ── CHECK IF TWO RECTANGLES OVERLAP ON AN AXIS ──
  function _overlaps(a, b, axis = 'x') {
    const halfA = (axis === 'x' ? a.w : a.h) / 2;
    const halfB = (axis === 'x' ? b.w : b.h) / 2;
    return (a[axis] - halfA) < (b[axis] + halfB) && (a[axis] + halfA) > (b[axis] - halfB);
  }

  // ── INTELLIGENT NEAREST NEIGHBOR WITH GRID DETECTION ──
  function _findNearest(current, dir) {
    const all = getElements();
    const c1 = center(current);
    let best = null;
    let bestScore = Infinity;

    for (const el of all) {
      if (el === current) continue;
      const c2 = center(el);
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Minimum distance threshold
      const minDist = 5;

      // Check overlap on perpendicular axis (elements in same column/row)
      const overlapX = _overlaps(c1, c2, 'x');
      const overlapY = _overlaps(c1, c2, 'y');

      // Directional filter with tolerance for elements in same row/column
      let inDir = false;
      if (dir === 'up') inDir = dy < -minDist && (overlapX || absDx < absDy * 2.5);
      if (dir === 'down') inDir = dy > minDist && (overlapX || absDx < absDy * 2.5);
      if (dir === 'left') inDir = dx < -minDist && (overlapY || absDy < absDx * 2.5);
      if (dir === 'right') inDir = dx > minDist && (overlapY || absDy < absDx * 2.5);

      if (!inDir) continue;

      // Weighted score with overlap bonus + size normalization
      const distSq = dx * dx + dy * dy;
      const overlapBonus = _overlaps(c1, c2, dir === 'up' || dir === 'down' ? 'x' : 'y') ? -60 : 40;
      const sizeArea = c2.w * c2.h;
      const sizeNorm = Math.min(1, sizeArea / (500 * 40)); // normalise pour ~500x40 = chaîne
      const sizeBonus = -sizeNorm * 25;
      const score = distSq + overlapBonus + sizeBonus;

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best;
  }

  // ── MOVE FOCUS ──
  function move(dir) {
    const now = performance.now();
    // Throttle moves (120fps max = ~8ms)
    if (now - _lastMoveTime < 8) return;
    _lastMoveTime = now;

    const active = document.activeElement;
    if (!active || !active.hasAttribute('data-nav')) {
      _focusFirst();
      return;
    }
    const target = _findNearest(active, dir);
    if (target) {
      _focus(target, dir);
    } else {
      _wrapAround(active, dir);
    }
  }

  // ── WRAP AROUND (cycle when reaching edge) ──
  function _wrapAround(current, dir) {
    const all = getElements();
    if (all.length < 2) return;
    const c1 = center(current);

    let candidates = [];
    for (const el of all) {
      if (el === current) continue;
      const c2 = center(el);
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;

      if (dir === 'up' && dy > 0) candidates.push({ el, score: c2.y });
      if (dir === 'down' && dy < 0) candidates.push({ el, score: -c2.y });
      if (dir === 'left' && dx > 0) candidates.push({ el, score: c2.x });
      if (dir === 'right' && dx < 0) candidates.push({ el, score: -c2.x });
    }

    if (candidates.length) {
      candidates.sort((a, b) => a.score - b.score);
      _focus(candidates[0].el, dir);
    } else {
      // Focus the closest element as last resort
      _findClosestAny(current, dir);
    }
  }

  // ── FALLBACK: FIND CLOSEST ELEMENT IN ANY DIRECTION ──
  function _findClosestAny(current, dir) {
    const all = getElements();
    if (all.length < 2) return;
    const c1 = center(current);
    let best = null;
    let bestDist = Infinity;

    for (const el of all) {
      if (el === current) continue;
      const c2 = center(el);
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;

      // Pick element furthest in the desired direction
      const score = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      if (score > 0 && score < bestDist) {
        bestDist = score;
        best = el;
      }
    }

    if (best) _focus(best, dir);
  }

  // ── FOCUS ELEMENT WITH SMOOTH SCROLL ──
  function _focus(el, dir = null) {
    if (!el) return;
    el.focus({ preventScroll: false });

    // Determine best scroll axis based on direction
    let block = dir === 'up' ? 'center' : dir === 'down' ? 'center' : 'nearest';
    let inline = dir === 'left' || dir === 'right' ? 'center' : 'nearest';

    // For ch-item elements in a vertical list: scroll vertical only
    if (el.classList.contains('ch-item')) {
      block = 'center';
      inline = 'nearest';
    }

    el.scrollIntoView({ block, inline, behavior: 'smooth' });

    _playFocusSound();
    _log(`Focus → ${el.tagName}.${el.className.split(' ').join('.')} [${dir}]`);
  }

  // ── FOCUS FIRST VALID ELEMENT ──
  function _focusFirst() {
    const all = getElements();
    if (!all.length) return;

    // Priority queue: search bar first, then active tab, etc.
    const selectors = ['#search', '.tab-btn.active', '#load-btn', '.cat-btn.active', '.ch-item', '[data-nav]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.hasAttribute('data-nav') && all.includes(el)) {
        _focus(el);
        return;
      }
    }
    _focus(all[0]);
  }

  // ── SUBTLE FOCUS SOUND (only if user has interacted) ──
  let _audioCtx = null;
  function _playFocusSound() {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === 'suspended') return;
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.frequency.value = 1200 + Math.random() * 100; // slight variation
      osc.type = 'sine';
      const now = _audioCtx.currentTime;
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (_) { /* silently fail */ }
  }

  // ── GAMEPAD API SUPPORT ──
  let _gamepadLastDir = null;
  let _gamepadLastTime = 0;
  function _initGamepad() {
    const DIR_REPEAT_DELAY = 300;
    const DIR_REPEAT_RATE = 100;

    _gamepadInterval = setInterval(() => {
      try {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of gamepads) {
          if (!gp || !gp.connected) continue;

          const axisLX = gp.axes[0] || 0;
          const axisLY = gp.axes[1] || 0;
          const DEADZONE = 0.4;

          let dir = null;
          if (axisLY < -DEADZONE) dir = 'up';
          else if (axisLY > DEADZONE) dir = 'down';
          else if (axisLX < -DEADZONE) dir = 'left';
          else if (axisLX > DEADZONE) dir = 'right';

          // D-Pad
          if (gp.buttons[12]?.pressed) dir = 'up';
          else if (gp.buttons[13]?.pressed) dir = 'down';
          else if (gp.buttons[14]?.pressed) dir = 'left';
          else if (gp.buttons[15]?.pressed) dir = 'right';

          const now = Date.now();
          if (dir) {
            if (dir !== _gamepadLastDir || now - _gamepadLastTime > (_gamepadLastDir === dir ? DIR_REPEAT_RATE : DIR_REPEAT_DELAY)) {
              move(dir);
              _gamepadLastDir = dir;
              _gamepadLastTime = now;
            }
          } else {
            _gamepadLastDir = null;
          }

          // Buttons (only on press, not hold)
          if (gp.buttons[0]?.pressed) {
            document.activeElement?.hasAttribute('data-nav') && document.activeElement.click();
          }
          if (gp.buttons[1]?.pressed || gp.buttons[8]?.pressed) _handleBack();
          if (gp.buttons[9]?.pressed) Player.toggleFullscreen();
          if (gp.buttons[4]?.pressed) Player.stop();
          if (gp.buttons[5]?.pressed) { Player.prev(); }
          if (gp.buttons[6]?.pressed) { Player.next(); }
          if (gp.buttons[7]?.pressed) Player.stop();
        }
      } catch (_) { }
    }, 60); // ~16Hz
  }

  // ── BACK / CLOSE HANDLER ──
  function _handleBack() {
    const modal = document.getElementById('modal-bg');
    const sidebar = document.getElementById('sidebar');
    if (modal?.classList.contains('open')) {
      closeModal();
      _focus(document.getElementById('load-btn') || document.querySelector('[data-nav]'));
    } else if (sidebar?.classList.contains('open')) {
      closeSidebar();
    } else {
      Player.stop();
    }
  }

  // ── TOUCH / MOBILE REMOTE OVERLAY ──
  function _showRemoteOverlay() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const existing = document.getElementById('remote-overlay');
    if (existing) {
      existing.classList.toggle('visible');
      clearTimeout(existing._hideTimer);
      if (existing.classList.contains('visible')) {
        existing._hideTimer = setTimeout(() => existing.classList.remove('visible'), 6000);
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'remote-overlay';
    overlay.className = 'remote-overlay visible';

    const createBtn = (icon, action, label) => {
      const b = document.createElement('button');
      b.className = 'remote-btn';
      b.innerHTML = `<i data-lucide="${icon}"></i>`;
      b.setAttribute('aria-label', label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
      return b;
    };

    const grid = document.createElement('div');
    grid.className = 'remote-grid';
    grid.appendChild(document.createElement('div'));
    grid.appendChild(createBtn('arrow-up', () => move('up'), 'Haut'));
    grid.appendChild(document.createElement('div'));
    grid.appendChild(createBtn('arrow-left', () => move('left'), 'Gauche'));
    grid.appendChild(createBtn('circle', () => {
      const a = document.activeElement;
      if (a?.hasAttribute('data-nav')) a.click();
    }, 'OK'));
    grid.appendChild(createBtn('arrow-right', () => move('right'), 'Droite'));
    grid.appendChild(document.createElement('div'));
    grid.appendChild(createBtn('arrow-down', () => move('down'), 'Bas'));
    grid.appendChild(document.createElement('div'));

    const bottom = document.createElement('div');
    bottom.className = 'remote-bottom';
    bottom.appendChild(createBtn('corner-down-left', _handleBack, 'Retour'));
    bottom.appendChild(createBtn('square', () => Player.stop(), 'Stop'));
    bottom.appendChild(createBtn('maximize', () => Player.toggleFullscreen(), 'Plein écran'));
    bottom.appendChild(createBtn('skip-back', () => Player.prev(), 'Précédent'));
    bottom.appendChild(createBtn('skip-forward', () => Player.next(), 'Suivant'));

    overlay.appendChild(grid);
    overlay.appendChild(bottom);

    const close = document.createElement('button');
    close.className = 'remote-close';
    close.innerHTML = '<i data-lucide="x"></i>';
    close.addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.appendChild(close);

    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [overlay] });

    overlay._hideTimer = setTimeout(() => overlay.classList.remove('visible'), 6000);
    _log('Remote overlay shown');
  }

  // ── KEYBOARD HANDLER ──
  function _onKeyDown(e) {
    const tag = e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Global shortcuts
    if (!typing) {
      switch (e.key) {
        case 'F': case 'f': Player.toggleFullscreen(); e.preventDefault(); return;
        case 'M': case 'm': Player.toggleMute(); e.preventDefault(); return;
        case 'R': case 'r': _showRemoteOverlay(); e.preventDefault(); return;
        case '?': case '/': e.preventDefault(); _toggleHelp(); return;
        case 'D': case 'd': _debug = !_debug; _log('Debug mode', _debug ? 'ON' : 'OFF'); return;
      }
    }

    switch (e.key) {
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
        if (!typing) {
          e.preventDefault();
          move({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]);
        }
        break;
      case 'Enter':
        if (!typing && document.activeElement?.hasAttribute('data-nav')) {
          e.preventDefault();
          document.activeElement.click();
        }
        break;
      case ' ':
        if (typing) break;
        e.preventDefault();
        if (document.activeElement?.hasAttribute('data-nav')) {
          document.activeElement.click();
        }
        break;
      case 'Escape': case 'Backspace':
        if (!typing) { e.preventDefault(); _handleBack(); }
        break;
      case 'PageUp': case 'PageDown':
        if (!typing) {
          e.preventDefault();
          if (e.key === 'PageUp') Player.prev();
          else Player.next();
        }
        break;
      case 'Home':
        if (!typing) { e.preventDefault(); _focusFirst(); }
        break;
      case 'Tab':
        if (!typing) {
          e.preventDefault();
          const all = getElements();
          const idx = all.indexOf(document.activeElement);
          const next = e.shiftKey
            ? (idx <= 0 ? all[all.length - 1] : all[idx - 1])
            : (idx >= all.length - 1 ? all[0] : all[idx + 1]);
          if (next) _focus(next);
        }
        break;
    }
  }

  // ── HELP OVERLAY ──
  function _toggleHelp() {
    const existing = document.getElementById('shortcuts-help');
    if (existing) { existing.remove(); return; }

    const div = document.createElement('div');
    div.id = 'shortcuts-help';
    div.innerHTML = `
      <div class="shortcuts-content">
        <h2><i data-lucide="keyboard"></i> Raccourcis clavier</h2>
        <div class="shortcuts-grid">
          <span class="key">↑↓←→</span><span>Navigation 2D</span>
          <span class="key">Enter ␣</span><span>Sélectionner</span>
          <span class="key">Esc ⌫</span><span>Fermer / Retour</span>
          <span class="key">F</span><span>Plein écran</span>
          <span class="key">M</span><span>Muet</span>
          <span class="key">R</span><span>Télécommande tactile</span>
          <span class="key">Pg↑ Pg↓</span><span>Chaîne préc./suiv.</span>
          <span class="key">Home</span><span>Premier élément</span>
          <span class="key">Tab ↹</span><span>Élément suivant</span>
          <span class="key">D</span><span>Mode debug</span>
          <span class="key">?</span><span>Cette aide</span>
        </div>
        <p class="shortcuts-hint">Clique ou appuie sur <kbd>?</kbd> pour fermer</p>
      </div>
    `;
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });
    document.body.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [div] });
  }

  // ── INIT ──
  function init() {
    if (_initialized) return;
    _initialized = true;

    document.addEventListener('keydown', _onKeyDown);

    // Invalidate cache on DOM mutations
    const observer = new MutationObserver(() => {
      _invalidateCache();
      clearTimeout(_autoFocusTimer);
      _autoFocusTimer = setTimeout(() => {
        const active = document.activeElement;
        if (!active || !active.hasAttribute('data-nav') || !document.body.contains(active)) {
          // Don't steal focus from inputs
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
            _focusFirst();
          }
        }
      }, 400);
    });
    observer.observe(document.getElementById('app') || document.body, {
      childList: true, subtree: true, attributes: false,
    });

    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
      _invalidateCache();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const active = document.activeElement;
        if (active?.hasAttribute('data-nav') && getElements().includes(active)) {
          active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 150);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
      _invalidateCache();
      setTimeout(() => _focusFirst(), 300);
    });

    // Initial focus after everything is loaded
    const focus = () => {
      clearTimeout(_autoFocusTimer);
      _autoFocusTimer = setTimeout(() => _focusFirst(), 300);
    };
    if (document.readyState === 'complete') focus();
    else window.addEventListener('load', focus);

    // Gamepad (lazy init on user interaction)
    if (navigator.getGamepads) {
      const startGP = () => {
        _initGamepad();
        ['click', 'keydown', 'touchstart'].forEach(ev =>
          document.removeEventListener(ev, startGP, { once: true }));
      };
      document.addEventListener('click', startGP, { once: true });
      document.addEventListener('keydown', startGP, { once: true });
      document.addEventListener('touchstart', startGP, { once: true });
    }

    // Touch gestures (passive for performance)
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 3) {
        e.preventDefault();
        _showRemoteOverlay();
      }
    }, { passive: false });

    // Expose debug
    window.__navDebug = () => { _debug = !_debug; _log('Debug', _debug ? 'ON' : 'OFF'); return getElements().length; };

    _log('2D Spatial Navigation initialized');
  }

  function reset() {
    _initialized = false;
    clearInterval(_gamepadInterval);
    _gamepadInterval = null;
    _invalidateCache();
    _focusFirst();
  }

  return { init, move, reset, getElements };
})();