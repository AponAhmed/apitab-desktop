import type { BodyType, HttpMethod } from './request';

export interface PreparedHeader {
  key: string;
  value: string;
}

export interface PreparedField {
  key: string;
  value: string;
  /** 'file' rows carry no resolved `value` — the actual bytes are looked up
   * from `stores/fileStore.ts` by `id` at send time (see requestService.ts). */
  valueType?: 'text' | 'file';
  fileName?: string;
  /** The originating KeyValue row's id — the file-store lookup key. */
  id?: string;
}

/**
 * A fully-resolved HTTP request (variables substituted, params/auth merged).
 * This single shape feeds request execution, cURL export and code snippets so
 * they always stay in sync.
 */
export interface PreparedRequest {
  method: HttpMethod;
  url: string;
  headers: PreparedHeader[];
  bodyType: BodyType;
  /** Serialized text body for json / raw / form-urlencoded bodies. */
  body: string | null;
  /** Field list for multipart form-data bodies. */
  formData?: PreparedField[];
  /** Display name of the chosen file for a 'binary' body — actual bytes looked up from the file store at send time. */
  binaryFileName?: string;
}
