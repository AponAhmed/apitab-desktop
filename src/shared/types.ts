/**
 * Wire-format types shared by main, preload and renderer. These mirror the
 * ApiTab browser extension's `WireRequest` / `RequestResult` contract
 * (src/services/messaging.ts, src/types/http.ts, src/types/response.ts) so
 * the extension's `requestService.ts` (which resolves environment variables,
 * merges auth into headers/query, and builds this object) can be copied over
 * with no changes to its output shape — only its transport call swaps from
 * `browser.runtime.sendMessage` to `window.api.request.send`.
 *
 * Note there is no separate "auth type" field: like the extension, auth is
 * already resolved into `headers` (or query params baked into `url`) by the
 * renderer before this object is built. The main process only ever executes
 * a fully-prepared request.
 */

export type BodyType = 'none' | 'json' | 'raw' | 'form-urlencoded' | 'form-data';

export interface PreparedFormField {
  key: string;
  value: string;
}

/** A fully-resolved HTTP request, ready to execute — sent renderer → main. */
export interface PreparedRequest {
  method: string;
  url: string;
  /** Tuple pairs (not a plain object) so duplicate header names survive. */
  headers: [string, string][];
  bodyType: BodyType;
  /** Serialized text body for json / raw / form-urlencoded bodies. */
  body: string | null;
  /** Field list for multipart form-data bodies. */
  formData?: PreparedFormField[];
  timeoutMs: number;
}

export interface ResponseHeader {
  key: string;
  value: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: ResponseHeader[];
  /** Response body decoded as text. */
  body: string;
  contentType: string;
  /** Total round-trip time in milliseconds. */
  timeMs: number;
  /** Body size in bytes. */
  sizeBytes: number;
  redirected: boolean;
  finalUrl: string;
}

export type ApiErrorType = 'network' | 'timeout' | 'invalid-url' | 'unknown';

export interface ApiError {
  type: ApiErrorType;
  message: string;
}

/** Discriminated result returned by the request executor. */
export type RequestResult = { ok: true; response: ApiResponse } | { ok: false; error: ApiError };

/**
 * Shape matching `browser.storage.local`, so the extension's Zustand persist
 * adapter (src/stores/persist.ts) ports over by swapping only the backing
 * calls — `getItem`/`setItem`/`removeItem` stay the same on the renderer side.
 */
export interface StorageApi {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

/** Desktop equivalent of the extension's `browser.runtime.getManifest().version`. */
export interface AppApi {
  getVersion(): Promise<string>;
}

/**
 * Self-update flow backed by `electron-updater` (main/autoUpdate.ts), which
 * checks GitHub Releases directly — no server involved. `unsupported` covers
 * dev/unpacked runs, where electron-updater has no installed app to replace.
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
  | { state: 'unsupported' };

export interface UpdateApi {
  getStatus(): Promise<UpdateStatus>;
  check(): Promise<void>;
  download(): Promise<void>;
  install(): Promise<void>;
  /** Returns an unsubscribe function. */
  onStatus(cb: (status: UpdateStatus) => void): () => void;
}
