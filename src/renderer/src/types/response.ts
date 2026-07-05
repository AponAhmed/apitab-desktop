export interface ResponseHeader {
  key: string;
  value: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: ResponseHeader[];
  /** Response body decoded as text. */
  body: string;
  contentType: string;
  /** Total round-trip time in milliseconds. */
  timeMs: number;
  /** Body size in bytes. */
  sizeBytes: number;
  redirected: boolean;
  finalUrl: string;
}

export type ApiErrorType =
  | 'network'
  | 'cors'
  | 'timeout'
  | 'abort'
  | 'invalid-url'
  | 'unknown';

export interface ApiError {
  type: ApiErrorType;
  message: string;
}

/** Discriminated result returned by the request execution service. */
export type RequestResult =
  | { ok: true; response: ApiResponse }
  | { ok: false; error: ApiError };
