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
    icon: path.join(__dirname, 'assets', 'icon.ico'),
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

  // ── Post-login: si la web redirige a welcome/inicio, volver al panel admin ──
  mainWindow.webContents.on('did-navigate', (_e, url) => {
    const u = new URL(url);
    const page = u.pathname.replace(/^\//, '').replace(/\.html$/, '');
    if (page === 'welcome' || page === 'inicio' || page === 'home') {
      mainWindow.loadURL(ADMIN_URL);
    }
  });

  // ── Inyectar banner "ADMIN PANEL" en la pantalla de login ──────────────────
  const BANNER_JS = `
    (function() {
      if (document.getElementById('__admin-badge')) return;
      var b = document.createElement('div');
      b.id = '__admin-badge';
      b.style.cssText = [
        'position:fixed', 'top:14px', 'left:50%',
        'transform:translateX(-50%)',
        'z-index:999999',
        'background:linear-gradient(135deg,#8d17fb,#d020e8)',
        'color:#fff',
        'font:800 11px/1 Inter,sans-serif',
        'letter-spacing:1.5px',
        'text-transform:uppercase',
        'padding:6px 16px',
        'border-radius:999px',
        'box-shadow:0 0 18px rgba(141,23,251,0.55)',
        'pointer-events:none',
        'white-space:nowrap',
      ].join(';');
      b.textContent = '\\uD83D\\uDD10  Acceso Administrador';
      document.body.appendChild(b);
    })();
  `;

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    if (url.includes('/login') || url.includes('/index')) {
      mainWindow.webContents.executeJavaScript(BANNER_JS).catch(() => {});
    }
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
