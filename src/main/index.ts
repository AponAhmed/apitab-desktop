import { join } from 'path';
import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { executeRequest } from './requestHandler';
import { storageClear, storageGet, storageRemove, storageSet } from './store';
import { registerAutoUpdate } from './autoUpdate';
import type { PreparedRequest } from '@shared/types';
import icon from '../../resources/icon.png?asset';

// Works around a known Electron/Windows bug where opening a native <select>
// dropdown (e.g. Auth Type) can leave the GPU compositor rendering the
// window black on certain GPU driver setups, surviving relaunch since it's
// a driver/compositor state issue rather than app state.
app.disableHardwareAcceleration();

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Sets the taskbar/title-bar icon during `npm run dev` and on Linux
    // (which doesn't embed an icon into the executable the way
    // electron-builder does for Windows/.ico and macOS/.icns).
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());

  // Open links clicked inside the app in the OS browser, not a new Electron window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    // This is where the built renderer (ported ApiTab UI) is served from.
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.apitab.desktop');

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // --- IPC surface exposed to the renderer via the preload bridge ---
  // Executes a fully-prepared HTTP request (see requestHandler.ts). This is
  // the desktop equivalent of the extension's `EXECUTE_REQUEST` runtime
  // message handled in its background service worker.
  ipcMain.handle('request:send', (_event, req: PreparedRequest) => executeRequest(req));

  // Storage, shaped like `browser.storage.local` (see store.ts) so the
  // extension's Zustand persist adapter ports over with minimal changes.
  ipcMain.handle('storage:get', (_event, keys?: string | string[] | null) => storageGet(keys));
  ipcMain.handle('storage:set', (_event, items: Record<string, unknown>) => storageSet(items));
  ipcMain.handle('storage:remove', (_event, keys: string | string[]) => storageRemove(keys));
  ipcMain.handle('storage:clear', () => storageClear());

  // Desktop equivalent of the extension's `browser.runtime.getManifest().version`.
  ipcMain.handle('app:getVersion', () => app.getVersion());

  registerAutoUpdate();

  createWindow();

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked with no windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
