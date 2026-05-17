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

const Storage = {
  getFavorites() { return Store.get('iptv_favs', []); },
  toggleFavorite(url) {
    let favs = this.getFavorites();
    const idx = favs.indexOf(url);
    if (idx === -1) favs.push(url); else favs.splice(idx, 1);
    Store.set('iptv_favs', favs);
    return favs;
  },
  getHistory() { return Store.get('iptv_hist', []); },
  addToHistory(url) {
    let hist = this.getHistory();
    hist = hist.filter(u => u !== url);
    hist.unshift(url);
    if (hist.length > 50) hist.pop();
    Store.set('iptv_hist', hist);
  },
  restoreSession() {
    // Optionally restore last state
  }
};
