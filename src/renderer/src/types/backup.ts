import type { Collection } from './collection';
import type { Environment } from './environment';
import type { HistoryEntry } from './history';
import type { Settings } from './settings';

export const BACKUP_VERSION = 1;

/** Shape of an exported / importable JSON backup file. */
export interface BackupData {
  app: 'apitab';
  version: number;
  exportedAt: number;
  collections: Collection[];
  environments: Environment[];
  history?: HistoryEntry[];
  settings?: Settings;
}
