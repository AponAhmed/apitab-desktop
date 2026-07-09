import { uuid } from './id';
import { createRequest, defaultAuth, defaultBody, defaultScripts, emptyKeyValue } from './defaults';
import { formatJson } from './json';
import { paramsFromUrl, pathVariableNamesFromUrl } from './query';
import { COLLECTION_EXPORT_VERSION, type CollectionExport, type SharedVariable } from './collectionIO';
import type {
  ApiRequest,
  AuthConfig,
  CollectionFolder,
  Environment,
  HttpMethod,
  KeyValue,
  RequestBody,
  RequestScripts,
} from '@/types';
import { HTTP_METHODS } from '@/types';

/*
 * Converts a Postman Collection v2.0/v2.1 export (or a standalone Postman
 * Environment export) into ApiTab's own shapes. Postman's schema is loosely
 * typed in practice (fields are frequently missing/malformed in real-world
 * exports), so every read here tolerates absence rather than assuming.
 */

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[] | string;
  path?: string[] | string;
  query?: { key?: string; value?: string; disabled?: boolean }[];
  /** Postman's own recorded path-variable values, e.g. for `:id` in the path. */
  variable?: { key?: string; value?: string }[];
}

interface PostmanHeader {
  key?: string;
  value?: string;
  disabled?: boolean;
  description?: string;
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'graphql' | 'file';
  raw?: string;
  urlencoded?: { key?: string; value?: string; disabled?: boolean; description?: string }[];
  formdata?: { key?: string; value?: string; type?: string; disabled?: boolean; description?: string }[];
  graphql?: { query?: string; variables?: string };
  options?: { raw?: { language?: string } };
}

interface PostmanAuthParam {
  key?: string;
  value?: string;
}

interface PostmanAuth {
  type?: string;
  bearer?: PostmanAuthParam[];
  basic?: PostmanAuthParam[];
  apikey?: PostmanAuthParam[];
}

interface PostmanScriptEvent {
  listen?: string;
  script?: { exec?: string[] | string };
}

interface PostmanItem {
  name?: string;
  request?: {
    method?: string;
    header?: PostmanHeader[];
    url?: PostmanUrl | string;
    body?: PostmanBody;
    auth?: PostmanAuth;
  };
  event?: PostmanScriptEvent[];
  item?: PostmanItem[];
}

interface PostmanCollectionFile {
  info?: { name?: string; schema?: string };
  item?: PostmanItem[];
  variable?: { key?: string; value?: string }[];
}

interface PostmanEnvironmentFile {
  name?: string;
  values?: { key?: string; value?: string; enabled?: boolean }[];
  _postman_variable_scope?: string;
}

function urlToString(url: PostmanUrl | string | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;

  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '');
  const path = Array.isArray(url.path) ? url.path.join('/') : (url.path ?? '');
  const protocol = url.protocol ? `${url.protocol}://` : '';
  const base = `${protocol}${host}${path ? `/${path}` : ''}`;
  const query = (url.query ?? [])
    .filter((q) => !q.disabled)
    .map((q) => `${q.key ?? ''}=${q.value ?? ''}`)
    .join('&');
  return query ? `${base}?${query}` : base;
}

/** Builds path-variable rows for the `:name` segments actually present in `url`, using Postman's own recorded values where available. */
function convertPathVariables(url: PostmanUrl | string | undefined, resolvedUrl: string): KeyValue[] {
  const postmanVars = typeof url === 'object' ? (url.variable ?? []) : [];
  const valueByName = new Map(
    postmanVars.filter((v) => v.key).map((v) => [v.key as string, v.value ?? '']),
  );
  return pathVariableNamesFromUrl(resolvedUrl).map((name) =>
    emptyKeyValue({ key: name, value: valueByName.get(name) ?? '' }),
  );
}

function convertHeaders(headers: PostmanHeader[] | undefined): KeyValue[] {
  return (headers ?? [])
    .filter((h) => h.key)
    .map((h) => emptyKeyValue({ key: h.key ?? '', value: h.value ?? '', enabled: !h.disabled, description: h.description ?? '' }));
}

function authParam(params: PostmanAuthParam[] | undefined, key: string): string {
  return params?.find((p) => p.key === key)?.value ?? '';
}

function convertAuth(auth: PostmanAuth | undefined): AuthConfig {
  const base = defaultAuth();
  if (!auth?.type || auth.type === 'noauth') return base;

  if (auth.type === 'bearer') {
    return { ...base, type: 'bearer', bearer: { token: authParam(auth.bearer, 'token') } };
  }
  if (auth.type === 'basic') {
    return {
      ...base,
      type: 'basic',
      basic: {
        username: authParam(auth.basic, 'username'),
        password: authParam(auth.basic, 'password'),
      },
    };
  }
  if (auth.type === 'apikey') {
    return {
      ...base,
      type: 'apikey',
      apiKey: {
        key: authParam(auth.apikey, 'key'),
        value: authParam(auth.apikey, 'value'),
        addTo: authParam(auth.apikey, 'in') === 'query' ? 'query' : 'header',
      },
    };
  }
  // Unsupported auth type (oauth1/oauth2/digest/aws/hawk/ntlm/...) — ApiTab
  // has no equivalent config for these, so fall back to none. Any header the
  // user set manually (e.g. a literal Authorization value) is unaffected.
  return base;
}

function convertBody(body: PostmanBody | undefined): RequestBody {
  const result = defaultBody();
  if (!body?.mode) return result;

  switch (body.mode) {
    case 'raw': {
      const language = body.options?.raw?.language;
      if (language === 'json') {
        result.type = 'json';
        const pretty = formatJson(body.raw ?? '');
        result.json = pretty.ok ? pretty.value : (body.raw ?? '');
      } else {
        result.type = 'raw';
        result.raw = body.raw ?? '';
      }
      break;
    }
    case 'urlencoded':
      result.type = 'form-urlencoded';
      result.formUrlEncoded = [
        ...(body.urlencoded ?? [])
          .filter((f) => f.key)
          .map((f) => emptyKeyValue({ key: f.key ?? '', value: f.value ?? '', enabled: !f.disabled, description: f.description ?? '' })),
        emptyKeyValue(),
      ];
      break;
    case 'formdata':
      result.type = 'form-data';
      result.formData = [
        // File fields have no local file to attach — imported as an empty
        // text field the user can refill, rather than silently dropped.
        ...(body.formdata ?? [])
          .filter((f) => f.key)
          .map((f) =>
            emptyKeyValue({
              key: f.key ?? '',
              value: f.type === 'file' ? '' : (f.value ?? ''),
              enabled: !f.disabled,
              description: f.description ?? '',
            }),
          ),
        emptyKeyValue(),
      ];
      break;
    case 'graphql':
      result.type = 'raw';
      result.raw = JSON.stringify(
        { query: body.graphql?.query ?? '', variables: body.graphql?.variables ?? '' },
        null,
        2,
      );
      break;
    case 'file':
      // No local file reference survives export — leave the body empty.
      break;
  }
  return result;
}

function convertScripts(events: PostmanScriptEvent[] | undefined): RequestScripts {
  const scripts = defaultScripts();
  for (const event of events ?? []) {
    const exec = event.script?.exec;
    const code = Array.isArray(exec) ? exec.join('\n') : (exec ?? '');
    if (!code.trim()) continue;
    // ApiTab's sandbox accepts `pm.*` as an alias for `apitab.*`, so pasted
    // Postman scripts run unmodified — see utils/scriptSandbox.ts.
    if (event.listen === 'prerequest') scripts.preRequest = code;
    else if (event.listen === 'test') scripts.postResponse = code;
  }
  return scripts;
}

function isFolderItem(item: PostmanItem): boolean {
  return Array.isArray(item.item) && !item.request;
}

function convertRequestItem(item: PostmanItem): ApiRequest {
  const req = item.request;
  const method = (req?.method ?? 'GET').toUpperCase();
  const validMethod = (HTTP_METHODS as string[]).includes(method) ? (method as HttpMethod) : 'GET';
  const url = urlToString(req?.url);

  return createRequest({
    name: item.name || 'Imported Request',
    method: validMethod,
    url,
    params: [...paramsFromUrl(url), emptyKeyValue()],
    pathVariables: convertPathVariables(req?.url, url),
    headers: [...convertHeaders(req?.header), emptyKeyValue()],
    auth: convertAuth(req?.auth),
    body: convertBody(req?.body),
    scripts: convertScripts(item.event),
  });
}

function convertItems(items: PostmanItem[] | undefined): {
  folders: CollectionFolder[];
  requests: ApiRequest[];
} {
  const folders: CollectionFolder[] = [];
  const requests: ApiRequest[] = [];
  for (const item of items ?? []) {
    if (isFolderItem(item)) {
      const sub = convertItems(item.item);
      folders.push({ id: uuid(), name: item.name || 'Folder', folders: sub.folders, requests: sub.requests });
    } else if (item.request) {
      requests.push(convertRequestItem(item));
    }
  }
  return { folders, requests };
}

export interface PostmanParseResult {
  ok: boolean;
  /** Present when the file was a Postman collection export. */
  data?: CollectionExport;
  /** Present when the file was a standalone Postman environment export. */
  environment?: Environment;
  error?: string;
}

function looksLikeEnvironmentFile(obj: PostmanEnvironmentFile): boolean {
  return Array.isArray(obj.values);
}

function looksLikeCollectionFile(obj: PostmanCollectionFile): boolean {
  return Array.isArray(obj.item) && obj.info !== undefined;
}

/** Parses a standalone Postman Environment export into an ApiTab Environment. */
function parsePostmanEnvironment(obj: PostmanEnvironmentFile): Environment {
  const now = Date.now();
  return {
    id: uuid(),
    name: obj.name || 'Imported Environment',
    variables: (obj.values ?? [])
      .filter((v) => v.key)
      .map((v) => ({ id: uuid(), key: v.key ?? '', value: v.value ?? '', enabled: v.enabled ?? true })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Parses a Postman Collection export into ApiTab's CollectionExport envelope. */
function parsePostmanCollection(obj: PostmanCollectionFile): CollectionExport {
  const { folders, requests } = convertItems(obj.item);
  const now = Date.now();
  const variables: SharedVariable[] = (obj.variable ?? [])
    .filter((v): v is { key: string; value?: string } => typeof v.key === 'string' && v.key.trim() !== '')
    .map((v) => ({ key: v.key, value: v.value ?? '' }));

  return {
    app: 'apitab',
    type: 'collection',
    version: COLLECTION_EXPORT_VERSION,
    exportedAt: now,
    item: {
      id: uuid(),
      name: obj.info?.name || 'Imported Collection',
      folders,
      requests,
      createdAt: now,
      updatedAt: now,
    },
    ...(variables.length ? { environmentVariables: variables } : {}),
  };
}

/**
 * Auto-detects and parses a Postman export (collection or environment).
 * Returns `data` (a CollectionExport, ready for the existing
 * importAsCollection/importIntoContainer actions) or `environment`
 * (ready for environmentStore), never both.
 */
export function parsePostmanFile(raw: string): PostmanParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  const obj = json as PostmanCollectionFile & PostmanEnvironmentFile;
  if (looksLikeEnvironmentFile(obj)) {
    return { ok: true, environment: parsePostmanEnvironment(obj) };
  }
  if (looksLikeCollectionFile(obj)) {
    return { ok: true, data: parsePostmanCollection(obj) };
  }
  return { ok: false, error: 'Not a recognized Postman collection or environment export.' };
}
