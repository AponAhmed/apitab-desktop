import { uuid } from './id';
import type {
  ApiRequest,
  AuthConfig,
  KeyValue,
  RequestBody,
  RequestScripts,
} from '@/types';

/** A blank, enabled key/value row. */
export function emptyKeyValue(init: Partial<KeyValue> = {}): KeyValue {
  return { id: uuid(), key: '', value: '', enabled: true, ...init };
}

export function defaultAuth(): AuthConfig {
  return {
    type: 'none',
    bearer: { token: '' },
    basic: { username: '', password: '' },
    apiKey: { key: '', value: '', addTo: 'header' },
  };
}

export function defaultBody(): RequestBody {
  return {
    type: 'none',
    json: '',
    raw: '',
    formUrlEncoded: [emptyKeyValue()],
    formData: [emptyKeyValue()],
  };
}

export function defaultScripts(): RequestScripts {
  return { preRequest: '', postResponse: '' };
}

/** Creates a fresh request draft, optionally seeded with partial fields. */
export function createRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
  const now = Date.now();
  return {
    id: uuid(),
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    params: [emptyKeyValue()],
    pathVariables: [],
    headers: [emptyKeyValue()],
    auth: defaultAuth(),
    body: defaultBody(),
    scripts: defaultScripts(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Deep-clones a request and assigns it a new id (for duplicate / save). */
export function cloneRequest(req: ApiRequest, overrides: Partial<ApiRequest> = {}): ApiRequest {
  const copy: ApiRequest = structuredClone(req);
  const now = Date.now();
  return {
    ...copy,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
