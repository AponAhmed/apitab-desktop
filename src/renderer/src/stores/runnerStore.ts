import { create } from 'zustand';
import { runCollection, type RunnerRequestResult, type RunnerSummary } from '@/services/collectionRunner';
import type { ApiRequest } from '@/types';

/**
 * Drives the Collection Runner panel. Deliberately NOT persisted (like
 * fileStore.ts) — a run's results are a live, in-session thing, not
 * something that needs to survive a reload.
 */
interface RunnerState {
  open: boolean;
  containerName: string | null;
  pendingRequests: ApiRequest[];
  results: RunnerRequestResult[];
  summary: RunnerSummary | null;
  isRunning: boolean;
  stopRequested: boolean;
  recordHistory: boolean;
  setRecordHistory: (recordHistory: boolean) => void;
  /** Opens the panel for a collection/folder, ready to run once the user confirms the environment. */
  openFor: (containerName: string, requests: ApiRequest[]) => void;
  start: () => void;
  stop: () => void;
  close: () => void;
}

export const useRunnerStore = create<RunnerState>()((set, get) => ({
  open: false,
  containerName: null,
  pendingRequests: [],
  results: [],
  summary: null,
  isRunning: false,
  stopRequested: false,
  recordHistory: true,

  setRecordHistory: (recordHistory) => set({ recordHistory }),

  openFor: (containerName, requests) =>
    set({
      open: true,
      containerName,
      pendingRequests: requests,
      results: [],
      summary: null,
      isRunning: false,
      stopRequested: false,
    }),

  start: () => {
    const { isRunning, pendingRequests, recordHistory } = get();
    if (isRunning || pendingRequests.length === 0) return;
    set({ isRunning: true, stopRequested: false, results: [], summary: null });

    void runCollection(
      pendingRequests,
      (result) => set((s) => ({ results: [...s.results, result] })),
      () => get().stopRequested,
      { recordHistory },
    ).then((summary) => set({ isRunning: false, summary }));
  },

  stop: () => set({ stopRequested: true }),

  close: () => set((s) => ({ open: false, stopRequested: s.isRunning || s.stopRequested })),
}));
