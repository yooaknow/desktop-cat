const { app, BrowserWindow, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const CAT_SIZE = 120;
const SAFE_MARGIN = 16;
const SAFE_BOTTOM_MARGIN = 96;
const START_BOTTOM_MARGIN = 220;
const INITIAL_OFFSET = 80;
const LOG_PATH = path.join(__dirname, 'debug.log');
const SPRITE_DIR = fs.existsSync(path.join(__dirname, 'optimized-assets'))
  ? path.join(__dirname, 'optimized-assets')
  : path.join(__dirname, 'assets');
const SPRITE_FILES = [
  'basic_posture.png',
  'left_walk_01.png',
  'left_walk_02.png',
  'angry_01.png',
  'angry_02.png',
  'angry_03_run.png',
  'hunt_01_cursor_watch.png',
  'hunt_02__ready.png',
  'hunt_03__butt_wiggle.png',
  'hunt_04__pounce.png',
  'happy_01.png',
  'happy_02.png',
  'dance_01.png',
  'dance_02.png',
  'dance_03.png'
];

let mainWindow = null;
let petConfig = null;
let isClampingWindow = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function log(message, details = '') {
  const line = `[${new Date().toISOString()}] ${message} ${details ? JSON.stringify(details) : ''}\n`;
  fs.appendFileSync(LOG_PATH, line);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSpritePath(fileName) {
  return path.join(SPRITE_DIR, fileName);
}

function getWindowSize() {
  const maxHeight = SPRITE_FILES.reduce((height, fileName) => {
    const image = nativeImage.createFromPath(getSpritePath(fileName));
    const size = image.getSize();
    const scaledHeight = Math.round((CAT_SIZE / size.width) * size.height);

    return Math.max(height, scaledHeight);
  }, CAT_SIZE);

  return { width: CAT_SIZE, height: maxHeight };
}

function getSafeBounds(workArea, size) {
  const minX = workArea.x + SAFE_MARGIN;
  const minY = workArea.y + SAFE_MARGIN;
  const maxX = Math.max(minX, workArea.x + workArea.width - size.width - SAFE_MARGIN);
  const maxY = Math.max(minY, workArea.y + workArea.height - size.height - SAFE_BOTTOM_MARGIN);

  return {
    minX,
    maxX,
    minY,
    maxY
  };
}

function clampWindowPosition(position, safeBounds) {
  return {
    x: clamp(Math.round(position.x), safeBounds.minX, safeBounds.maxX),
    y: clamp(Math.round(position.y), safeBounds.minY, safeBounds.maxY)
  };
}

function clampCurrentWindowToSafeBounds() {
  if (!mainWindow || !petConfig || isClampingWindow) {
    return;
  }

  const [currentX, currentY] = mainWindow.getPosition();
  const safeBounds = getSafeBounds(petConfig.bounds, petConfig.size);
  const nextPosition = clampWindowPosition({ x: currentX, y: currentY }, safeBounds);

  petConfig.safeBounds = safeBounds;
  petConfig.position = nextPosition;

  if (nextPosition.x === currentX && nextPosition.y === currentY) {
    return;
  }

  isClampingWindow = true;
  mainWindow.setPosition(nextPosition.x, nextPosition.y, false);
  isClampingWindow = false;
}

function showWindowSafely(win) {
  if (win.isDestroyed()) {
    return;
  }

  clampCurrentWindowToSafeBounds();
  win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
}

function createWindow() {
  log('createWindow:start');
  const missingSprite = SPRITE_FILES.find((fileName) => !fs.existsSync(getSpritePath(fileName)));

  if (missingSprite) {
    console.error('Missing image at: ' + getSpritePath(missingSprite));
    app.quit();
    return;
  }

  const { width, height } = getWindowSize();
  const { workArea } = screen.getPrimaryDisplay();
  const safeBounds = getSafeBounds(workArea, { width, height });
  const startX = clamp(workArea.x + workArea.width * 0.35, safeBounds.minX, safeBounds.maxX);
  const startY = clamp(workArea.y + workArea.height - height - START_BOTTOM_MARGIN, safeBounds.minY, safeBounds.maxY);
  log('createWindow:bounds', { width, height, workArea, safeBounds, startX, startY });

  const win = new BrowserWindow({
    width,
    height,
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow = win;
  log('createWindow:browser-window-created');
  petConfig = {
    bounds: workArea,
    safeBounds,
    position: { x: startX, y: startY },
    size: { width, height },
    catSize: CAT_SIZE,
    safeMargin: SAFE_MARGIN,
    safeBottomMargin: SAFE_BOTTOM_MARGIN
  };

  win.setMenu(null);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.once('ready-to-show', () => {
    log('window:ready-to-show');
    showWindowSafely(win);
  });
  win.webContents.once('did-finish-load', () => {
    log('webContents:did-finish-load');
    showWindowSafely(win);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log('webContents:render-process-gone', details);
    console.error('Renderer process gone:', details);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log('webContents:did-fail-load', { errorCode, errorDescription });
    console.error('Renderer failed to load:', errorCode, errorDescription);
  });
  setTimeout(() => {
    log('window:show-fallback');
    showWindowSafely(win);
  }, 1000);
  win.on('move', clampCurrentWindowToSafeBounds);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  log('createWindow:loadFile-called');
}

ipcMain.handle('pet:get-config', () => petConfig);
ipcMain.handle('pet:get-cursor-position', () => screen.getCursorScreenPoint());
ipcMain.on('pet:toggle-devtools', () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }
});

ipcMain.on('pet:set-position', (_event, position) => {
  if (!mainWindow || !petConfig) {
    return;
  }

  const { bounds, size } = petConfig;
  const safeBounds = getSafeBounds(bounds, size);
  const nextPosition = clampWindowPosition(position, safeBounds);

  if (petConfig.position && petConfig.position.x === nextPosition.x && petConfig.position.y === nextPosition.y) {
    return;
  }

  mainWindow.setPosition(nextPosition.x, nextPosition.y, false);
  petConfig.position = nextPosition;
  petConfig.safeBounds = safeBounds;
});

app.whenReady().then(() => {
  log('app:ready');
  app.name = 'Desktop Cat';
  screen.on('display-metrics-changed', clampCurrentWindowToSafeBounds);
  screen.on('display-added', clampCurrentWindowToSafeBounds);
  screen.on('display-removed', clampCurrentWindowToSafeBounds);
  createWindow();
});

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  clampCurrentWindowToSafeBounds();
  mainWindow.show();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  log('app:window-all-closed');
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
