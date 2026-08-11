import { create } from 'zustand';
import { runStressTest, type StressTestRunHandle } from '@/services/stressTestRunner';
import { useEnvironmentStore } from './environmentStore';
import { useSettingsStore } from './settingsStore';
import { uuid } from '@/utils/id';
import type { ApiRequest, StressTestConfig, StressTestRun } from '@/types';

/**
 * Drives the floating stress-test panel. Deliberately NOT persisted (same
 * rationale as runnerStore.ts) — a run's results are a live, in-session
 * thing, not something that needs to survive a reload. Unlike runnerStore's
 * single-slot shape, this supports multiple simultaneous/recent runs, since
 * the floating panel lists all of them at once.
 */
interface StressTestState {
  runs: Record<string, StressTestRun>;
  /** Run ids, newest first — drives the collapsed list's row order. */
  order: string[];
  /** Which run's detail view is open; null = showing the collapsed list. */
  expandedRunId: string | null;
  /** The request the config popup is currently open for; null = popup closed. */
  configTarget: ApiRequest | null;

  openConfig: (request: ApiRequest) => void;
  closeConfig: () => void;
  startRun: (request: ApiRequest, config: StressTestConfig) => string;
  stopRun: (runId: string) => void;
  dismissRun: (runId: string) => void;
  expandRun: (runId: string | null) => void;
}

/**
 * Holds each run's stop() closure, keyed by run id. Kept out of the Zustand
 * state on purpose — function references aren't meaningful store *data* and
 * don't need to flow through set()/subscribers.
 */
const handles = new Map<string, StressTestRunHandle>();

export const useStressTestStore = create<StressTestState>()((set, get) => ({
  runs: {},
  order: [],
  expandedRunId: null,
  configTarget: null,

  openConfig: (request) => set({ configTarget: request }),
  closeConfig: () => set({ configTarget: null }),

  startRun: (request, config) => {
    const id = uuid();
    // Snapshot here — the single enforced chokepoint — so later edits to the
    // live request/environment can never affect an already-running test.
    const requestSnapshot = structuredClone(request);
    const varsSnapshot = { ...useEnvironmentStore.getState().getActiveVariables() };
    const timeoutMs = useSettingsStore.getState().requestTimeoutMs;

    const run: StressTestRun = {
      id,
      requestId: request.id,
      requestName: request.name || request.url || 'Untitled',
      method: request.method,
      requestSnapshot,
      varsSnapshot,
      config,
      status: 'running',
      results: {},
      startedAt: Date.now(),
      endedAt: null,
    };

    set((s) => ({ runs: { ...s.runs, [id]: run }, order: [id, ...s.order] }));

    const handle = runStressTest(requestSnapshot, varsSnapshot, config, timeoutMs, {
      onResult: (result) => {
        // Guard against a raced dismiss — the run may have been removed
        // while this request was still in flight.
        if (!get().runs[id]) return;
        set((s) => ({
          runs: {
            ...s.runs,
            [id]: { ...s.runs[id], results: { ...s.runs[id].results, [result.requestNumber]: result } },
          },
        }));
      },
      onComplete: (finalStatus) => {
        if (!get().runs[id]) return;
        set((s) => {
          const current = s.runs[id];
          return {
            runs: {
              ...s.runs,
              // A user-initiated Stop always wins: the run naturally drains
              // shortly after stopping, but that must never downgrade the
              // status back to 'completed'.
              [id]: { ...current, status: current.status === 'stopped' ? 'stopped' : finalStatus, endedAt: Date.now() },
            },
          };
        });
      },
    });
    handles.set(id, handle);

    return id;
  },

  stopRun: (runId) => {
    set((s) => {
      const run = s.runs[runId];
      if (!run || run.status !== 'running') return s;
      return { runs: { ...s.runs, [runId]: { ...run, status: 'stopped' } } };
    });
    handles.get(runId)?.stop();
  },

  dismissRun: (runId) => {
    // Stop first if still active — otherwise the scheduler keeps firing
    // requests and calling into a store entry that no longer exists.
    handles.get(runId)?.stop();
    handles.delete(runId);
    set((s) => {
      const { [runId]: _removed, ...rest } = s.runs;
      return {
        runs: rest,
        order: s.order.filter((id) => id !== runId),
        expandedRunId: s.expandedRunId === runId ? null : s.expandedRunId,
      };
    });
  },

  expandRun: (runId) => set({ expandedRunId: runId }),
}));
