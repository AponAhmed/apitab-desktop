import type { ApiRequest, HttpMethod } from './request';
import type { ApiError } from './response';
import type { VariableMap } from '@/utils/variables';

export interface StressTestConfig {
  /** Total requests to fire. */
  count: number;
  /** Delay in ms between successive fire *starts* (not between completions). */
  intervalMs: number;
  /** Whether to keep each response's body text. Off by default — avoids storing large bodies for hundreds/thousands of requests. */
  storeResponse: boolean;
}

export type StressTestRunStatus = 'running' | 'stopped' | 'completed';

export interface StressTestRequestResult {
  /** 1-based, assigned when the request is scheduled/fired — not completion order. */
  requestNumber: number;
  startedAt: number;
  /** HTTP status code, or null if the request errored before a response arrived. */
  status: number | null;
  /** Round-trip time in ms, or null if it errored before completion. */
  timeMs: number | null;
  /** Transport-level success (mirrors RequestResult.ok) — independent of HTTP status class, so a 404 is still success: true. */
  success: boolean;
  error?: ApiError;
  /** Present only when the run's config had storeResponse enabled and the request succeeded. */
  body?: string;
}

export interface StressTestRun {
  id: string;
  requestId: string;
  requestName: string;
  method: HttpMethod;
  /** Frozen at Start via structuredClone — later edits to the live request never affect this run. */
  requestSnapshot: ApiRequest;
  /** Resolved active-environment variables, frozen at Start. */
  varsSnapshot: VariableMap;
  config: StressTestConfig;
  status: StressTestRunStatus;
  /** Keyed by requestNumber, not push/arrival order — concurrent requests resolve out of order. */
  results: Record<number, StressTestRequestResult>;
  startedAt: number;
  /** Set once every fired request has settled (in-flight drained), regardless of status. */
  endedAt: number | null;
}

export interface StressTestSummary {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  avgTimeMs: number | null;
  minTimeMs: number | null;
  maxTimeMs: number | null;
  requestsPerSec: number | null;
  /** Keyed by status code as a string, or 'error' for transport failures. */
  statusCounts: Record<string, number>;
}
