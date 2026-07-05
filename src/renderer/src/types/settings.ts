export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  /** Request timeout in milliseconds. */
  requestTimeoutMs: number;
  /** Maximum number of history entries to retain. */
  historyLimit: number;
  /** Display name for the personal (non-team) collections section in the sidebar. */
  personalWorkspaceName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  requestTimeoutMs: 30000,
  historyLimit: 100,
  personalWorkspaceName: 'My Workspace',
};
