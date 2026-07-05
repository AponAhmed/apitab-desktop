import { emptyKeyValue } from './defaults';
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
