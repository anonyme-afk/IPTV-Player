'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/* Exposer une API securisee au renderer (index.html) */
contextBridge.exposeInMainWorld('electronAPI', {
  /* Version */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /* Mises a jour */
  checkForUpdates: () => ipcRenderer.send('download-update'),
  installUpdate:   () => ipcRenderer.send('install-update'),

  /* Ecouter les evenements du main */
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, data) => cb(data)),
  onUpdateDownloaded:(cb) => ipcRenderer.on('update-downloaded', () => cb()),
});

/* Injecter un flag pour que updater.js sache qu'on est dans Electron */
window.__ELECTRON__ = true;
