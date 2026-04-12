const { app, BrowserWindow, Menu, shell, globalShortcut } = require('electron');
const path = require('path');
const isProd = app.isPackaged || process.env.NODE_ENV === 'production';

// ── Start the Express + WS server ──
let serverProcess;
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const server = require('./server');
    } catch (err) {
      console.error('[CLOUDCODE] Falha ao carregar server.js:', err);
      return reject(err);
    }

    // Health check loop — muito mais confiável que setTimeout
    const maxAttempts = 30;
    let attempts = 0;

    const check = () => {
      const http = require('http');
      const req = http.get('http://localhost:4242/health', (res) => {
        if (res.statusCode === 200) {
          console.log('[CLOUDCODE] Server pronto!');
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(1000, retry);
    };

    const retry = () => {
      if (++attempts >= maxAttempts) {
        console.error('[CLOUDCODE] Server não respondeu após 30 tentativas');
        resolve(); // resolve anyway pra não travar o app
      } else {
        setTimeout(check, 300);
      }
    };

    // Dar 200ms pro server começar a ouvir antes do primeiro check
    setTimeout(check, 200);
  });
}

let mainWindow;

function triggerCaptureShortcut() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('cloudcode:capture-shortcut'));").catch(() => {});
}

function registerShortcuts() {
  const shortcuts = ['CommandOrControl+Shift+1'];

  shortcuts.forEach((shortcut) => {
    const ok = globalShortcut.register(shortcut, triggerCaptureShortcut);
    if (!ok) console.warn(`Shortcut unavailable: ${shortcut}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#FFFFFF',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: isProd,
    show: false,
  });

  mainWindow.loadURL('http://localhost:4242');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isProd) {
      mainWindow.webContents.closeDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Menu ──
function buildMenu() {
  const template = [
    {
      label: 'CLOUDCODE',
      submenu: [
        { label: 'Sobre CLOUDCODE', role: 'about' },
        { type: 'separator' },
        { label: 'Preferências...', accelerator: 'CmdOrCtrl+,', click: () => {} },
        { type: 'separator' },
        { label: 'Ocultar CLOUDCODE', role: 'hide' },
        { label: 'Ocultar Outros', role: 'hideOthers' },
        { label: 'Mostrar Tudo', role: 'unhide' },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Colar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Selecionar Tudo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'Visualização',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Forçar Recarga', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Tela Cheia', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Minimizar', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        { type: 'separator' },
        { label: 'Fechar', accelerator: 'CmdOrCtrl+W', role: 'close' },
      ],
    },
  ];

  if (!isProd) {
    template[2].submenu.push({ type: 'separator' });
    template[2].submenu.push({ label: 'DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ──
app.whenReady().then(async () => {
  await startServer();
  buildMenu();
  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ── Set app name ──
app.setName('CLOUDCODE');
