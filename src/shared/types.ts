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

export type BodyType = 'none' | 'json' | 'raw' | 'form-urlencoded' | 'form-data' | 'binary';

export interface PreparedFormField {
  key: string;
  value: string;
  fileName?: string;
  fileType?: string;
  /**
   * Base64-encoded file bytes (see utils/binary.ts). Deliberately not a raw
   * `ArrayBuffer` — the extension's equivalent message-passing path was
   * found to silently mangle ArrayBuffer into an empty object despite
   * looking structured-clone-safe, so both clients use the same
   * guaranteed-safe base64 wire format for consistency.
   */
  fileData?: string;
}

export interface PreparedFile {
  fileName: string;
  fileType: string;
  /** Base64-encoded file bytes — see PreparedFormField.fileData. */
  fileData: string;
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
  /** Whole-body file for the 'binary' body type. */
  binary?: PreparedFile;
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
  /** `process.platform` ('win32' | 'darwin' | 'linux' | ...) — renderer has no direct Node access. */
  getPlatform(): Promise<string>;
}

/**
 * Result of the main process's native-app OAuth loopback flow
 * (main/googleOAuth.ts) — an unexchanged authorization code plus the two
 * values needed to exchange it. The renderer forwards this as-is to
 * apitab-server's `/auth/google`, which holds the client_secret and
 * performs the actual code→token exchange with Google.
 */
export interface GoogleOAuthResult {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface OAuthApi {
  /** Opens the system browser for Google sign-in and resolves once the loopback redirect lands. */
  googleLogin(): Promise<GoogleOAuthResult>;
}

/**
 * Self-update flow backed by `electron-updater` (main/autoUpdate.ts), which
 * checks GitHub Releases directly — no server involved. `unsupported` covers
 * dev/unpacked runs, where electron-updater has no installed app to replace.
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  // `downloadUrl` set means: don't attempt an in-app download/install for
  // this update — macOS only. electron-updater's mac path delegates to
  // Electron's native autoUpdater (Apple's Squirrel.Mac framework), which
  // requires the running app to be code-signed to replace itself in place;
  // this app isn't signed, so that always fails. `download()` opens this
  // URL (the .dmg release asset) in the browser for a manual install instead.
  | { state: 'available'; version: string; downloadUrl?: string }
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

/**
 * Custom title-bar controls, needed because the window is created with
 * `frame: false` (main/index.ts) — there is no native minimize/maximize/close
 * chrome to fall back on for any platform.
 */
export interface WindowApi {
  minimize(): Promise<void>;
  /** Toggles between maximized and restored. */
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** Returns an unsubscribe function. */
  onMaximizedChange(cb: (isMaximized: boolean) => void): () => void;
}
