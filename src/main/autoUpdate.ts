import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus, WhatsNewInfo } from '@shared/types';
import { storageGet, storageSet, storageRemove } from './store';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let status: UpdateStatus = { state: 'idle' };

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', status);
}

/**
 * electron-updater's `releaseNotes` is a single HTML string for the latest
 * release, or — when the running app is several versions behind — an array
 * of `{version, note}` (each `note` also HTML) covering every version in
 * between. It's HTML, not markdown: for the GitHub provider it's read from
 * the repo's releases.atom feed, where GitHub itself renders each release
 * body's markdown to HTML (`<content type="html">`) before this ever
 * reaches the app — confirmed by the `class="commit-link"` GitHub adds to
 * the compare-link, which only exists in its rendered output, never in the
 * raw body. Flatten either shape into one HTML string, newest first.
 */
function normalizeReleaseNotes(
  notes: string | Array<{ version: string; note: string | null }> | null | undefined,
): string | undefined {
  if (!notes) return undefined;
  if (typeof notes === 'string') return notes;
  return notes.map((n) => `<h3>v${n.version}</h3>${n.note ?? ''}`).join('');
}

const PENDING_WHATS_NEW_KEY = 'apitab:pendingWhatsNew';

/**
 * Persists what to show as "What's New" the next time the app launches as
 * `info.version` — called wherever the user commits to an update (in-app
 * download, or opening the mac .dmg externally). Resolving this against
 * `app.getVersion()` on the *next* launch (see `resolveWhatsNew` below) is
 * what makes this safe to call even when the update never actually
 * completes (user quits before install, mac download without following
 * through, etc.) — if the version doesn't match, nothing is shown.
 */
async function savePendingWhatsNew(version: string, releaseNotes: string | undefined): Promise<void> {
  const entry: WhatsNewInfo = { version, releaseNotes };
  await storageSet({ [PENDING_WHATS_NEW_KEY]: entry });
}

let resolvedWhatsNew: WhatsNewInfo | null = null;

/** Reads the pending entry saved by `savePendingWhatsNew` and keeps it only if it matches the version now running. */
async function resolveWhatsNew(): Promise<void> {
  const stored = (await storageGet(PENDING_WHATS_NEW_KEY))[PENDING_WHATS_NEW_KEY] as
    | WhatsNewInfo
    | undefined;
  if (stored && stored.version === app.getVersion()) {
    resolvedWhatsNew = stored;
  } else if (stored) {
    // Stale — either the update never completed or was superseded. Clean up
    // rather than leave a dead entry sitting in the store forever.
    await storageRemove(PENDING_WHATS_NEW_KEY);
  }
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
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
  }),
);
autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }));
autoUpdater.on('download-progress', (p) =>
  setStatus({ state: 'downloading', percent: Math.round(p.percent) }),
);
autoUpdater.on('update-downloaded', (info) =>
  setStatus({ state: 'downloaded', version: info.version, releaseNotes: normalizeReleaseNotes(info.releaseNotes) }),
);
autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }));

// electron-updater's Linux updater only works from a real .AppImage launch
// (it needs the APPIMAGE env var the AppImage runtime sets). The tar.gz
// build we also publish has no such runtime, so treat that combination the
// same as an unpacked dev run instead of letting electron-updater log its
// "APPIMAGE env is not defined" warning on every startup.
const isUnsupportedLinuxBuild = process.platform === 'linux' && !process.env.APPIMAGE;

/** Wires the update IPC surface. No-ops (reports `unsupported`) for unpacked dev runs. */
export function registerAutoUpdate(): void {
  // getWhatsNew/dismissWhatsNew are registered unconditionally (both
  // branches) — the renderer checks on every launch regardless of whether
  // this build supports self-update, and a dev/unpacked run simply never
  // has a pending entry to return (download() below is a no-op there, the
  // only place one gets written).
  ipcMain.handle('update:getWhatsNew', () => resolvedWhatsNew);
  ipcMain.handle('update:dismissWhatsNew', async () => {
    resolvedWhatsNew = null;
    await storageRemove(PENDING_WHATS_NEW_KEY);
  });
  void resolveWhatsNew();

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
    if (status.state === 'available') void savePendingWhatsNew(status.version, status.releaseNotes);
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
