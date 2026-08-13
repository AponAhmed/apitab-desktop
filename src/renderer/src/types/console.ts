import type { HttpMethod } from './request';
import type { PreparedRequest } from './http';
import type { ApiResponse, ApiError } from './response';
import type { ConsoleLog } from './scripts';

export type ConsoleLogLevel = ConsoleLog['level'];

/** A console.log() line from a pre-request or post-response script, tagged with which phase emitted it. */
export interface ConsoleScriptLog extends ConsoleLog {
  phase: 'pre' | 'post';
}

/**
 * One logged request/response pair for the Debug Console — built from the
 * exact same `prepared`/`result`/`scriptRun` values already computed by
 * requestStore.ts's `send()`, not a separate re-resolution. `prepared` is
 * reused as-is (not a new "resolved request" shape) since it already
 * includes every ApiTab-added header (auth, content-type) — see
 * services/requestService.ts's `prepareRequest`.
 */
export interface ConsoleEntry {
  id: string;
  requestId: string;
  requestName: string;
  method: HttpMethod;
  prepared: PreparedRequest;
  /** False only if even the best-effort catch-path re-resolve failed — see requestStore.ts. */
  resolved: boolean;
  timestamp: number;
  response: ApiResponse | null;
  error: ApiError | null;
  scriptLogs: ConsoleScriptLog[];
  /** Highest severity across scriptLogs; elevated to 'error' on a request or script error. */
  level: ConsoleLogLevel;
  requestBodyTruncated: boolean;
  responseBodyTruncated: boolean;
}
