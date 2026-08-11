import { load } from 'js-yaml';
import { uuid } from './id';
import { createRequest, defaultAuth, defaultBody, defaultScripts, emptyKeyValue } from './defaults';
import { COLLECTION_EXPORT_VERSION, type CollectionExport } from './collectionIO';
import { createRefResolutionCtx, isRecord, resolveRef, resolveSchema, type RefResolutionCtx } from './openApiRefResolver';
import { HTTP_METHODS } from '@/types';
import type { ApiRequest, AuthConfig, CollectionFolder, HttpMethod, RequestBody } from '@/types';

/*
 * Converts an OpenAPI 3.0/3.1 or Swagger 2.0 document (JSON or YAML) into
 * ApiTab's own shapes. Real-world specs are frequently non-strictly-valid,
 * so — matching postmanImport.ts's philosophy — every read here tolerates
 * absence rather than assuming, and a problem with one operation/field never
 * blocks the rest of the import; it's collected into `warnings` instead.
 */

// ---------- Minimal, permissive document shapes (private to this file) ----------

interface OasSecurityScheme {
  $ref?: string;
  type?: string; // 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'basic' (Swagger 2.0 uses 'basic' literally)
  name?: string; // apiKey
  in?: string; // apiKey: 'header' | 'query' | 'cookie' (cookie is OAS3-only)
  scheme?: string; // http: 'bearer' | 'basic' | ...
}

type OasSecurityRequirement = Record<string, string[]>; // { schemeName: scopes[] } — a set of AND'd schemes

interface OasParameter {
  $ref?: string;
  name?: string;
  in?: string; // 'query'|'header'|'path'|'cookie' (OAS3) or +'formData'|'body' (Swagger2)
  description?: string;
  type?: string; // Swagger2 primitive type carried directly on the param (e.g. 'file' for formData)
  schema?: unknown; // Swagger2 body param's schema, or OAS3 param's schema
}

interface OasMediaType {
  schema?: unknown;
  example?: unknown;
  examples?: Record<string, { value?: unknown } | undefined>;
  encoding?: Record<string, { contentType?: string } | undefined>;
}

interface OasOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: OasParameter[];
  security?: OasSecurityRequirement[];
  // Swagger 2.0
  consumes?: string[];
  // OAS 3.x
  requestBody?: { $ref?: string; content?: Record<string, OasMediaType> };
}

interface OasPathItem {
  $ref?: string;
  parameters?: OasParameter[];
  get?: OasOperation;
  put?: OasOperation;
  post?: OasOperation;
  delete?: OasOperation;
  options?: OasOperation;
  head?: OasOperation;
  patch?: OasOperation;
  trace?: OasOperation;
}

interface Swagger2Document {
  swagger: '2.0';
  info?: { title?: string };
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  paths?: Record<string, OasPathItem>;
  parameters?: Record<string, OasParameter>;
  securityDefinitions?: Record<string, OasSecurityScheme>;
  security?: OasSecurityRequirement[];
}

interface Oas3Document {
  openapi: string;
  info?: { title?: string };
  servers?: { url?: string }[];
  paths?: Record<string, OasPathItem>;
  components?: {
    parameters?: Record<string, OasParameter>;
    securitySchemes?: Record<string, OasSecurityScheme>;
  };
  security?: OasSecurityRequirement[];
}

type OasDocument = Swagger2Document | Oas3Document;
type OasVersion = 'swagger2' | 'oas3';

interface ImportCtx {
  version: OasVersion;
  ref: RefResolutionCtx;
  warnings: string[];
}

interface BuiltOperation {
  request: ApiRequest;
  folderTag: string | null;
}

const VERB_KEYS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

// ---------- Parsing ----------

function parseJsonOrYaml(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // fall through to YAML
  }
  try {
    return { ok: true, value: load(raw) };
  } catch {
    return { ok: false, error: 'File is not valid JSON or YAML.' };
  }
}

// ---------- Parameters ----------

function resolveParam(doc: unknown, param: OasParameter, ctx: ImportCtx): OasParameter {
  if (!param.$ref) return param;
  const resolved = resolveRef(doc, param.$ref);
  if (isRecord(resolved)) return resolved as OasParameter;
  ctx.warnings.push(`Parameter $ref "${param.$ref}" could not be resolved.`);
  return {};
}

function resolveParamsArray(params: OasParameter[] | undefined, doc: unknown, ctx: ImportCtx): OasParameter[] {
  return (params ?? []).map((p) => resolveParam(doc, p, ctx));
}

/** Operation-level parameters win over a shared (path-item-level) one with the same (in, name). */
function mergeParams(shared: OasParameter[], operation: OasParameter[]): OasParameter[] {
  const key = (p: OasParameter) => `${p.in ?? ''}:${p.name ?? ''}`;
  const map = new Map<string, OasParameter>();
  for (const p of shared) map.set(key(p), p);
  for (const p of operation) map.set(key(p), p);
  return [...map.values()];
}

/**
 * Rewrites OpenAPI's `{name}` path-template syntax to ApiTab's own `:name`
 * convention (utils/query.ts's PATH_VAR_SEGMENT only ever matches `:name`
 * whole-segment tokens — copying `{name}` verbatim would leave it as dead,
 * unsendable literal text). A `{...}` segment whose inner text isn't a bare
 * identifier (RFC 6570 modifiers like `{.format}`, `{id*}`) is left
 * untouched, with a warning.
 */
function rewritePathTemplate(path: string, ctx: ImportCtx): string {
  return path.replace(/\{([^}]*)\}/g, (whole, inner: string) => {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inner)) return `:${inner}`;
    ctx.warnings.push(`Path "${path}" has an unsupported parameter expression "{${inner}}", left as literal text.`);
    return whole;
  });
}

// ---------- Auth ----------

function mapSecurityScheme(scheme: OasSecurityScheme | undefined): AuthConfig | null {
  if (!scheme) return null;
  const base = defaultAuth();
  if (scheme.type === 'apiKey' && scheme.name) {
    return { ...base, type: 'apikey', apiKey: { key: scheme.name, value: '', addTo: scheme.in === 'query' ? 'query' : 'header' } };
  }
  if (scheme.type === 'http' && scheme.scheme === 'bearer') {
    return { ...base, type: 'bearer', bearer: { token: '' } };
  }
  if ((scheme.type === 'http' && scheme.scheme === 'basic') || scheme.type === 'basic') {
    return { ...base, type: 'basic', basic: { username: '', password: '' } };
  }
  // oauth2 / openIdConnect / unrecognized http scheme — no ApiTab equivalent.
  return null;
}

function resolveAuthForOperation(path: string, method: HttpMethod, operation: OasOperation, doc: OasDocument, ctx: ImportCtx): AuthConfig {
  const requirement = operation.security !== undefined ? operation.security : (doc.security ?? []);
  if (requirement.length === 0) return defaultAuth(); // explicit "no auth" or none declared — not a gap, no warning

  const schemeNames = Object.keys(requirement[0] ?? {});
  for (const name of schemeNames) {
    const raw = ctx.version === 'swagger2'
      ? (doc as Swagger2Document).securityDefinitions?.[name]
      : (doc as Oas3Document).components?.securitySchemes?.[name];
    let scheme = raw;
    if (scheme?.$ref) {
      const resolved = resolveRef(doc, scheme.$ref);
      scheme = isRecord(resolved) ? (resolved as OasSecurityScheme) : undefined;
    }
    const mapped = mapSecurityScheme(scheme);
    if (mapped) return mapped;
  }

  ctx.warnings.push(`${method} ${path}: no supported auth scheme found (oauth2/OpenID Connect or unrecognized), imported with no auth configured.`);
  return defaultAuth();
}

// ---------- Example synthesis ----------

/**
 * Best-effort synthesis of a representative JSON value from an already
 * $ref-resolved schema, used when a body has no literal `example`. Bounded
 * by `maxDepth` as defense-in-depth alongside the ref-resolver's own cycle
 * guard — doesn't need to be sophisticated, just non-empty and non-crashing.
 */
function synthesizeExample(schema: unknown, depth = 0, maxDepth = 6): unknown {
  if (!isRecord(schema)) return schema ?? {};
  if (schema.example !== undefined) return schema.example;
  if (depth > maxDepth) return null;

  const type = schema.type as string | undefined;
  if (type === 'string') return (Array.isArray(schema.enum) ? schema.enum[0] : undefined) ?? '';
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  if (type === 'array' || schema.items !== undefined) {
    return schema.items !== undefined ? [synthesizeExample(schema.items, depth + 1, maxDepth)] : [];
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((acc: Record<string, unknown>, sub: unknown) => {
      const synthesized = synthesizeExample(sub, depth + 1, maxDepth);
      return isRecord(synthesized) ? { ...acc, ...synthesized } : acc;
    }, {});
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) return synthesizeExample(schema.oneOf[0], depth + 1, maxDepth);
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) return synthesizeExample(schema.anyOf[0], depth + 1, maxDepth);
  if (type === 'object' || schema.properties !== undefined) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const keys = Array.isArray(schema.required) ? (schema.required as string[]) : Object.keys(properties);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (properties[key] !== undefined) out[key] = synthesizeExample(properties[key], depth + 1, maxDepth);
    }
    return out;
  }
  return {};
}

// ---------- Body extraction (version-specific) ----------

function extractSwagger2Body(operation: OasOperation, mergedParams: OasParameter[], doc: Swagger2Document, ctx: ImportCtx): RequestBody {
  const bodyParam = mergedParams.find((p) => p.in === 'body');
  const formParams = mergedParams.filter((p) => p.in === 'formData');
  const consumes = operation.consumes ?? doc.consumes ?? [];

  if (bodyParam) {
    const resolved = resolveSchema(doc, bodyParam.schema, ctx.ref);
    const literalExample = isRecord(bodyParam.schema) ? bodyParam.schema.example : undefined;
    const example = literalExample ?? synthesizeExample(resolved);
    if (consumes.length === 0 || consumes.includes('application/json')) {
      return { ...defaultBody(), type: 'json', json: JSON.stringify(example, null, 2) };
    }
    ctx.warnings.push(`Request body content type(s) "${consumes.join(', ')}" have no direct ApiTab equivalent, imported as raw text.`);
    return { ...defaultBody(), type: 'raw', raw: JSON.stringify(example, null, 2) };
  }

  if (formParams.length > 0) {
    const type: 'form-urlencoded' | 'form-data' = consumes.includes('application/x-www-form-urlencoded') ? 'form-urlencoded' : 'form-data';
    const rows = formParams.map((p) =>
      p.type === 'file'
        ? emptyKeyValue({ key: p.name ?? '', valueType: 'file', fileName: p.name, description: p.description ?? '' })
        : emptyKeyValue({ key: p.name ?? '', description: p.description ?? '' }),
    );
    rows.push(emptyKeyValue());
    return type === 'form-urlencoded'
      ? { ...defaultBody(), type, formUrlEncoded: rows }
      : { ...defaultBody(), type, formData: rows };
  }

  return defaultBody();
}

function extractOas3Body(operation: OasOperation, doc: Oas3Document, ctx: ImportCtx): RequestBody {
  let requestBody = operation.requestBody;
  if (requestBody?.$ref) {
    const resolved = resolveRef(doc, requestBody.$ref);
    requestBody = isRecord(resolved) ? (resolved as typeof requestBody) : undefined;
  }
  const content = requestBody?.content ?? {};
  const mediaKeys = Object.keys(content);
  if (mediaKeys.length === 0) return defaultBody();

  const jsonKey = mediaKeys.find((k) => k === 'application/json' || k.endsWith('+json'));
  if (jsonKey) {
    const media = content[jsonKey];
    const resolved = resolveSchema(doc, media.schema, ctx.ref);
    const example = media.example ?? Object.values(media.examples ?? {})[0]?.value ?? synthesizeExample(resolved);
    return { ...defaultBody(), type: 'json', json: JSON.stringify(example, null, 2) };
  }

  const formKey = mediaKeys.includes('application/x-www-form-urlencoded')
    ? 'application/x-www-form-urlencoded'
    : mediaKeys.includes('multipart/form-data')
      ? 'multipart/form-data'
      : undefined;
  if (formKey) {
    const media = content[formKey];
    const resolved = resolveSchema(doc, media.schema, ctx.ref);
    const properties = isRecord(resolved) && isRecord(resolved.properties) ? resolved.properties : {};
    const encoding = media.encoding ?? {};
    const rows = Object.entries(properties).map(([propName, propSchemaRaw]) => {
      const propSchema = isRecord(propSchemaRaw) ? propSchemaRaw : {};
      const isFile = (propSchema.type === 'string' && propSchema.format === 'binary') || encoding[propName]?.contentType?.startsWith('application/octet-stream');
      return isFile
        ? emptyKeyValue({ key: propName, valueType: 'file', fileName: propName })
        : emptyKeyValue({ key: propName, value: propSchema.example != null ? String(propSchema.example) : '' });
    });
    rows.push(emptyKeyValue());
    return formKey === 'application/x-www-form-urlencoded'
      ? { ...defaultBody(), type: 'form-urlencoded', formUrlEncoded: rows }
      : { ...defaultBody(), type: 'form-data', formData: rows };
  }

  // Fallback: first available media type (e.g. XML, plain text), imported as raw.
  const fallbackKey = mediaKeys[0];
  const media = content[fallbackKey];
  ctx.warnings.push(`Request body content type "${fallbackKey}" has no direct ApiTab equivalent, imported as raw text.`);
  const resolved = media.schema !== undefined ? resolveSchema(doc, media.schema, ctx.ref) : undefined;
  const example = media.example ?? (resolved !== undefined ? synthesizeExample(resolved) : '');
  return { ...defaultBody(), type: 'raw', raw: typeof example === 'string' ? example : JSON.stringify(example, null, 2) };
}

// ---------- Per-operation request builder (shared by both versions) ----------

function buildRequestFromOperation(
  path: string,
  method: HttpMethod,
  operation: OasOperation,
  sharedParams: OasParameter[],
  doc: OasDocument,
  ctx: ImportCtx,
): BuiltOperation {
  const mergedParams = mergeParams(sharedParams, resolveParamsArray(operation.parameters, doc, ctx));
  const rewrittenPath = rewritePathTemplate(path, ctx);
  const url = `{{base_url}}${rewrittenPath}`;

  const pathVariables = mergedParams
    .filter((p) => p.in === 'path' && p.name)
    .map((p) => emptyKeyValue({ key: p.name as string, description: p.description ?? '' }));

  const params = [
    ...mergedParams
      .filter((p) => p.in === 'query' && p.name)
      .map((p) => emptyKeyValue({ key: p.name as string, description: p.description ?? '' })),
    emptyKeyValue(),
  ];

  const headerParams = mergedParams.filter((p) => (p.in === 'header' || p.in === 'cookie') && p.name);
  for (const p of headerParams) {
    if (p.in === 'cookie') {
      ctx.warnings.push(`Parameter "${p.name}" (in: cookie) on ${method} ${path} has no ApiTab target, mapped to a header.`);
    }
  }
  const headers = [
    ...headerParams.map((p) => emptyKeyValue({ key: p.name as string, description: p.description ?? '' })),
    emptyKeyValue(),
  ];

  const auth = resolveAuthForOperation(path, method, operation, doc, ctx);
  const body = ctx.version === 'swagger2'
    ? extractSwagger2Body(operation, mergedParams, doc as Swagger2Document, ctx)
    : extractOas3Body(operation, doc as Oas3Document, ctx);

  const name = operation.summary || operation.operationId || `${method} ${path}`;

  const request = createRequest({ name, method, url, params, pathVariables, headers, auth, body, scripts: defaultScripts() });

  return { request, folderTag: operation.tags?.[0] ?? null };
}

// ---------- Path walking ----------

function importPaths(doc: OasDocument, version: OasVersion): { built: BuiltOperation[]; warnings: string[] } {
  const warnings: string[] = [];
  const ctx: ImportCtx = { version, ref: createRefResolutionCtx(warnings), warnings };
  const built: BuiltOperation[] = [];

  for (const [path, pathItemRaw] of Object.entries(doc.paths ?? {})) {
    if (isRecord(pathItemRaw) && typeof pathItemRaw.$ref === 'string') {
      // Path-item-level $ref indirection — not attempted, only inline path items are supported.
      warnings.push(`Path "${path}" is defined via $ref to a separate path item — not supported, skipped.`);
      continue;
    }
    const pathItem = pathItemRaw as OasPathItem;
    const sharedParams = resolveParamsArray(pathItem.parameters, doc, ctx);

    for (const verb of VERB_KEYS) {
      const operation = pathItem[verb];
      if (!operation) continue;
      const method = verb.toUpperCase();
      if (!(HTTP_METHODS as string[]).includes(method)) {
        warnings.push(`Skipped ${method} ${path}: unsupported HTTP method.`);
        continue;
      }
      built.push(buildRequestFromOperation(path, method as HttpMethod, operation, sharedParams, doc, ctx));
    }
  }

  return { built, warnings };
}

// ---------- Tag grouping ----------

/**
 * First tag wins, one folder per distinct tag, exactly one level deep
 * (OpenAPI tags are flat strings, not nested paths — no recursion needed).
 * Untagged operations land at the collection root.
 */
function groupByTag(built: BuiltOperation[]): { folders: CollectionFolder[]; requests: ApiRequest[] } {
  const folderByTag = new Map<string, CollectionFolder>();
  const requests: ApiRequest[] = [];
  for (const { request, folderTag } of built) {
    if (!folderTag) {
      requests.push(request);
      continue;
    }
    let folder = folderByTag.get(folderTag);
    if (!folder) {
      folder = { id: uuid(), name: folderTag, folders: [], requests: [] };
      folderByTag.set(folderTag, folder);
    }
    folder.requests.push(request);
  }
  return { folders: [...folderByTag.values()], requests };
}

// ---------- Base URL ----------

function swagger2BaseUrl(doc: Swagger2Document): string | undefined {
  if (!doc.host) return undefined;
  const scheme = doc.schemes?.[0] ?? 'https';
  return `${scheme}://${doc.host}${doc.basePath ?? ''}`;
}

/**
 * Only the document-level `servers[0].url` is ever used — OAS3's
 * per-path/per-operation `servers` overrides are an explicit, deliberate
 * limitation: warning on every operation that merely *has* a `servers`
 * array (extremely common in real specs) would drown out warnings that
 * actually matter.
 */
function oas3BaseUrl(doc: Oas3Document): string | undefined {
  const url = doc.servers?.[0]?.url;
  return url && url.trim() !== '' ? url : undefined;
}

// ---------- Entry point ----------

export interface OpenApiParseResult {
  ok: boolean;
  data?: CollectionExport;
  error?: string;
  warnings?: string[];
}

export function parseOpenApiFile(raw: string): OpenApiParseResult {
  const parsed = parseJsonOrYaml(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const doc = parsed.value;
  if (!isRecord(doc)) return { ok: false, error: 'Not a recognized OpenAPI or Swagger document.' };

  const isSwagger2 = doc.swagger === '2.0';
  const isOas3 = typeof doc.openapi === 'string' && doc.openapi.startsWith('3.');
  if (!isSwagger2 && !isOas3) {
    return { ok: false, error: 'Not a recognized OpenAPI or Swagger document (missing "openapi"/"swagger" field).' };
  }

  const paths = doc.paths;
  if (!isRecord(paths) || Object.keys(paths).length === 0) {
    return { ok: false, error: 'This OpenAPI document has no paths to import.' };
  }

  const typedDoc = doc as unknown as OasDocument;
  const { built, warnings } = importPaths(typedDoc, isSwagger2 ? 'swagger2' : 'oas3');
  const { folders, requests } = groupByTag(built);

  const now = Date.now();
  const title = isRecord(doc.info) && typeof doc.info.title === 'string' ? doc.info.title : undefined;
  const baseUrl = isSwagger2 ? swagger2BaseUrl(typedDoc as Swagger2Document) : oas3BaseUrl(typedDoc as Oas3Document);

  const data: CollectionExport = {
    app: 'apitab',
    type: 'collection',
    version: COLLECTION_EXPORT_VERSION,
    exportedAt: now,
    item: { id: uuid(), name: title || 'Imported API', folders, requests, createdAt: now, updatedAt: now },
    ...(baseUrl ? { environmentVariables: [{ key: 'base_url', value: baseUrl }] } : {}),
  };

  return { ok: true, data, ...(warnings.length ? { warnings } : {}) };
}
