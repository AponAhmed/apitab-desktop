import { emptyKeyValue } from './defaults';
import { resolveString, type VariableMap } from './variables';
import type { KeyValue } from '@/types';

/**
 * Query-string helpers that are tolerant of `{{variables}}` (which make a URL
 * invalid for the native URL parser), so we parse/serialize manually.
 */

export interface SplitUrl {
  base: string;
  query: string;
  hash: string;
}

/** Splits a URL into its base, raw query and hash parts. */
export function splitUrl(url: string): SplitUrl {
  let rest = url;
  let hash = '';
  const hashIndex = rest.indexOf('#');
  if (hashIndex !== -1) {
    hash = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }
  const qIndex = rest.indexOf('?');
  if (qIndex === -1) return { base: rest, query: '', hash };
  return { base: rest.slice(0, qIndex), query: rest.slice(qIndex + 1), hash };
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function encode(value: string): string {
  // Keep template braces readable instead of percent-encoding them.
  return encodeURIComponent(value).replace(/%7B%7B/gi, '{{').replace(/%7D%7D/gi, '}}');
}

/** Parses a URL's query string into enabled key/value rows. */
export function paramsFromUrl(url: string): KeyValue[] {
  const { query } = splitUrl(url);
  if (!query) return [];
  return query.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    return emptyKeyValue({ key: decode(key), value: decode(value) });
  });
}

/** Serializes enabled, non-empty params into a query string. */
export function paramsToQuery(params: KeyValue[]): string {
  return params
    .filter((p) => p.enabled && p.key.trim() !== '')
    .map((p) => `${encode(p.key)}=${encode(p.value)}`)
    .join('&');
}

/** Rebuilds a URL, replacing its query string with the given params. */
export function urlWithParams(url: string, params: KeyValue[]): string {
  const { base, hash } = splitUrl(url);
  const query = paramsToQuery(params);
  return `${base}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

/** Matches a whole path segment like `:id` (not `://`, which never appears as its own segment). */
const PATH_VAR_SEGMENT = /^:([a-zA-Z_][a-zA-Z0-9_]*)$/;

/** Extracts distinct `:name` path segment names from a URL's base path, in first-seen order. */
export function pathVariableNamesFromUrl(url: string): string[] {
  const { base } = splitUrl(url);
  const names: string[] = [];
  for (const segment of base.split('/')) {
    const match = PATH_VAR_SEGMENT.exec(segment);
    if (match && !names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

export interface PathVariableRange {
  name: string;
  start: number;
  end: number;
}

/**
 * Locates `:name` path-variable segments with their character offsets into
 * the original (untouched) URL string — used to highlight them distinctly
 * from `{{variable}}` tokens in the URL bar. `base` is always a prefix of
 * `url` (splitUrl only truncates at `?`/`#`), so positions found within it
 * map 1:1 back onto `url`.
 */
export function findPathVariableRanges(url: string): PathVariableRange[] {
  const { base } = splitUrl(url);
  const ranges: PathVariableRange[] = [];
  let pos = 0;
  for (const segment of base.split('/')) {
    const match = PATH_VAR_SEGMENT.exec(segment);
    if (match) ranges.push({ name: match[1], start: pos, end: pos + segment.length });
    pos += segment.length + 1; // +1 for the '/' consumed by split
  }
  return ranges;
}

/**
 * Replaces `:name` path segments with their resolved values (enabled rows
 * only; a disabled or unmatched `:name` is left as literal text). Query
 * string and hash are passed through untouched.
 */
export function applyPathVariables(url: string, pathVariables: KeyValue[], vars: VariableMap): string {
  const valueByName = new Map(
    pathVariables.filter((v) => v.enabled && v.key.trim() !== '').map((v) => [v.key, v.value]),
  );
  if (valueByName.size === 0) return url;
  const { base, query, hash } = splitUrl(url);
  const newBase = base
    .split('/')
    .map((segment) => {
      const match = PATH_VAR_SEGMENT.exec(segment);
      if (!match) return segment;
      const value = valueByName.get(match[1]);
      return value !== undefined ? resolveString(value, vars) : segment;
    })
    .join('/');
  return `${newBase}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}
