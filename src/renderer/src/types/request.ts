/** Supported HTTP methods for the request builder. */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];

/** Methods that conventionally carry a request body. */
export const METHODS_WITH_BODY: HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** A single editable row used by params, headers and form bodies. */
export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  /** Free-text note — not sent with the request, purely documentation for the row. */
  description?: string;
  /**
   * Form-data rows only: whether `value` is plain text or the row instead
   * references a chosen file. The actual `File` object is never persisted
   * (browsers can't serialize it, and re-picking it every session is the
   * only sane option anyway) — it lives only in the in-memory
   * `stores/fileStore.ts`, keyed by this row's `id`. Absent/'text' for
   * every other use of KeyValue (params, headers, form-urlencoded).
   */
  valueType?: 'text' | 'file';
  /** Display name of the chosen file, for `valueType: 'file'` rows. */
  fileName?: string;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface BearerAuth {
  token: string;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface AuthConfig {
  type: AuthType;
  bearer: BearerAuth;
  basic: BasicAuth;
  apiKey: ApiKeyAuth;
}

export interface RequestScripts {
  /** JavaScript run before the request is sent. */
  preRequest: string;
  /** JavaScript run after the response arrives (tests / assertions). */
  postResponse: string;
}

export type BodyType = 'none' | 'json' | 'raw' | 'form-urlencoded' | 'form-data' | 'binary';

export interface RequestBody {
  type: BodyType;
  /** Raw JSON text (validated/formatted in the editor). */
  json: string;
  /** Arbitrary raw text body. */
  raw: string;
  formUrlEncoded: KeyValue[];
  formData: KeyValue[];
  /**
   * Display name of the chosen file for the 'binary' body type. Like
   * form-data file rows, the actual bytes live only in the in-memory
   * `stores/fileStore.ts` (keyed by `binary:${request.id}`), never persisted.
   */
  binaryFileName?: string;
}

/** A complete API request — used both as the live draft and when saved. */
export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  /** `:name` segments detected in the URL's path — see utils/query.ts. */
  pathVariables: KeyValue[];
  headers: KeyValue[];
  auth: AuthConfig;
  body: RequestBody;
  scripts: RequestScripts;
  createdAt: number;
  updatedAt: number;
}

/** Identifies a saved request inside a collection/folder (for "Update request"). */
export interface SavedRequestRef {
  /** The collection or folder that holds the request. */
  containerId: string;
  requestId: string;
}
