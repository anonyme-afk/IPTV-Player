// ── SAFE LOCALSTORAGE WRAPPER ──
const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (e) {
      console.warn('[Store.get]', key, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Store.set quota?]', key, e);
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
};
