import type { ApiRequest } from './request';

/** A nestable folder: holds sub-folders and requests. */
export interface CollectionFolder {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: ApiRequest[];
}

/**
 * A named tree of folders and requests. The collection itself acts as the root
 * container (its `id` addresses the root level).
 */
export interface Collection {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: ApiRequest[];
  createdAt: number;
  updatedAt: number;
  /** Set when this collection is shared with a team; absent = local-only. */
  teamId?: string;
}

/** Anything that holds folders + requests — a collection root or a folder. */
export type Container = Collection | CollectionFolder;
