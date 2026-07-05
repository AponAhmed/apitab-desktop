import type { Collection } from './collection';

/** Mirrors the Laravel /sync endpoint response, field for field. */
export interface SyncResponse {
  serverTime: number;
  collections: Collection[];
  deletedCollectionIds: string[];
}
