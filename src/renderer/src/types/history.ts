import type { HttpMethod, ApiRequest } from './request';
import type { ApiResponse, ApiError } from './response';
import type { ScriptRunResult } from './scripts';

export interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  timestamp: number;
  status?: number;
  /** Full snapshot so the request can be reopened exactly as sent. */
  request: ApiRequest;
  /**
   * The response/error this entry actually received, so reopening it (e.g.
   * from the History panel or the recent-requests bar) shows what really
   * came back — not whatever happens to be cached under the current draft's
   * (possibly reused-across-edits) id.
   */
  response?: ApiResponse | null;
  error?: ApiError | null;
  scriptRun?: ScriptRunResult | null;
}
