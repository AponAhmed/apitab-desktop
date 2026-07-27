import type { BodyType, RequestResult } from '@/types';

/** A form-data field, resolved to either a text value or file bytes. */
export interface WireFormDataField {
  key: string;
  value: string;
  fileName?: string;
  fileType?: string;
  /** Base64-encoded file bytes (see utils/binary.ts) — see requestService.ts's readFileForWire. */
  fileData?: string;
}

export interface WireFile {
  fileName: string;
  fileType: string;
  /** Base64-encoded file bytes — see WireFormDataField.fileData. */
  fileData: string;
}

/** A fully-resolved HTTP request, ready to execute — sent renderer -> main. */
export interface WireRequest {
  method: string;
  url: string;
  headers: [string, string][];
  bodyType: BodyType;
  body: string | null;
  formData?: WireFormDataField[];
  /** Whole-body file for the 'binary' body type. */
  binary?: WireFile;
  timeoutMs: number;
}

/** Sends an HTTP request to the main process (via the preload bridge) and awaits the result. */
export async function sendExecuteRequest(payload: WireRequest): Promise<RequestResult> {
  return window.api.request.send(payload);
}
