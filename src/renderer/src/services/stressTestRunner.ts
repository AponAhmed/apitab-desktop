import { executeRequest } from './requestService';
import type { ApiRequest, StressTestConfig, StressTestRequestResult } from '@/types';
import type { VariableMap } from '@/utils/variables';

/**
 * Hard cap on simultaneous in-flight requests, independent of how small
 * `intervalMs` is configured (the issue allows down to 1ms with no stated
 * limit). Protects the target server and this app's own IPC channel/
 * renderer from a config like "1000 requests at 1ms" firing near-instantly.
 * Fixed internal constant, not user-facing — can be tuned later without
 * touching call sites.
 */
export const MAX_CONCURRENT_REQUESTS = 25;

/** Retry delay used when deferring a fire because the concurrency cap is hit. */
const CAP_POLL_MS = 10;

export interface StressTestRunHandle {
  /** Stops scheduling new requests. Already-fired requests are left to finish/timeout naturally. */
  stop: () => void;
}

export interface StressTestCallbacks {
  onResult: (result: StressTestRequestResult) => void;
  onComplete: (finalStatus: 'stopped' | 'completed') => void;
}

/**
 * Fires `config.count` requests against `requestSnapshot` at `config.intervalMs`
 * apart, without awaiting each one — this is what makes them genuinely
 * overlap/run concurrently, unlike collectionRunner.ts's sequential loop.
 * No pre/post-request scripts run here (product decision: avoids concurrent
 * requests racing to mutate the shared live environment-variable store) —
 * `executeRequest` is called directly rather than going through the
 * script-running wrapper collectionRunner.ts uses.
 *
 * Uses a recursive setTimeout rather than setInterval: each tick has to
 * decide fire-vs-defer-at-cap-vs-stop before scheduling the next tick, which
 * setInterval's fixed wall-clock cadence can't express cleanly (a deferred
 * tick would either drift or double-fire), and a single mutable timer handle
 * makes stop() a trivial clearTimeout.
 */
export function runStressTest(
  requestSnapshot: ApiRequest,
  varsSnapshot: VariableMap,
  config: StressTestConfig,
  timeoutMs: number,
  { onResult, onComplete }: StressTestCallbacks,
): StressTestRunHandle {
  let requestNumber = 0;
  let inFlight = 0;
  let stopped = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function maybeSettle() {
    if (settled) return;
    const allFiredAndDrained = requestNumber >= config.count && inFlight === 0;
    const stoppedAndDrained = stopped && inFlight === 0;
    if (allFiredAndDrained || stoppedAndDrained) {
      settled = true;
      onComplete(stopped ? 'stopped' : 'completed');
    }
  }

  async function fireOne(n: number) {
    const startedAt = Date.now();
    try {
      const { result } = await executeRequest(requestSnapshot, varsSnapshot, timeoutMs);
      if (result.ok) {
        onResult({
          requestNumber: n,
          startedAt,
          status: result.response.status,
          timeMs: result.response.timeMs,
          success: true,
          body: config.storeResponse ? result.response.body : undefined,
        });
      } else {
        onResult({
          requestNumber: n,
          startedAt,
          status: null,
          timeMs: Date.now() - startedAt,
          success: false,
          error: result.error,
        });
      }
    } catch (err) {
      onResult({
        requestNumber: n,
        startedAt,
        status: null,
        timeMs: Date.now() - startedAt,
        success: false,
        error: { type: 'unknown', message: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      inFlight--;
      maybeSettle();
    }
  }

  function tick() {
    if (stopped) return maybeSettle();
    if (requestNumber >= config.count) return maybeSettle();
    if (inFlight >= MAX_CONCURRENT_REQUESTS) {
      timer = setTimeout(tick, CAP_POLL_MS);
      return;
    }

    requestNumber++;
    const n = requestNumber;
    inFlight++;
    void fireOne(n); // not awaited — this is what makes firing concurrent

    if (requestNumber < config.count) {
      timer = setTimeout(tick, config.intervalMs);
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    maybeSettle(); // covers the case where nothing was ever fired/in flight yet
  }

  tick(); // fires request #1 immediately (t=0)

  return { stop };
}
