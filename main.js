const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

// ---------- עדכון אוטומטי ----------
// בודק גרסה חדשה ב-GitHub Releases של הריפו שהוגדר ב-package.json > build.publish.
// ההורדה וההתקנה מתבצעות ברקע; המשתמש רק מתבשר ומאשר הפעלה מחדש.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function checkForUpdates(manual) {
  autoUpdater.checkForUpdates().catch((err) => {
    if (manual) dialog.showErrorBox('בדיקת עדכונים נכשלה', String((err && err.message) || err));
  });
}

function wireAutoUpdaterEvents() {
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'none' });
  });
  autoUpdater.on('download-progress', (p) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'downloading', percent: Math.round(p.percent) });
  });
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'error', message: String((err && err.message) || err) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'ready', version: info.version });
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'עדכון מוכן להתקנה',
        message: `גרסה ${info.version} ירדה ומוכנה להתקנה.`,
        detail: 'ניתן להפעיל מחדש כדי להתקין עכשיו, או להמשיך לעבוד - העדכון יותקן אוטומטית בסגירה הבאה של התוכנה.',
        buttons: ['הפעל מחדש והתקן עכשיו', 'התקן בסגירה הבאה'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: 'Buffalo POS',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // the page uses localStorage/IndexedDB-style access patterns; keep Chromium sandbox for the renderer process itself (default), this flag only affects Electron's extra sandboxing
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(true);
  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open any target=_blank links (if the app ever creates one) in the OS browser instead of a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const template = [
    {
      label: 'קובץ',
      submenu: [
        { label: 'רענון', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { type: 'separator' },
        { label: 'יציאה', role: 'quit' }
      ]
    },
    {
      label: 'תצוגה',
      submenu: [
        { label: 'מסך מלא', accelerator: 'F11', click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'הגדלה', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'הקטנה', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'איפוס זום', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'כלי פיתוח', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'עדכונים',
      submenu: [
        { label: 'בדוק עדכונים כעת', click: () => checkForUpdates(true) },
        { label: `גרסה נוכחית: ${app.getVersion()}`, enabled: false }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single instance: focus the existing window instead of opening a second one
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    wireAutoUpdaterEvents();
    // בדיקת עדכון שקטה כ-5 שניות אחרי עליית האפליקציה (לא חוסמת את הטעינה הראשונית)
    setTimeout(() => checkForUpdates(false), 5000);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
