import type { StressTestRun, StressTestRunStatus, StressTestSummary } from '@/types';

export const STRESS_TEST_STATUS_LABEL: Record<StressTestRunStatus, string> = {
  running: 'Running',
  stopped: 'Stopped',
  completed: 'Completed',
};

export const STRESS_TEST_STATUS_CLASS: Record<StressTestRunStatus, string> = {
  running: 'text-amber-600 dark:text-amber-400',
  stopped: 'text-slate-500 dark:text-slate-400',
  completed: 'text-emerald-600 dark:text-emerald-400',
};

/**
 * Computed on demand (call inside a useMemo keyed on run.results) rather
 * than incrementally maintained in the store — the full results map already
 * has to live in the store for the accordion detail regardless, so a single
 * O(n) pass over plain numbers here is cheap even at several thousand
 * results, and avoids a second derived structure that must stay in lockstep
 * with `results` on every update.
 */
export function computeStressTestSummary(run: StressTestRun): StressTestSummary {
  const results = Object.values(run.results);
  const completed = results.length;

  let successful = 0;
  let failed = 0;
  let minTimeMs: number | null = null;
  let maxTimeMs: number | null = null;
  let totalTimeMs = 0;
  let timedCount = 0;
  const statusCounts: Record<string, number> = {};

  for (const r of results) {
    if (r.success) successful++;
    else failed++;

    if (r.timeMs != null) {
      totalTimeMs += r.timeMs;
      timedCount++;
      if (minTimeMs === null || r.timeMs < minTimeMs) minTimeMs = r.timeMs;
      if (maxTimeMs === null || r.timeMs > maxTimeMs) maxTimeMs = r.timeMs;
    }

    const key = r.status != null ? String(r.status) : 'error';
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  const elapsedSec = ((run.endedAt ?? Date.now()) - run.startedAt) / 1000;

  return {
    total: run.config.count,
    completed,
    successful,
    failed,
    avgTimeMs: timedCount > 0 ? totalTimeMs / timedCount : null,
    minTimeMs,
    maxTimeMs,
    requestsPerSec: elapsedSec > 0 ? completed / elapsedSec : null,
    statusCounts,
  };
}
