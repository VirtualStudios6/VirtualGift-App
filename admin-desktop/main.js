const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// ── Cambia esto a tu dominio real de Vercel ──────────────────────────────────
const ADMIN_URL = 'https://virtualgift.pro/admin';
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   820,
    minWidth: 1024,
    minHeight: 640,
    title: 'VirtualGift Admin',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#06011c',
    show: false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      // Permite que Firebase Auth funcione correctamente en contexto Electron
      partition: 'persist:admin',
    },
  });

  mainWindow.loadURL(ADMIN_URL);

  // Mostrar ventana solo cuando haya cargado (evita flash blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos en el navegador del sistema, no en Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'Panel',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'F5',
          click: () => mainWindow?.reload(),
        },
        {
          label: 'Forzar recarga (sin caché)',
          accelerator: 'Ctrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Pantalla completa',
          accelerator: 'F11',
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Herramientas',
      submenu: [
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        {
          label: 'Copiar URL actual',
          click: () => {
            const { clipboard } = require('electron');
            clipboard.writeText(mainWindow?.webContents.getURL() ?? '');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
