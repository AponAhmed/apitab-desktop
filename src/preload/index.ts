import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type { AppApi, PreparedRequest, RequestResult, StorageApi } from '@shared/types';

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
  } satisfies AppApi,
};

export type Api = typeof api;

// This app always runs with contextIsolation: true (see main/index.ts), so
// contextBridge is the only path — no nodeIntegration fallback branch.
contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('api', api);
