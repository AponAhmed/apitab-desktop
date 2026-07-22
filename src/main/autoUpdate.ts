import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from '@shared/types';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let status: UpdateStatus = { state: 'idle' };

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', status);
}

// The release asset naming this repo has used for every dmg so far (see
// electron-builder.yml's top-level `artifactName` and the mac target, which
// builds a single universal x64+arm64 dmg — no per-arch filename needed).
function macDownloadUrl(version: string): string {
  return `https://github.com/AponAhmed/apitab-desktop/releases/download/v${version}/apitab-desktop-${version}.dmg`;
}

autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
autoUpdater.on('update-available', (info) =>
  setStatus({
    state: 'available',
    version: info.version,
    downloadUrl: process.platform === 'darwin' ? macDownloadUrl(info.version) : undefined,
  }),
);
autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
autoUpdater.on('download-progress', (p) =>
  setStatus({ state: 'downloading', percent: Math.round(p.percent) }),
);
autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'downloaded', version: info.version }));
autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }));

// electron-updater's Linux updater only works from a real .AppImage launch
// (it needs the APPIMAGE env var the AppImage runtime sets). The tar.gz
// build we also publish has no such runtime, so treat that combination the
// same as an unpacked dev run instead of letting electron-updater log its
// "APPIMAGE env is not defined" warning on every startup.
const isUnsupportedLinuxBuild = process.platform === 'linux' && !process.env.APPIMAGE;

/** Wires the update IPC surface. No-ops (reports `unsupported`) for unpacked dev runs. */
export function registerAutoUpdate(): void {
  if (!app.isPackaged || isUnsupportedLinuxBuild) {
    ipcMain.handle('update:getStatus', () => ({ state: 'unsupported' }) satisfies UpdateStatus);
    ipcMain.handle('update:check', () => {});
    ipcMain.handle('update:download', () => {});
    ipcMain.handle('update:install', () => {});
    return;
  }

  ipcMain.handle('update:getStatus', () => status);
  ipcMain.handle('update:check', () => {
    autoUpdater.checkForUpdates().catch((err: Error) => setStatus({ state: 'error', message: err.message }));
  });
  ipcMain.handle('update:download', () => {
    if (status.state === 'available' && status.downloadUrl) {
      void shell.openExternal(status.downloadUrl);
      return;
    }
    autoUpdater
      .downloadUpdate()
      .catch((err: Error) => setStatus({ state: 'error', message: err.message }));
  });
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

  // Passive check shortly after launch so a badge can appear without the
  // user having to open Settings/About and click "Check for Updates" first.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => setStatus({ state: 'error', message: err.message }));
  }, 3000);
}
