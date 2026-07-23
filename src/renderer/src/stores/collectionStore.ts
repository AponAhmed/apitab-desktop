import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cloneRequest } from '@/utils/defaults';
import { uuid } from '@/utils/id';
import {
  cloneFolderWithNewIds,
  containsContainer,
  extractFolder,
  extractRequest,
  findContainer,
  findOwnerCollection,
  findParentOfFolder,
  findRequest,
  newFolder,
  normalizeContainer,
  removeContainer,
} from '@/utils/collectionTree';
import {
  exportToCollection,
  exportToFolder,
  type CollectionExport,
} from '@/utils/collectionIO';
import { browserLocalStorage } from './persist';
import type { ApiRequest, Collection } from '@/types';

interface CollectionState {
  collections: Collection[];
  createCollection: (name: string) => Collection;
  createFolder: (parentContainerId: string, name: string) => void;
  renameContainer: (containerId: string, name: string) => void;
  deleteContainer: (containerId: string) => void;
  duplicateContainer: (containerId: string) => void;
  /** Saves a copy of `request` into a container; returns the stored copy. */
  addRequest: (containerId: string, request: ApiRequest, name?: string) => ApiRequest | null;
  updateRequest: (request: ApiRequest) => void;
  duplicateRequest: (requestId: string) => void;
  deleteRequest: (requestId: string) => void;
  /**
   * Moves a folder to be a child of `targetContainerId`, positioned relative
   * to `referenceId` (another folder already in that container) — before or
   * after it. Omitting `referenceId` appends at the end. No-ops if that
   * would nest the folder inside itself or one of its own descendants.
   */
  moveFolder: (
    folderId: string,
    targetContainerId: string,
    referenceId?: string,
    position?: 'before' | 'after',
  ) => void;
  /** Same as `moveFolder`, but for a request — `referenceId` is another request already in the target container. */
  moveRequest: (
    requestId: string,
    targetContainerId: string,
    referenceId?: string,
    position?: 'before' | 'after',
  ) => void;
  /** Reorders top-level collections relative to `referenceId` (before/after). */
  reorderCollections: (collectionId: string, referenceId: string, position: 'before' | 'after') => void;
  importAsCollection: (data: CollectionExport) => Collection;
  importIntoContainer: (containerId: string, data: CollectionExport) => void;
  replaceAll: (collections: Collection[]) => void;
  mergeImported: (collections: Collection[]) => void;
  /** Tags a local (untagged) collection as shared with a team. */
  setCollectionTeam: (collectionId: string, teamId: string) => void;
  /**
   * Upserts collections pulled from a team's /sync response and removes any
   * team-tagged collection whose id is in `deletedIds`. Distinct from
   * mergeImported: this understands remote deletions, which plain
   * upsert-by-id cannot represent.
   */
  mergeSync: (teamId: string, incoming: Collection[], deletedIds: string[]) => void;
  /**
   * Drops every team-tagged collection (they'll re-arrive via /sync on next
   * login) while preserving local, untagged ones. Call on logout — without
   * this, a different account logging in on the same device would still see
   * the previous account's team collections until the next sync overwrites
   * them, and could briefly act on stale/foreign data in the meantime.
   */
  clearTeamCollections: () => void;
  /** Drops local collections tagged to one specific team (e.g. after that team/workspace is deleted). */
  removeCollectionsForTeam: (teamId: string) => void;
}

function bump(collections: Collection[], id: string) {
  const owner = findOwnerCollection(collections, id);
  if (owner) owner.updatedAt = Date.now();
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      collections: [],

      createCollection: (name) => {
        const now = Date.now();
        const collection: Collection = {
          id: uuid(),
          name: name.trim() || 'New Collection',
          folders: [],
          requests: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ collections: [...s.collections, collection] }));
        return collection;
      },

      createFolder: (parentContainerId, name) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const parent = findContainer(next, parentContainerId);
          if (!parent) return s;
          parent.folders.push(newFolder(name));
          bump(next, parentContainerId);
          return { collections: next };
        }),

      renameContainer: (containerId, name) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const c = findContainer(next, containerId);
          if (!c) return s;
          c.name = name.trim() || c.name;
          bump(next, containerId);
          return { collections: next };
        }),

      deleteContainer: (containerId) =>
        set((s) => {
          const next = structuredClone(s.collections);
          return removeContainer(next, containerId) ? { collections: next } : s;
        }),

      duplicateContainer: (containerId) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const ci = next.findIndex((c) => c.id === containerId);
          if (ci !== -1) {
            const orig = next[ci];
            const now = Date.now();
            const copy: Collection = {
              id: uuid(),
              name: `${orig.name} Copy`,
              folders: orig.folders.map(cloneFolderWithNewIds),
              requests: orig.requests.map((r) => cloneRequest(r, { name: r.name })),
              createdAt: now,
              updatedAt: now,
            };
            next.splice(ci + 1, 0, copy);
            return { collections: next };
          }
          const parent = findParentOfFolder(next, containerId);
          if (!parent) return s;
          const fi = parent.folders.findIndex((f) => f.id === containerId);
          const copy = cloneFolderWithNewIds(parent.folders[fi]);
          copy.name = `${parent.folders[fi].name} Copy`;
          parent.folders.splice(fi + 1, 0, copy);
          bump(next, parent.id);
          return { collections: next };
        }),

      addRequest: (containerId, request, name) => {
        if (!findContainer(get().collections, containerId)) return null;
        const saved = cloneRequest(request, {
          name: (name ?? request.name).trim() || 'Untitled Request',
        });
        set((s) => {
          const next = structuredClone(s.collections);
          const c = findContainer(next, containerId);
          if (!c) return s;
          c.requests.push(structuredClone(saved));
          bump(next, containerId);
          return { collections: next };
        });
        return saved;
      },

      moveFolder: (folderId, targetContainerId, referenceId, position) =>
        set((s) => {
          if (folderId === targetContainerId) return s;
          const next = structuredClone(s.collections);
          const folder = extractFolder(next, folderId);
          if (!folder) return s;
          // Would nest the folder inside itself or one of its own
          // descendants — bail without committing (folder was only ever
          // extracted from `next`, a clone, so the real state is untouched).
          if (containsContainer(folder, targetContainerId)) return s;
          const target = findContainer(next, targetContainerId);
          if (!target) return s;
          let index = target.folders.length;
          if (referenceId) {
            const refIndex = target.folders.findIndex((f) => f.id === referenceId);
            if (refIndex !== -1) index = position === 'after' ? refIndex + 1 : refIndex;
          }
          target.folders.splice(index, 0, folder);
          bump(next, targetContainerId);
          return { collections: next };
        }),

      moveRequest: (requestId, targetContainerId, referenceId, position) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const request = extractRequest(next, requestId);
          if (!request) return s;
          const target = findContainer(next, targetContainerId);
          if (!target) return s;
          let index = target.requests.length;
          if (referenceId) {
            const refIndex = target.requests.findIndex((r) => r.id === referenceId);
            if (refIndex !== -1) index = position === 'after' ? refIndex + 1 : refIndex;
          }
          target.requests.splice(index, 0, request);
          bump(next, targetContainerId);
          return { collections: next };
        }),

      reorderCollections: (collectionId, referenceId, position) =>
        set((s) => {
          if (collectionId === referenceId) return s;
          const next = [...s.collections];
          const fromIndex = next.findIndex((c) => c.id === collectionId);
          if (fromIndex === -1) return s;
          const [item] = next.splice(fromIndex, 1);
          let index = next.findIndex((c) => c.id === referenceId);
          index = index === -1 ? next.length : position === 'after' ? index + 1 : index;
          next.splice(index, 0, item);
          return { collections: next };
        }),

      updateRequest: (request) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const loc = findRequest(next, request.id);
          if (!loc) return s;
          loc.container.requests[loc.index] = { ...request, updatedAt: Date.now() };
          bump(next, loc.container.id);
          return { collections: next };
        }),

      duplicateRequest: (requestId) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const loc = findRequest(next, requestId);
          if (!loc) return s;
          const copy = cloneRequest(loc.container.requests[loc.index], {
            name: `${loc.container.requests[loc.index].name} Copy`,
          });
          loc.container.requests.splice(loc.index + 1, 0, copy);
          bump(next, loc.container.id);
          return { collections: next };
        }),

      deleteRequest: (requestId) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const loc = findRequest(next, requestId);
          if (!loc) return s;
          loc.container.requests.splice(loc.index, 1);
          bump(next, loc.container.id);
          return { collections: next };
        }),

      importAsCollection: (data) => {
        const base = exportToCollection(data);
        const now = Date.now();
        const collection: Collection = {
          id: uuid(),
          name: base.name,
          folders: base.folders.map(cloneFolderWithNewIds),
          requests: base.requests.map((r) => cloneRequest(r, { name: r.name })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ collections: [...s.collections, collection] }));
        return collection;
      },

      importIntoContainer: (containerId, data) =>
        set((s) => {
          const next = structuredClone(s.collections);
          const target = findContainer(next, containerId);
          if (!target) return s;
          target.folders.push(cloneFolderWithNewIds(exportToFolder(data)));
          bump(next, containerId);
          return { collections: next };
        }),

      replaceAll: (collections) => set({ collections: collections.map(normalizeContainer) }),

      mergeImported: (incoming) =>
        set((s) => {
          const byId = new Map(s.collections.map((c) => [c.id, c]));
          for (const c of incoming) byId.set(c.id, normalizeContainer(c));
          return { collections: [...byId.values()] };
        }),

      setCollectionTeam: (collectionId, teamId) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId ? { ...c, teamId, updatedAt: Date.now() } : c,
          ),
        })),

      mergeSync: (teamId, incoming, deletedIds) =>
        set((s) => {
          const byId = new Map(s.collections.map((c) => [c.id, c]));
          for (const c of incoming) byId.set(c.id, normalizeContainer({ ...c, teamId }));
          for (const id of deletedIds) {
            const existing = byId.get(id);
            if (existing && existing.teamId === teamId) byId.delete(id);
          }
          return { collections: [...byId.values()] };
        }),

      clearTeamCollections: () =>
        set((s) => ({ collections: s.collections.filter((c) => !c.teamId) })),

      removeCollectionsForTeam: (teamId) =>
        set((s) => ({ collections: s.collections.filter((c) => c.teamId !== teamId) })),
    }),
    {
      name: 'apitab:collections',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ collections }) => ({ collections }),
      // Backfill folders/requests on data saved before nesting existed.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { collections?: Collection[] };
        return { ...current, collections: (p.collections ?? []).map(normalizeContainer) };
      },
    },
  ),
);
