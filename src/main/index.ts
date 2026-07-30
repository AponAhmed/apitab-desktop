import { join } from 'path';
import dns from 'node:dns';
import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { executeRequest } from './requestHandler';
import { flushPendingWrites, storageClear, storageGet, storageRemove, storageSet } from './store';
import { registerAutoUpdate } from './autoUpdate';
import { runGoogleOAuthLoopback } from './googleOAuth';
import type { PreparedRequest } from '@shared/types';
import icon from '../../resources/icon.png?asset';

// Node resolves "localhost" to its /etc/hosts order, which on macOS is
// typically IPv6 (::1) first. If the target only listens on IPv4 — e.g. a
// Docker Desktop port-forward, which on Mac's networking stack doesn't
// always bind the IPv6 loopback the way it does on Windows/WSL2 — undici's
// fetch fails outright instead of falling back, even though curl/Chromium
// (which both do proper IPv4/IPv6 happy-eyeballs) reach the same URL fine.
// This makes every request in this process prefer IPv4 first, matching what
// browsers already do.
dns.setDefaultResultOrder('ipv4first');

// Works around a known Electron/Windows bug where opening a native <select>
// dropdown (e.g. Auth Type) can leave the GPU compositor rendering the
// window black on certain GPU driver setups, surviving relaunch since it's
// a driver/compositor state issue rather than app state.
app.disableHardwareAcceleration();

// On some Windows machines (older/buggy GPU drivers, restrictive sandboxing,
// certain hybrid-graphics laptops) Chromium's separate GPU process fails to
// initialize and the app never gets past a blank window — the only reliable
// fix users have found is launching with `--in-process-gpu` by hand, which
// folds GPU work into the main process instead of spawning it separately.
// Baking the same switch in here means it doesn't have to be typed manually
// every launch. disableHardwareAcceleration() above isn't enough on its own:
// it stops GPU compositing, but a separate GPU process can still be spawned
// (and still crash on init) for other GPU-related work.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('in-process-gpu');
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // TopBar.tsx is the drag region and (on Windows/Linux) owns
    // minimize/maximize/close via the custom WindowControls component. On
    // macOS we instead keep the OS's own traffic-light buttons — hiding the
    // rest of the native title bar with `titleBarStyle: 'hidden'` rather
    // than going fully frameless, since a hand-drawn approximation never
    // quite matches real macOS hover/click/spacing behavior the way the
    // genuine buttons do. WindowControls.tsx checks the platform and
    // renders nothing on macOS to avoid a second, redundant set of controls.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 12, y: 15 } }
      : { frame: false }),
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();

    // Chromium doesn't always register -webkit-app-region:drag hit-test
    // regions (TopBar.tsx) on the very first compositor frame — especially
    // with hardware acceleration disabled above — so dragging the frameless
    // title bar silently no-ops until some later, unrelated layout pass
    // happens to recompute it (in practice: a couple of seconds after
    // launch). Nudging the window size by 1px and back forces an immediate
    // recompute instead of waiting on that.
    setTimeout(() => {
      if (mainWindow.isDestroyed()) return;
      const [w, h] = mainWindow.getSize();
      mainWindow.setSize(w + 1, h);
      mainWindow.setSize(w, h);
    }, 100);
  });

  // Lets WindowControls.tsx keep its maximize/restore icon in sync with
  // state changes that don't originate from its own button (double-clicking
  // the drag region, Windows' Aero Snap, etc).
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-change', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-change', false));

  // Open links clicked inside the app in the OS browser, not a new Electron
  // window (target="_blank" links, e.g. AboutDialog's) or the same window
  // (a plain <a href> with no target — e.g. the "Full Changelog" link in
  // What's New release notes, rendered from GitHub's own HTML — which
  // otherwise navigates this window itself to github.com instead of
  // opening a browser, replacing the whole app UI with GitHub's page).
  // will-navigate only fires for a navigation the page itself initiates
  // (a link click, `location.href = ...`), never for this window's own
  // programmatic loadURL/loadFile below — this SPA has no legitimate
  // reason to navigate itself away at all, so unconditionally redirecting
  // every one externally is correct, not just a same-origin carve-out.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    void shell.openExternal(url);
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

  // Opens the system browser for Google sign-in and resolves once the
  // native-app loopback redirect lands (see googleOAuth.ts).
  ipcMain.handle('oauth:google', () => runGoogleOAuthLoopback());

  // Storage, shaped like `browser.storage.local` (see store.ts) so the
  // extension's Zustand persist adapter ports over with minimal changes.
  ipcMain.handle('storage:get', (_event, keys?: string | string[] | null) => storageGet(keys));
  ipcMain.handle('storage:set', (_event, items: Record<string, unknown>) => storageSet(items));
  ipcMain.handle('storage:remove', (_event, keys: string | string[]) => storageRemove(keys));
  ipcMain.handle('storage:clear', () => storageClear());

  // Desktop equivalent of the extension's `browser.runtime.getManifest().version`.
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);

  // Custom title-bar controls (the window is `frame: false` — see createWindow).
  // `BrowserWindow.fromWebContents` rather than a captured `mainWindow`
  // reference, since this app can recreate its window on macOS `activate`.
  ipcMain.handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle(
    'window:isMaximized',
    (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  );

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

// Storage writes are debounced (see store.ts) — flush any pending write
// synchronously before the process actually exits, or it would be lost.
app.on('before-quit', () => {
  flushPendingWrites();
});
