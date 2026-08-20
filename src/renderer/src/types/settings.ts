export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  /** Request timeout in milliseconds. */
  requestTimeoutMs: number;
  /** Maximum number of history entries to retain. */
  historyLimit: number;
  /** Display name for the personal (non-team) collections section in the sidebar. */
  personalWorkspaceName: string;
  /**
   * Base hex color (e.g. "#f59e0b") the accent/brand palette is generated
   * from. `null` means "use the app's default amber brand color."
   */
  accentColor: string | null;
  /**
   * Skips TLS certificate verification for every request. Off by default —
   * this exists for local development against self-signed certs (e.g. a
   * Docker Compose HTTPS service), not for real/production APIs, since it
   * removes protection against a genuinely invalid or spoofed certificate.
   */
  ignoreTlsErrors: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  requestTimeoutMs: 30000,
  historyLimit: 100,
  personalWorkspaceName: 'My Workspace',
  accentColor: null,
  ignoreTlsErrors: false,
};
