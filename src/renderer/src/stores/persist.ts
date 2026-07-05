import type { StateStorage } from 'zustand/middleware';

/**
 * Zustand persistence adapter backed by the main process's electron-store
 * (via the preload bridge), so workspace data (collections, environments,
 * history, draft, UI) survives restarts. Mirrors the browser extension's
 * `browser.storage.local`-backed adapter — only the backing calls changed.
 */
export const browserLocalStorage: StateStorage = {
  getItem: async (name) => {
    const res = await window.api.storage.get(name);
    const value = res[name];
    return typeof value === 'string' ? value : null;
  },
  setItem: async (name, value) => {
    await window.api.storage.set({ [name]: value });
  },
  removeItem: async (name) => {
    await window.api.storage.remove(name);
  },
};
