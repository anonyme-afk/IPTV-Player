'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

/* ── Configuration ── */
const IS_DEV  = process.argv.includes('--dev');
const IS_WIN  = process.platform === 'win32';

let mainWindow  = null;
let splashWindow = null;

/* ══════════════════════════════════════════
   SPLASH SCREEN
══════════════════════════════════════════ */
function createSplash() {
  splashWindow = new BrowserWindow({
    width:           360,
    height:          200,
    frame:           false,
    transparent:     true,
    resizable:       false,
    skipTaskbar:     true,
    alwaysOnTop:     true,
    webPreferences:  { nodeIntegration: false }
  });
  splashWindow.loadFile('electron/splash.html');
}

/* ══════════════════════════════════════════
   FENETRE PRINCIPALE
══════════════════════════════════════════ */
function createMain() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          780,
    minWidth:        800,
    minHeight:       500,
    show:            false,          // affiche apres le chargement
    frame:           true,
    titleBarStyle:   'default',
    icon:            path.join(__dirname, '../build/icon.ico'),
    title:           'IPTV Player',
    backgroundColor: '#070a0f',
    webPreferences: {
      preload:               path.join(__dirname, 'preload.js'),
      nodeIntegration:       false,
      contextIsolation:      true,
      webSecurity:           false,    // requis pour charger des flux locaux
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile('index.html');

  /* Afficher la fenetre quand pret + fermer le splash */
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools();
  });

  /* Ouvrir les liens externes dans le navigateur systeme */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') || url.startsWith('https')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  /* Raccourcis DevTools en dev */
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (IS_DEV && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ══════════════════════════════════════════
   AUTO-UPDATER (GitHub Releases)
══════════════════════════════════════════ */
function setupAutoUpdater() {
  if (IS_DEV) return;

  autoUpdater.autoDownload    = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version:   info.version,
      changelog: info.releaseNotes || 'Nouvelle version disponible'
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater]', err.message);
  });

  // Verifier toutes les 2 heures
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);
}

/* ══════════════════════════════════════════
   IPC — communication renderer <-> main
══════════════════════════════════════════ */
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate().catch(console.error);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => app.getVersion());

/* ══════════════════════════════════════════
   CYCLE DE VIE APP
══════════════════════════════════════════ */
app.whenReady().then(() => {
  createSplash();
  setTimeout(() => {
    createMain();
    setupAutoUpdater();
  }, 1200);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMain();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* Securite : bloquer les nouvelles fenetres non autorisees */
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
});
