import { isCollection, normalizeContainer } from './collectionTree';
import type { Collection, CollectionFolder, Container } from '@/types';

export const COLLECTION_EXPORT_VERSION = 1;

export interface SharedVariable {
  key: string;
  value: string;
}

/** Serialized single collection or folder (folder-level export/import). */
export interface CollectionExport {
  app: 'apitab';
  type: 'collection' | 'folder';
  version: number;
  exportedAt: number;
  item: Container;
  /**
   * Environment variables the user explicitly opted into sharing (with
   * values). Omitted/empty when nothing was marked shareable — an export
   * never carries environment data unless the user asked for it.
   */
  environmentVariables?: SharedVariable[];
}

export function exportContainer(
  container: Container,
  environmentVariables?: SharedVariable[],
): CollectionExport {
  return {
    app: 'apitab',
    type: isCollection(container) ? 'collection' : 'folder',
    version: COLLECTION_EXPORT_VERSION,
    exportedAt: Date.now(),
    item: container,
    ...(environmentVariables?.length ? { environmentVariables } : {}),
  };
}

export interface ParsedExport {
  ok: boolean;
  data?: CollectionExport;
  error?: string;
}

export function parseCollectionExport(raw: string): ParsedExport {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const obj = json as Partial<CollectionExport>;
  if (obj?.app !== 'apitab' || !obj.item || typeof obj.item !== 'object') {
    return { ok: false, error: 'Not a valid ApiTab collection/folder file.' };
  }
  const rawVars = Array.isArray(obj.environmentVariables) ? obj.environmentVariables : [];
  const environmentVariables = rawVars.filter(
    (v): v is SharedVariable =>
      v != null && typeof v.key === 'string' && v.key.trim() !== '' && typeof v.value === 'string',
  );

  return {
    ok: true,
    data: {
      app: 'apitab',
      type: obj.type === 'folder' ? 'folder' : 'collection',
      version: obj.version ?? COLLECTION_EXPORT_VERSION,
      exportedAt: obj.exportedAt ?? Date.now(),
      item: normalizeContainer(obj.item as Container),
      ...(environmentVariables.length ? { environmentVariables } : {}),
    },
  };
}

/** Converts any exported item into a folder subtree (for "import into"). */
export function exportToFolder(data: CollectionExport): CollectionFolder {
  const item = data.item;
  return {
    id: item.id,
    name: item.name,
    folders: item.folders,
    requests: item.requests,
  };
}

/** Converts any exported item into a collection root (for "import as collection"). */
export function exportToCollection(data: CollectionExport): Collection {
  const item = data.item;
  const now = Date.now();
  return {
    id: item.id,
    name: item.name,
    folders: item.folders,
    requests: item.requests,
    createdAt: (item as Collection).createdAt ?? now,
    updatedAt: now,
  };
}

export function sanitizeFilename(name: string): string {
  return (name.trim() || 'export').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
}
