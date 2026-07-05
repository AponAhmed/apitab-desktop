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

export async function storageGet(
  keys?: string | string[] | null,
): Promise<Record<string, unknown>> {
  const s = getStore();

  if (keys == null) {
    return { ...s.store };
  }

  const keyList = Array.isArray(keys) ? keys : [keys];
  const result: Record<string, unknown> = {};
  for (const key of keyList) {
    if (s.has(key)) result[key] = s.get(key);
  }
  return result;
}

export async function storageSet(items: Record<string, unknown>): Promise<void> {
  const s = getStore();
  for (const [key, value] of Object.entries(items)) {
    s.set(key, value);
  }
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const s = getStore();
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) s.delete(key);
}

export async function storageClear(): Promise<void> {
  getStore().clear();
}
