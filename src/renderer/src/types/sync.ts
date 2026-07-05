import type { Collection } from './collection';
import type { TeamVariable } from './teamVariable';

/** Mirrors the Laravel /sync endpoint response, field for field. */
export interface SyncResponse {
  serverTime: number;
  collections: Collection[];
  deletedCollectionIds: string[];
  variables: TeamVariable[];
  deletedVariableIds: string[];
}
