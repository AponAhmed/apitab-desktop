import { resolveString, type VariableMap } from '@/utils/variables';
import { applyPathVariables, splitUrl, urlWithParams } from '@/utils/query';
import { stripJsonComments } from '@/utils/json';
import { sendExecuteRequest, type WireRequest } from './messaging';
import type {
  ApiRequest,
  KeyValue,
  PreparedHeader,
  PreparedRequest,
  RequestResult,
} from '@/types';
import { METHODS_WITH_BODY } from '@/types';

function resolvePairs(list: KeyValue[], vars: VariableMap): PreparedHeader[] {
  return list
    .filter((kv) => kv.enabled && kv.key.trim() !== '')
    .map((kv) => ({
      key: resolveString(kv.key, vars),
      value: resolveString(kv.value, vars),
    }));
}

function hasHeader(headers: PreparedHeader[], name: string): boolean {
  return headers.some((h) => h.key.toLowerCase() === name.toLowerCase());
}

/**
 * Resolves environment variables and merges params, auth and body into a single
 * normalized {@link PreparedRequest}. This drives execution, cURL and snippets.
 */
export function prepareRequest(request: ApiRequest, vars: VariableMap = {}): PreparedRequest {
  const headers: PreparedHeader[] = resolvePairs(request.headers, vars);

  // Resolve params and append API-key-in-query if configured.
  const params: KeyValue[] = request.params
    .filter((p) => p.enabled && p.key.trim() !== '')
    .map((p) => ({ ...p, key: resolveString(p.key, vars), value: resolveString(p.value, vars) }));

  // Authorization.
  const { auth } = request;
  if (auth.type === 'bearer' && auth.bearer.token) {
    headers.push({ key: 'Authorization', value: `Bearer ${resolveString(auth.bearer.token, vars)}` });
  } else if (auth.type === 'basic') {
    const user = resolveString(auth.basic.username, vars);
    const pass = resolveString(auth.basic.password, vars);
    headers.push({ key: 'Authorization', value: `Basic ${btoa(`${user}:${pass}`)}` });
  } else if (auth.type === 'apikey' && auth.apiKey.key) {
    const key = resolveString(auth.apiKey.key, vars);
    const value = resolveString(auth.apiKey.value, vars);
    if (auth.apiKey.addTo === 'query') {
      params.push({ id: 'apikey', key, value, enabled: true });
    } else {
      headers.push({ key, value });
    }
  }

  const resolvedUrl = resolveString(request.url, vars);
  const withPathVars = applyPathVariables(resolvedUrl, request.pathVariables ?? [], vars);
  const base = splitUrl(withPathVars).base;
  const url = params.length ? urlWithParams(base, params) : base;

  // Body.
  const allowsBody = METHODS_WITH_BODY.includes(request.method);
  let body: string | null = null;
  let formData: PreparedRequest['formData'];
  const bodyType = allowsBody ? request.body.type : 'none';

  if (allowsBody) {
    switch (request.body.type) {
      case 'json': {
        // `//` line comments are a body-editor-only convenience (see
        // utils/json.ts) — stripped here so what's actually sent (and
        // shown in generated cURL/code snippets, which both go through
        // this same prepareRequest) is always spec-compliant JSON.
        body = stripJsonComments(resolveString(request.body.json, vars));
        if (body && !hasHeader(headers, 'content-type')) {
          headers.push({ key: 'Content-Type', value: 'application/json' });
        }
        break;
      }
      case 'raw': {
        body = resolveString(request.body.raw, vars);
        break;
      }
      case 'form-urlencoded': {
        const pairs = resolvePairs(request.body.formUrlEncoded, vars);
        body = pairs
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&');
        if (body && !hasHeader(headers, 'content-type')) {
          headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
        }
        break;
      }
      case 'form-data': {
        formData = resolvePairs(request.body.formData, vars);
        break;
      }
    }
  }

  return { method: request.method, url, headers, bodyType, body, formData };
}

/** Prepares and executes a request via the background worker. */
export async function executeRequest(
  request: ApiRequest,
  vars: VariableMap,
  timeoutMs: number,
): Promise<{ prepared: PreparedRequest; result: RequestResult }> {
  const prepared = prepareRequest(request, vars);
  const wire: WireRequest = {
    method: prepared.method,
    url: prepared.url,
    headers: prepared.headers.map((h) => [h.key, h.value]),
    bodyType: prepared.bodyType,
    body: prepared.body,
    formData: prepared.formData,
    timeoutMs,
  };
  const result = await sendExecuteRequest(wire);
  return { prepared, result };
}
