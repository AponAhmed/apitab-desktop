import { resolveString, type VariableMap } from '@/utils/variables';
import { applyPathVariables, splitUrl, urlWithParams } from '@/utils/query';
import { stripJsonComments } from '@/utils/json';
import { useFileStore, binaryFileKey } from '@/stores/fileStore';
import { arrayBufferToBase64 } from '@/utils/binary';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { sendExecuteRequest, type WireRequest } from './messaging';
import type {
  ApiRequest,
  KeyValue,
  PreparedField,
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

/** Like resolvePairs, but keeps file rows' id/fileName for send-time file lookup instead of resolving them as text. */
function resolveFormData(list: KeyValue[], vars: VariableMap): PreparedField[] {
  return list
    .filter((kv) => kv.enabled && kv.key.trim() !== '')
    .map((kv) =>
      kv.valueType === 'file'
        ? { key: resolveString(kv.key, vars), value: '', valueType: 'file' as const, fileName: kv.fileName, id: kv.id }
        : { key: resolveString(kv.key, vars), value: resolveString(kv.value, vars) },
    );
}

function hasHeader(headers: PreparedHeader[], name: string): boolean {
  return headers.some((h) => h.key.toLowerCase() === name.toLowerCase());
}

/**
 * Applies a script's env updates to the working vars and the active
 * environment. Shared by the single-request send path (requestStore.ts) and
 * the Collection Runner (collectionRunner.ts) so a later request in a run
 * sees variables an earlier request's script just set, matching how a
 * normal Send behaves.
 */
export function applyEnvUpdates(
  vars: VariableMap,
  updates: Record<string, string | null>,
  activeEnvId: string | null,
): VariableMap {
  const next = { ...vars };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
      if (activeEnvId) useEnvironmentStore.getState().upsertVariable(activeEnvId, key, value);
    }
  }
  return next;
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
        formData = resolveFormData(request.body.formData, vars);
        break;
      }
      case 'binary': {
        // No text to resolve — the actual bytes are looked up from the file
        // store by request id at send time (see executeRequest below), since
        // reading a File is async and this function stays synchronous (it
        // also feeds cURL/snippet generation, which never need the bytes).
        break;
      }
    }
  }

  return {
    method: request.method,
    url,
    headers,
    bodyType,
    body,
    formData,
    binaryFileName: bodyType === 'binary' ? request.body.binaryFileName : undefined,
  };
}

/** Reads a file chosen for a form-data row / binary body into wire-transferable bytes. */
async function readFileForWire(
  file: File,
): Promise<{ fileName: string; fileType: string; fileData: string }> {
  return { fileName: file.name, fileType: file.type, fileData: arrayBufferToBase64(await file.arrayBuffer()) };
}

/** Prepares and executes a request via the main process. */
export async function executeRequest(
  request: ApiRequest,
  vars: VariableMap,
  timeoutMs: number,
): Promise<{ prepared: PreparedRequest; result: RequestResult }> {
  const prepared = prepareRequest(request, vars);
  const files = useFileStore.getState().files;

  let formData: WireRequest['formData'];
  if (prepared.formData) {
    formData = await Promise.all(
      prepared.formData.map(async (f) => {
        const file = f.valueType === 'file' && f.id ? files[f.id] : undefined;
        return file ? { key: f.key, value: '', ...(await readFileForWire(file)) } : { key: f.key, value: f.value };
      }),
    );
  }

  let binary: WireRequest['binary'];
  if (prepared.bodyType === 'binary') {
    const file = files[binaryFileKey(request.id)];
    if (file) binary = await readFileForWire(file);
  }

  const wire: WireRequest = {
    method: prepared.method,
    url: prepared.url,
    headers: prepared.headers.map((h) => [h.key, h.value]),
    bodyType: prepared.bodyType,
    body: prepared.body,
    formData,
    binary,
    timeoutMs,
    ignoreTlsErrors: useSettingsStore.getState().ignoreTlsErrors,
  };
  const result = await sendExecuteRequest(wire);
  return { prepared, result };
}
