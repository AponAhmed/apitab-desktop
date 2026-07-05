import { BACKUP_VERSION, type BackupData } from '@/types';
import type { Collection, Environment, HistoryEntry, Settings } from '@/types';

export interface BackupInput {
  collections: Collection[];
  environments: Environment[];
  history?: HistoryEntry[];
  settings?: Settings;
}

export function buildBackup(input: BackupInput): BackupData {
  return {
    app: 'apitab',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    collections: input.collections,
    environments: input.environments,
    history: input.history,
    settings: input.settings,
  };
}

export interface ParsedBackup {
  ok: boolean;
  data?: BackupData;
  error?: string;
}

export function parseBackup(raw: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const obj = json as Partial<BackupData>;
  if (obj?.app !== 'apitab' || !Array.isArray(obj.collections)) {
    return { ok: false, error: 'Not a valid ApiTab backup file.' };
  }
  return {
    ok: true,
    data: {
      app: 'apitab',
      version: obj.version ?? BACKUP_VERSION,
      exportedAt: obj.exportedAt ?? Date.now(),
      collections: obj.collections ?? [],
      environments: Array.isArray(obj.environments) ? obj.environments : [],
      history: Array.isArray(obj.history) ? obj.history : undefined,
      settings: obj.settings,
    },
  };
}

/** Triggers a download of `data` as a pretty-printed JSON file. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a user-selected file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `apitab-backup-${date}.json`;
}
