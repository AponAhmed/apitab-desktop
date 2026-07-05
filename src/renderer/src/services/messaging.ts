import type { BodyType, RequestResult } from '@/types';

/** A fully-resolved HTTP request, ready to execute — sent renderer -> main. */
export interface WireRequest {
  method: string;
  url: string;
  headers: [string, string][];
  bodyType: BodyType;
  body: string | null;
  formData?: { key: string; value: string }[];
  timeoutMs: number;
}

/** Sends an HTTP request to the main process (via the preload bridge) and awaits the result. */
export async function sendExecuteRequest(payload: WireRequest): Promise<RequestResult> {
  return window.api.request.send(payload);
}
