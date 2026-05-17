/**
 * IPTV Player — updater.js
 * Verifie si une nouvelle version est disponible sur GitHub.
 * Fonctionne dans le navigateur web, Electron et Capacitor.
 */

'use strict';

const Updater = {
  VERSION_URL: 'https://raw.githubusercontent.com/anonyme-afk/IPTV-channe/main/version.json',
  CURRENT_VERSION: '1.0.0', // Mis a jour manuellement a chaque release
  CURRENT_BUILD: 1,

  /**
   * Verifie la version distante. Affiche la popup si mise a jour disponible.
   * Appeler au demarrage de l'app, apres un delai de 3 secondes.
   */
  async check() {
    try {
      const res = await fetch(this.VERSION_URL + '?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const remote = await res.json();

      if (this._isNewer(remote.build, this.CURRENT_BUILD)) {
        this._showUpdateDialog(remote);
      }
    } catch(e) {
      // Silencieux — pas de connexion ou GitHub indisponible
      console.warn('[Updater] Verification echouee :', e.message);
    }
  },

  /**
   * Compare les numeros de build (entiers).
   * Plus fiable que comparer des strings "1.0.0" vs "1.0.1".
   */
  _isNewer(remoteBuild, localBuild) {
    return parseInt(remoteBuild) > parseInt(localBuild);
  },

  /**
   * Affiche la popup de mise a jour.
   */
  _showUpdateDialog(remote) {
    // Supprimer une popup existante
    document.getElementById('update-dialog')?.remove();

    // Detecter la plateforme pour le bon lien de telechargement
    const platform = this._detectPlatform();
    const dlUrl    = remote.download?.[platform] || remote.download?.windows || '#';

    const dialog = document.createElement('div');
    dialog.id = 'update-dialog';
    dialog.innerHTML = `
      <div id="update-dialog-inner">
        <div id="update-dialog-icon">
          <i data-lucide="download-cloud"></i>
        </div>
        <div id="update-dialog-content">
          <strong>Mise a jour disponible</strong>
          <span>Version ${remote.version} — ${remote.changelog || ''}</span>
        </div>
        <div id="update-dialog-actions">
          <button id="update-btn-ok" onclick="Updater._doUpdate('${dlUrl}')">
            Mettre a jour
          </button>
          <button id="update-btn-skip" onclick="Updater._dismiss()">
            Plus tard
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    if (window.lucide) lucide.createIcons({ nodes: [dialog] });

    // Auto-dismiss apres 30 secondes
    setTimeout(() => this._dismiss(), 30000);
  },

  _doUpdate(url) {
    this._dismiss();
    // Electron : l'auto-updater gere le telechargement en interne
    if (window.__ELECTRON__) {
      window.electronAPI?.checkForUpdates?.();
      return;
    }
    // Capacitor / Web : ouvrir le lien de telechargement
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener');
    }
  },

  _dismiss() {
    document.getElementById('update-dialog')?.remove();
  },

  _detectPlatform() {
    if (window.__ELECTRON__)     return 'windows';
    if (window.__CAPACITOR_TV__) return 'androidtv';
    if (window.Capacitor)        return 'android';
    return 'windows';
  }
};

/* Lancer la verification 4 secondes apres le chargement */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => Updater.check(), 4000);
});
