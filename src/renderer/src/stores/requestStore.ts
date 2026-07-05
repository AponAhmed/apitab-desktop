import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createRequest, emptyKeyValue } from '@/utils/defaults';
import { formatJson } from '@/utils/json';
import { paramsFromUrl, urlWithParams } from '@/utils/query';
import { uuid } from '@/utils/id';
import { executeRequest, prepareRequest } from '@/services/requestService';
import { runScript } from '@/services/scriptRunner';
import { parseCurl, type ParseCurlResult } from '@/utils/curl';
import { browserLocalStorage } from './persist';
import { useEnvironmentStore } from './environmentStore';
import { useSettingsStore } from './settingsStore';
import { useHistoryStore } from './historyStore';
import { useCollectionStore } from './collectionStore';
import type {
  ApiRequest,
  ApiResponse,
  ApiError,
  AuthType,
  BodyType,
  HttpMethod,
  KeyValue,
  PreparedHeader,
  SavedRequestRef,
  ScriptRunResult,
} from '@/types';
import type { VariableMap } from '@/utils/variables';

export type RequestTab = 'params' | 'headers' | 'auth' | 'body' | 'scripts';
export type ResponseTab = 'body' | 'headers' | 'curl' | 'code' | 'tests';

function headersToRecord(headers: PreparedHeader[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const h of headers) record[h.key] = h.value;
  return record;
}

/** Applies a script's env updates to the working vars and the active environment. */
function applyEnvUpdates(
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

/** Coerces possibly-corrupted (e.g. null from legacy/synced data) fields to safe strings. */
function sanitizeKeyValue(kv: KeyValue): KeyValue {
  return { ...kv, key: kv.key ?? '', value: kv.value ?? '', enabled: kv.enabled ?? true };
}

/** Ensures a key/value list always ends with one blank row for quick entry. */
function withTrailingRow(rows: KeyValue[]): KeyValue[] {
  const sanitized = rows.map(sanitizeKeyValue);
  const last = sanitized[sanitized.length - 1];
  if (!last || last.key !== '' || last.value !== '') return [...sanitized, emptyKeyValue()];
  return sanitized;
}

/** Snapshot of a request's last outcome, cached so switching between saved
 * requests shows each one's own last response instead of a blank panel. */
export interface CachedResponse {
  response: ApiResponse | null;
  error: ApiError | null;
  scriptRun: ScriptRunResult | null;
  sentAt: number | null;
}

/**
 * The stable identity to cache a response under: the saved-request id when
 * this request has been saved (so reopening it from a collection finds its
 * last response), otherwise the draft's own (transient) id.
 */
function responseCacheKey(request: ApiRequest, savedRef: SavedRequestRef | null): string {
  return savedRef?.requestId ?? request.id;
}

/** Backfills defaults + trailing rows so any request is safe to edit/render. */
function normalizeForEditing(req: ApiRequest): ApiRequest {
  const base = createRequest();
  const merged: ApiRequest = {
    ...base,
    ...req,
    auth: {
      type: req.auth?.type ?? 'none',
      bearer: { ...base.auth.bearer, ...req.auth?.bearer },
      basic: { ...base.auth.basic, ...req.auth?.basic },
      apiKey: { ...base.auth.apiKey, ...req.auth?.apiKey },
    },
    body: {
      ...base.body,
      ...req.body,
      formUrlEncoded: withTrailingRow(req.body?.formUrlEncoded ?? []),
      formData: withTrailingRow(req.body?.formData ?? []),
    },
    scripts: {
      preRequest: req.scripts?.preRequest ?? '',
      postResponse: req.scripts?.postResponse ?? '',
    },
    params: withTrailingRow(req.params ?? []),
    headers: withTrailingRow(req.headers ?? []),
  };
  return merged;
}

interface RequestState {
  request: ApiRequest;
  response: ApiResponse | null;
  error: ApiError | null;
  isLoading: boolean;
  sentAt: number | null;
  savedRef: SavedRequestRef | null;
  scriptRun: ScriptRunResult | null;
  activeRequestTab: RequestTab;
  activeResponseTab: ResponseTab;
  /** Last response/error/scriptRun per request id — see {@link responseCacheKey}. */
  responseCache: Record<string, CachedResponse>;

  // URL / method / name
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setName: (name: string) => void;

  // Query params (kept in sync with the URL)
  updateParam: (id: string, patch: Partial<KeyValue>) => void;
  removeParam: (id: string) => void;

  // Headers
  updateHeader: (id: string, patch: Partial<KeyValue>) => void;
  removeHeader: (id: string) => void;

  // Auth
  setAuthType: (type: AuthType) => void;
  setBearerToken: (token: string) => void;
  setBasicAuth: (patch: Partial<ApiRequest['auth']['basic']>) => void;
  setApiKeyAuth: (patch: Partial<ApiRequest['auth']['apiKey']>) => void;

  // Body
  setBodyType: (type: BodyType) => void;
  setJsonBody: (json: string) => void;
  setRawBody: (raw: string) => void;
  formatJsonBody: () => void;

  // Scripts
  setPreRequestScript: (code: string) => void;
  setPostResponseScript: (code: string) => void;
  updateFormUrlEncoded: (id: string, patch: Partial<KeyValue>) => void;
  removeFormUrlEncoded: (id: string) => void;
  updateFormData: (id: string, patch: Partial<KeyValue>) => void;
  removeFormData: (id: string) => void;

  // Tabs
  setRequestTab: (tab: RequestTab) => void;
  setResponseTab: (tab: ResponseTab) => void;

  // Lifecycle
  send: () => Promise<void>;
  newRequest: () => void;
  loadRequest: (
    req: ApiRequest,
    savedRef?: SavedRequestRef | null,
    snapshot?: CachedResponse | null,
  ) => void;
  importCurl: (text: string) => ParseCurlResult;
  saveToCollection: (collectionId: string, name: string) => ApiRequest | null;
  updateSaved: () => boolean;
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set, get) => {
      const patch = (mutate: (r: ApiRequest) => ApiRequest) =>
        set((s) => ({ request: { ...mutate(s.request), updatedAt: Date.now() } }));

      return {
        request: normalizeForEditing(createRequest()),
        response: null,
        error: null,
        isLoading: false,
        sentAt: null,
        savedRef: null,
        scriptRun: null,
        activeRequestTab: 'params',
        activeResponseTab: 'body',
        responseCache: {},

        setMethod: (method) => patch((r) => ({ ...r, method })),

        setUrl: (url) =>
          patch((r) => ({ ...r, url, params: withTrailingRow(paramsFromUrl(url)) })),

        setName: (name) => patch((r) => ({ ...r, name })),

        updateParam: (id, p) =>
          patch((r) => {
            const params = withTrailingRow(
              r.params.map((kv) => (kv.id === id ? { ...kv, ...p } : kv)),
            );
            return { ...r, params, url: urlWithParams(r.url, params) };
          }),

        removeParam: (id) =>
          patch((r) => {
            const params = withTrailingRow(r.params.filter((kv) => kv.id !== id));
            return { ...r, params, url: urlWithParams(r.url, params) };
          }),

        updateHeader: (id, p) =>
          patch((r) => ({
            ...r,
            headers: withTrailingRow(
              r.headers.map((kv) => (kv.id === id ? { ...kv, ...p } : kv)),
            ),
          })),

        removeHeader: (id) =>
          patch((r) => ({
            ...r,
            headers: withTrailingRow(r.headers.filter((kv) => kv.id !== id)),
          })),

        setAuthType: (type) => patch((r) => ({ ...r, auth: { ...r.auth, type } })),
        setBearerToken: (token) =>
          patch((r) => ({ ...r, auth: { ...r.auth, bearer: { token } } })),
        setBasicAuth: (p) =>
          patch((r) => ({ ...r, auth: { ...r.auth, basic: { ...r.auth.basic, ...p } } })),
        setApiKeyAuth: (p) =>
          patch((r) => ({ ...r, auth: { ...r.auth, apiKey: { ...r.auth.apiKey, ...p } } })),

        setBodyType: (type) => patch((r) => ({ ...r, body: { ...r.body, type } })),
        setJsonBody: (json) => patch((r) => ({ ...r, body: { ...r.body, json } })),
        setRawBody: (raw) => patch((r) => ({ ...r, body: { ...r.body, raw } })),
        formatJsonBody: () =>
          patch((r) => {
            const result = formatJson(r.body.json);
            return result.ok ? { ...r, body: { ...r.body, json: result.value } } : r;
          }),

        setPreRequestScript: (code) =>
          patch((r) => ({ ...r, scripts: { ...r.scripts, preRequest: code } })),
        setPostResponseScript: (code) =>
          patch((r) => ({ ...r, scripts: { ...r.scripts, postResponse: code } })),

        updateFormUrlEncoded: (id, p) =>
          patch((r) => ({
            ...r,
            body: {
              ...r.body,
              formUrlEncoded: withTrailingRow(
                r.body.formUrlEncoded.map((kv) => (kv.id === id ? { ...kv, ...p } : kv)),
              ),
            },
          })),
        removeFormUrlEncoded: (id) =>
          patch((r) => ({
            ...r,
            body: {
              ...r.body,
              formUrlEncoded: withTrailingRow(r.body.formUrlEncoded.filter((kv) => kv.id !== id)),
            },
          })),
        updateFormData: (id, p) =>
          patch((r) => ({
            ...r,
            body: {
              ...r.body,
              formData: withTrailingRow(
                r.body.formData.map((kv) => (kv.id === id ? { ...kv, ...p } : kv)),
              ),
            },
          })),
        removeFormData: (id) =>
          patch((r) => ({
            ...r,
            body: {
              ...r.body,
              formData: withTrailingRow(r.body.formData.filter((kv) => kv.id !== id)),
            },
          })),

        setRequestTab: (activeRequestTab) => set({ activeRequestTab }),
        setResponseTab: (activeResponseTab) => set({ activeResponseTab }),

        send: async () => {
          const { request } = get();
          if (get().isLoading) return;
          set({ isLoading: true, error: null, scriptRun: null });

          const envStore = useEnvironmentStore.getState();
          const activeEnvId = envStore.activeEnvironmentId;
          let vars = { ...envStore.getActiveVariables() };
          const timeout = useSettingsStore.getState().requestTimeoutMs;
          const scriptRun: ScriptRunResult = {};

          try {
            // Pre-request script (may set environment variables used below).
            if (request.scripts.preRequest.trim()) {
              const preview = prepareRequest(request, vars);
              scriptRun.pre = await runScript(request.scripts.preRequest, {
                request: {
                  method: preview.method,
                  url: preview.url,
                  headers: headersToRecord(preview.headers),
                },
                environment: vars,
              });
              vars = applyEnvUpdates(vars, scriptRun.pre.envUpdates, activeEnvId);
            }

            const { prepared, result } = await executeRequest(request, vars, timeout);

            if (result.ok) {
              set({ response: result.response, error: null, sentAt: Date.now() });

              // Post-response script (tests / assertions).
              if (request.scripts.postResponse.trim()) {
                scriptRun.post = await runScript(request.scripts.postResponse, {
                  request: {
                    method: prepared.method,
                    url: prepared.url,
                    headers: headersToRecord(prepared.headers),
                  },
                  response: {
                    status: result.response.status,
                    statusText: result.response.statusText,
                    headers: result.response.headers,
                    body: result.response.body,
                    timeMs: result.response.timeMs,
                    sizeBytes: result.response.sizeBytes,
                  },
                  environment: vars,
                });
                vars = applyEnvUpdates(vars, scriptRun.post.envUpdates, activeEnvId);
              }
            } else {
              set({ response: null, error: result.error, sentAt: Date.now() });
            }

            const hasScriptOutput = Boolean(scriptRun.pre || scriptRun.post);
            const showTests = Boolean(
              scriptRun.pre?.error ||
                scriptRun.post?.error ||
                scriptRun.pre?.tests.length ||
                scriptRun.post?.tests.length ||
                scriptRun.pre?.logs.length ||
                scriptRun.post?.logs.length,
            );
            const finalScriptRun = hasScriptOutput ? scriptRun : null;
            set((s) => ({
              isLoading: false,
              scriptRun: finalScriptRun,
              activeResponseTab: showTests ? 'tests' : result.ok ? 'body' : s.activeResponseTab,
              responseCache: {
                ...s.responseCache,
                [responseCacheKey(request, s.savedRef)]: {
                  response: result.ok ? result.response : null,
                  error: result.ok ? null : result.error,
                  scriptRun: finalScriptRun,
                  sentAt: Date.now(),
                },
              },
            }));

            useHistoryStore.getState().addEntry(
              {
                id: uuid(),
                method: request.method,
                url: prepared.url || request.url,
                timestamp: Date.now(),
                status: result.ok ? result.response.status : undefined,
                request: structuredClone(request),
                response: result.ok ? result.response : null,
                error: result.ok ? null : result.error,
                scriptRun: finalScriptRun,
              },
              useSettingsStore.getState().historyLimit,
            );
          } catch (err) {
            const caughtError: ApiError = { type: 'unknown', message: (err as Error).message };
            const caughtScriptRun = scriptRun.pre || scriptRun.post ? scriptRun : null;
            set((s) => ({
              response: null,
              error: caughtError,
              isLoading: false,
              scriptRun: caughtScriptRun,
              sentAt: Date.now(),
              responseCache: {
                ...s.responseCache,
                [responseCacheKey(request, s.savedRef)]: {
                  response: null,
                  error: caughtError,
                  scriptRun: caughtScriptRun,
                  sentAt: Date.now(),
                },
              },
            }));
          }
        },

        newRequest: () =>
          set({
            request: normalizeForEditing(createRequest()),
            savedRef: null,
            response: null,
            error: null,
            isLoading: false,
            sentAt: null,
            scriptRun: null,
          }),

        loadRequest: (req, savedRef = null, snapshot) =>
          set((s) => {
            const cached = snapshot !== undefined ? snapshot : s.responseCache[responseCacheKey(req, savedRef)];
            return {
              request: normalizeForEditing(structuredClone(req)),
              savedRef,
              response: cached?.response ?? null,
              error: cached?.error ?? null,
              isLoading: false,
              sentAt: cached?.sentAt ?? null,
              scriptRun: cached?.scriptRun ?? null,
            };
          }),

        importCurl: (text) => {
          const result = parseCurl(text);
          if (result.ok && result.request) get().loadRequest(result.request, null);
          return result;
        },

        saveToCollection: (containerId, name) => {
          const saved = useCollectionStore
            .getState()
            .addRequest(containerId, get().request, name);
          if (saved) {
            set((s) => {
              // Carry the draft's cached response over to the new saved id,
              // so it's still there next time this saved request is opened.
              const oldKey = responseCacheKey(s.request, s.savedRef);
              const cached = s.responseCache[oldKey];
              return {
                savedRef: { containerId, requestId: saved.id },
                request: { ...s.request, name: saved.name },
                responseCache: cached
                  ? { ...s.responseCache, [saved.id]: cached }
                  : s.responseCache,
              };
            });
          }
          return saved;
        },

        updateSaved: () => {
          const { savedRef, request } = get();
          if (!savedRef) return false;
          useCollectionStore.getState().updateRequest({ ...request, id: savedRef.requestId });
          return true;
        },
      };
    },
    {
      name: 'apitab:draft',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: (s) => ({
        request: s.request,
        savedRef: s.savedRef,
        activeRequestTab: s.activeRequestTab,
        activeResponseTab: s.activeResponseTab,
        responseCache: s.responseCache,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RequestState>;
        return {
          ...current,
          ...p,
          request: p.request ? normalizeForEditing(p.request) : current.request,
          responseCache: p.responseCache ?? {},
        };
      },
    },
  ),
);
