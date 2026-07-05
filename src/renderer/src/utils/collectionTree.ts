import { uuid } from './id';
import { cloneRequest } from './defaults';
import type { ApiRequest, Collection, CollectionFolder, Container, KeyValue } from '@/types';

export function isCollection(container: Container): container is Collection {
  return 'createdAt' in container;
}

export function newFolder(name: string): CollectionFolder {
  return { id: uuid(), name: name.trim() || 'New Folder', folders: [], requests: [] };
}

/** Coerces possibly-corrupted (e.g. null from legacy/synced data) fields to safe strings. */
function sanitizeRows(rows: KeyValue[] | undefined): KeyValue[] {
  return (rows ?? []).map((r) => ({ ...r, key: r.key ?? '', value: r.value ?? '', enabled: r.enabled ?? true }));
}

function sanitizeApiRequest(req: ApiRequest): ApiRequest {
  return {
    ...req,
    params: sanitizeRows(req.params),
    headers: sanitizeRows(req.headers),
    body: {
      ...req.body,
      formUrlEncoded: sanitizeRows(req.body?.formUrlEncoded),
      formData: sanitizeRows(req.body?.formData),
    },
  };
}

/** Backfills missing `folders`/`requests` and sanitizes corrupted key/value fields on legacy persisted data. */
export function normalizeContainer<T extends Container>(container: T): T {
  return {
    ...container,
    folders: (container.folders ?? []).map(normalizeContainer),
    requests: (container.requests ?? []).map(sanitizeApiRequest),
  };
}

/** Depth-first lookup of a container (collection root or nested folder) by id. */
export function findContainer(collections: Collection[], id: string): Container | null {
  for (const c of collections) {
    const found = findContainerIn(c, id);
    if (found) return found;
  }
  return null;
}
function findContainerIn(container: Container, id: string): Container | null {
  if (container.id === id) return container;
  for (const f of container.folders) {
    const r = findContainerIn(f, id);
    if (r) return r;
  }
  return null;
}

/** Removes a container (collection or folder) by id from anywhere in the tree. */
export function removeContainer(collections: Collection[], id: string): boolean {
  const idx = collections.findIndex((c) => c.id === id);
  if (idx !== -1) {
    collections.splice(idx, 1);
    return true;
  }
  return collections.some((c) => removeFolder(c, id));
}
function removeFolder(container: Container, id: string): boolean {
  const i = container.folders.findIndex((f) => f.id === id);
  if (i !== -1) {
    container.folders.splice(i, 1);
    return true;
  }
  return container.folders.some((f) => removeFolder(f, id));
}

/** The parent container that directly holds `childId` (folder or request). */
export function findParentOfFolder(
  collections: Collection[],
  folderId: string,
): Container | null {
  for (const c of collections) {
    const p = parentOfFolderIn(c, folderId);
    if (p) return p;
  }
  return null;
}
function parentOfFolderIn(container: Container, folderId: string): Container | null {
  if (container.folders.some((f) => f.id === folderId)) return container;
  for (const f of container.folders) {
    const p = parentOfFolderIn(f, folderId);
    if (p) return p;
  }
  return null;
}

export interface RequestLocation {
  container: Container;
  index: number;
}

export function findRequest(collections: Collection[], requestId: string): RequestLocation | null {
  for (const c of collections) {
    const r = findRequestIn(c, requestId);
    if (r) return r;
  }
  return null;
}
function findRequestIn(container: Container, requestId: string): RequestLocation | null {
  const index = container.requests.findIndex((r) => r.id === requestId);
  if (index !== -1) return { container, index };
  for (const f of container.folders) {
    const r = findRequestIn(f, requestId);
    if (r) return r;
  }
  return null;
}

/** The collection that owns a given container/folder id. */
export function findOwnerCollection(collections: Collection[], id: string): Collection | null {
  return collections.find((c) => containsContainer(c, id)) ?? null;
}
function containsContainer(container: Container, id: string): boolean {
  if (container.id === id) return true;
  return container.folders.some((f) => containsContainer(f, id));
}

/** Deep-clones a folder subtree, assigning fresh ids to folders and requests. */
export function cloneFolderWithNewIds(folder: CollectionFolder): CollectionFolder {
  return {
    id: uuid(),
    name: folder.name,
    folders: folder.folders.map(cloneFolderWithNewIds),
    requests: folder.requests.map((r) => cloneRequest(r, { name: r.name })),
  };
}

/** Total request count of a container (recursively). */
export function countRequests(container: Container): number {
  return (
    container.requests.length +
    container.folders.reduce((sum, f) => sum + countRequests(f), 0)
  );
}

export interface FlatContainer {
  id: string;
  name: string;
  depth: number;
  isCollection: boolean;
}

/** Flattens the tree to a depth-labelled list (for target pickers). */
export function flattenContainers(collections: Collection[]): FlatContainer[] {
  const out: FlatContainer[] = [];
  const walk = (container: Container, depth: number) => {
    out.push({ id: container.id, name: container.name, depth, isCollection: isCollection(container) });
    for (const f of container.folders) walk(f, depth + 1);
  };
  for (const c of collections) walk(c, 0);
  return out;
}
