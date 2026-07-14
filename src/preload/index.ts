import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type {
  AppApi,
  PreparedRequest,
  RequestResult,
  StorageApi,
  UpdateApi,
  UpdateStatus,
  WindowApi,
} from '@shared/types';

/**
 * Renderer-facing API surface, matching the extension's two touchpoints with
 * privileged code: `sendExecuteRequest()` (src/services/messaging.ts) and
 * `browser.storage.local` (src/stores/persist.ts). Exposed via
 * `contextBridge` since the renderer runs with `contextIsolation: true` and
 * `nodeIntegration: false` — it never gets direct access to `ipcRenderer`,
 * Node, or Electron internals.
 */
const api = {
  request: {
    send: (req: PreparedRequest): Promise<RequestResult> => ipcRenderer.invoke('request:send', req),
  },
  storage: {
    get: (keys?: string | string[] | null) => ipcRenderer.invoke('storage:get', keys),
    set: (items: Record<string, unknown>) => ipcRenderer.invoke('storage:set', items),
    remove: (keys: string | string[]) => ipcRenderer.invoke('storage:remove', keys),
    clear: () => ipcRenderer.invoke('storage:clear'),
  } satisfies StorageApi,
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  } satisfies AppApi,
  update: {
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (status: UpdateStatus) => void) => {
      const listener = (_event: unknown, status: UpdateStatus) => cb(status);
      ipcRenderer.on('update:status', listener);
      return () => {
        ipcRenderer.removeListener('update:status', listener);
      };
    },
  } satisfies UpdateApi,
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (cb: (isMaximized: boolean) => void) => {
      const listener = (_event: unknown, isMaximized: boolean) => cb(isMaximized);
      ipcRenderer.on('window:maximized-change', listener);
      return () => {
        ipcRenderer.removeListener('window:maximized-change', listener);
      };
    },
  } satisfies WindowApi,
};

export type Api = typeof api;

// This app always runs with contextIsolation: true (see main/index.ts), so
// contextBridge is the only path — no nodeIntegration fallback branch.
contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('api', api);
