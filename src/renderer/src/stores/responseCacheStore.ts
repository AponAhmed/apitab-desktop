import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { ApiError, ApiRequest, ApiResponse, SavedRequestRef, ScriptRunResult } from '@/types';

/** Snapshot of a request's last outcome, cached so switching between saved
 * requests shows each one's own last response instead of a blank panel. */
export interface CachedResponse {
  response: ApiResponse | null;
  error: ApiError | null;
  scriptRun: ScriptRunResult | null;
  sentAt: number | null;
}

/**
 * The stable identity to cache a response under: the saved-request id when
 * this request has been saved (so reopening it from a collection finds its
 * last response), otherwise the draft's own (transient) id.
 */
export function responseCacheKey(request: ApiRequest, savedRef: SavedRequestRef | null): string {
  return savedRef?.requestId ?? request.id;
}

// Capped by entry count, evicting the stalest (lowest sentAt) entries once
// over the limit — this used to live inside requestStore's own persisted
// state with no cap at all, which meant (a) it grew forever, one entry per
// request ever sent in the app's lifetime, each holding a full untruncated
// response body, and (b) because it rode along in the same partialize'd
// blob, Zustand's persist middleware re-serialized the *entire accumulated
// cache* on every single keystroke anywhere in the request editor (persist
// writes on every `set()`, not just ones that touch the cache) — the actual
// cause of typing feeling progressively laggier the longer a session ran.
// Splitting it into its own store means a keystroke in requestStore only
// ever re-serializes the small, cheap `request`/`savedRef`/tab state; this
// store only re-serializes when a response actually changes (`send()` /
// `saveToCollection()`), and the cap keeps even that bounded.
const MAX_ENTRIES = 30;

interface ResponseCacheState {
  responseCache: Record<string, CachedResponse>;
  setCached: (key: string, entry: CachedResponse) => void;
  /** Copies one entry to a new key without removing the old one — used when a draft is saved to a collection and gets a new stable id. */
  copyCached: (fromKey: string, toKey: string) => void;
}

export const useResponseCacheStore = create<ResponseCacheState>()(
  persist(
    (set) => ({
      responseCache: {},

      setCached: (key, entry) =>
        set((s) => {
          const next = { ...s.responseCache, [key]: entry };
          const keys = Object.keys(next);
          if (keys.length > MAX_ENTRIES) {
            const stalestFirst = keys.sort((a, b) => (next[a].sentAt ?? 0) - (next[b].sentAt ?? 0));
            for (const k of stalestFirst.slice(0, keys.length - MAX_ENTRIES)) delete next[k];
          }
          return { responseCache: next };
        }),

      copyCached: (fromKey, toKey) =>
        set((s) => {
          const cached = s.responseCache[fromKey];
          return cached ? { responseCache: { ...s.responseCache, [toKey]: cached } } : s;
        }),
    }),
    {
      name: 'apitab:response-cache',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ responseCache }) => ({ responseCache }),
    },
  ),
);
