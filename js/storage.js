// ── STORAGE WRAPPER ──
const Store = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return fallback;
      return JSON.parse(val);
    } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch { return false; }
  },
};

// ── THEME MANAGER (no localStorage persistence — always dark default) ──
const ThemeManager = {

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f0f2f5' : '#0a0c0f';
  },

  load() {
    const theme = 'dark'; // always start dark
    this.apply(theme);
    return theme;
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  },

  watchSystem() {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      // Always respond to system changes regardless of previous manual toggle
      this.apply(e.matches ? 'light' : 'dark');
    });
  }
};

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.load();
  ThemeManager.watchSystem();
  // Theme toggle button handler
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', () => ThemeManager.toggle());
});