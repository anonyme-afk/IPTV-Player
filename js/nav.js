// ── 2D SPATIAL NAVIGATION (TV Remote / Keyboard) ──
const Nav = (() => {

  function getElements() {
    return Array.from(document.querySelectorAll('[data-nav]')).filter(el => {
      if (el.disabled) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function findNearest(current, dir) {
    const all = getElements();
    const c1  = center(current);
    let best = null, bestScore = Infinity;

    for (const el of all) {
      if (el === current) continue;
      const c2 = center(el);
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;

      // Directional filter (must be predominantly in the right direction)
      const inDir =
        (dir === 'up'    && dy < -5  && Math.abs(dx) < Math.abs(dy) * 2.5) ||
        (dir === 'down'  && dy > 5   && Math.abs(dx) < Math.abs(dy) * 2.5) ||
        (dir === 'left'  && dx < -5  && Math.abs(dy) < Math.abs(dx) * 2.5) ||
        (dir === 'right' && dx > 5   && Math.abs(dy) < Math.abs(dx) * 2.5);

      if (!inDir) continue;

      // Score = distance² + heavy penalty for off-axis
      const distSq = dx * dx + dy * dy;
      const axisPenalty = dir === 'up' || dir === 'down'
        ? Math.abs(dx) * 3
        : Math.abs(dy) * 3;
      const score = distSq + axisPenalty * axisPenalty;

      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function move(dir) {
    const active = document.activeElement;
    if (!active || !active.hasAttribute('data-nav')) {
      const first = getElements()[0];
      if (first) first.focus();
      return;
    }
    const target = findNearest(active, dir);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function init() {
    document.addEventListener('keydown', e => {
      // Global shortcuts (always active)
      if (e.key === 'F' || e.key === 'f') { if (!isTyping(e)) { Player.toggleFullscreen(); return; } }
      if (e.key === 'M' || e.key === 'm') { if (!isTyping(e)) { Player.toggleMute(); return; } }

      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); move('up');    break;
        case 'ArrowDown':  e.preventDefault(); move('down');  break;
        case 'ArrowLeft':
          if (!isTyping(e)) { e.preventDefault(); move('left'); }
          break;
        case 'ArrowRight':
          if (!isTyping(e)) { e.preventDefault(); move('right'); }
          break;
        case 'Enter':
        case ' ':
          if (document.activeElement?.hasAttribute('data-nav') && !isTyping(e)) {
            e.preventDefault();
            document.activeElement.click();
          }
          break;
        case 'Escape':
        case 'Backspace':
          if (!isTyping(e)) {
            if (document.getElementById('modal-bg').classList.contains('open')) { closeModal(); }
            else if (document.getElementById('sidebar').classList.contains('open')) { closeSidebar(); }
          }
          break;
        case 'PageUp':   if (!isTyping(e)) Player.prev(); break;
        case 'PageDown': if (!isTyping(e)) Player.next(); break;
      }
    });

    // Auto-focus first element after load
    setTimeout(() => {
      const first = getElements()[0];
      if (first) first.focus();
    }, 600);
  }

  function isTyping(e) {
    const tag = e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  return { init, move };
})();
