import { create } from 'zustand';

export type PaginationMode = 'pages' | 'loadMore' | 'none';

export interface TableColumnConfig {
  /** Dot-path relative to each row, e.g. "id" or "content_type.name". */
  path: string;
  label: string;
  visible: boolean;
}

export interface TableViewConfig {
  /** Dot-path to the array to tabulate, relative to the response root. Empty = auto-detect. */
  rowPath: string;
  /** Explicit column list, in display order. `null` = auto (union of keys across rows). */
  columns: TableColumnConfig[] | null;
  pageSize: number;
  paginationMode: PaginationMode;
}

export const DEFAULT_TABLE_CONFIG: TableViewConfig = {
  rowPath: '',
  columns: null,
  pageSize: 25,
  paginationMode: 'pages',
};

/** Stable per-request key so config persists across re-sends within a session, without conflating different endpoints. */
export function tableConfigKey(method: string, url: string): string {
  return `${method} ${url}`;
}

interface TableConfigState {
  configs: Record<string, TableViewConfig>;
  getConfig: (key: string) => TableViewConfig;
  setConfig: (key: string, config: TableViewConfig) => void;
  resetConfig: (key: string) => void;
}

/** Not persisted to disk — intentionally session-only, so stale config from a since-changed endpoint never survives a restart. */
export const useTableConfigStore = create<TableConfigState>((set, get) => ({
  configs: {},
  getConfig: (key) => get().configs[key] ?? DEFAULT_TABLE_CONFIG,
  setConfig: (key, config) => set((s) => ({ configs: { ...s.configs, [key]: config } })),
  resetConfig: (key) =>
    set((s) => {
      const next = { ...s.configs };
      delete next[key];
      return { configs: next };
    }),
}));
