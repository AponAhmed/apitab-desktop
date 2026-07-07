import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from '@shared/types';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let status: UpdateStatus = { state: 'idle' };

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', status);
}

autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }));
autoUpdater.on('update-available', (info) => setStatus({ state: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
autoUpdater.on('download-progress', (p) =>
  setStatus({ state: 'downloading', percent: Math.round(p.percent) }),
);
autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'downloaded', version: info.version }));
autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }));

/** Wires the update IPC surface. No-ops (reports `unsupported`) for unpacked dev runs. */
export function registerAutoUpdate(): void {
  if (!app.isPackaged) {
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
