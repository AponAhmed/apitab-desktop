import Store from 'electron-store';

/**
 * Wraps `electron-store` (synchronous, file-backed) behind an async
 * interface shaped exactly like `browser.storage.local`
 * (get/set/remove/clear), so the extension's Zustand persist adapter
 * (src/stores/persist.ts) can be ported by swapping only its backing calls —
 * `getItem`/`setItem`/`removeItem` keep the same signatures on the
 * renderer/store side.
 *
 * Lazily constructed: `electron-store` resolves its file path via Electron's
 * `app.getPath('userData')`, which isn't reliably available until the app
 * is ready, and this module may be imported before that.
 */
let store: Store | null = null;

function getStore(): Store {
  if (!store) store = new Store({ name: 'apitab-workspace' });
  return store;
}

/**
 * `electron-store` (via the `conf` package it's built on) does a synchronous
 * full-file `readFileSync` + JSON.parse on *every* `.get()`/`.has()`/`.set()`
 * call — it caches nothing itself. With ~9 persisted Zustand stores all
 * sharing this one file, that meant 18 full reads of a multi-MB file at
 * startup (one `.has()` + `.get()` per store) serialized on Electron's
 * single-threaded main process — the actual cause of the multi-second
 * startup freeze, since that same thread also handles compositing on
 * Windows (see `in-process-gpu` in main/index.ts). It also meant every
 * single keystroke that touched a persisted store (e.g. editing the active
 * request) triggered a full read-modify-write of the entire file.
 *
 * This in-memory cache is populated by reading the file exactly once, on
 * first access; every subsequent get/set/remove operates on this object
 * directly (no disk I/O), and writes are debounced (see `scheduleFlush`)
 * so a burst of edits produces one disk write instead of one per edit.
 */
let cache: Record<string, unknown> | null = null;

function getCache(): Record<string, unknown> {
  if (!cache) cache = { ...getStore().store };
  return cache;
}

const WRITE_DEBOUNCE_MS = 300;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushPendingWrites, WRITE_DEBOUNCE_MS);
}

/**
 * Synchronously writes the in-memory cache to disk if a write is pending,
 * and cancels the pending timer. Exported so `main/index.ts` can call this
 * on `before-quit` — otherwise a debounced write in flight when the app
 * closes would never reach disk.
 */
export function flushPendingWrites(): void {
  if (!writeTimer) return;
  clearTimeout(writeTimer);
  writeTimer = null;
  if (cache !== null) getStore().store = { ...cache };
}

export async function storageGet(
  keys?: string | string[] | null,
): Promise<Record<string, unknown>> {
  const c = getCache();

  if (keys == null) {
    return { ...c };
  }

  const keyList = Array.isArray(keys) ? keys : [keys];
  const result: Record<string, unknown> = {};
  for (const key of keyList) {
    if (key in c) result[key] = c[key];
  }
  return result;
}

export async function storageSet(items: Record<string, unknown>): Promise<void> {
  Object.assign(getCache(), items);
  scheduleFlush();
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const c = getCache();
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) delete c[key];
  scheduleFlush();
}

export async function storageClear(): Promise<void> {
  cache = {};
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  getStore().clear();
}
