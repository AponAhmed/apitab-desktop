import { createRequest, defaultAuth, defaultBody, emptyKeyValue } from './defaults';
import { formatJson, looksLikeJson } from './json';
import { paramsFromUrl, urlWithParams } from './query';
import type {
  ApiRequest,
  AuthConfig,
  HttpMethod,
  KeyValue,
  PreparedRequest,
} from '@/types';
import { HTTP_METHODS } from '@/types';

/* ------------------------------------------------------------------ */
/* Export: PreparedRequest -> cURL                                     */
/* ------------------------------------------------------------------ */

function shellQuote(value: string): string {
  // Single-quote and escape embedded single quotes the POSIX-safe way.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface BuildCurlOptions {
  /** Break each flag onto its own line with `\` continuations (default true). */
  multiline?: boolean;
}

export function buildCurl(req: PreparedRequest, options: BuildCurlOptions = {}): string {
  const multiline = options.multiline ?? true;
  const sep = multiline ? ' \\\n  ' : ' ';
  const parts: string[] = [];

  let head = 'curl';
  if (req.method !== 'GET') head += ` -X ${req.method}`;
  head += ` ${shellQuote(req.url || '')}`;
  parts.push(head);

  for (const h of req.headers) {
    if (!h.key) continue;
    parts.push(`-H ${shellQuote(`${h.key}: ${h.value}`)}`);
  }

  if (req.bodyType === 'form-data' && req.formData?.length) {
    for (const f of req.formData) {
      if (!f.key) continue;
      parts.push(`-F ${shellQuote(`${f.key}=${f.value}`)}`);
    }
  } else if (req.body) {
    parts.push(`--data ${shellQuote(req.body)}`);
  }

  return parts.join(sep);
}

/* ------------------------------------------------------------------ */
/* Import: cURL string -> ApiRequest                                   */
/* ------------------------------------------------------------------ */

/** Splits a command line into argv, honoring quotes and `\` continuations. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    if (c === '\\') {
      const next = input[i + 1];
      if (next === '\n') { i += 2; continue; }
      if (next === '\r' && input[i + 2] === '\n') { i += 3; continue; }
      cur += next ?? '';
      has = true;
      i += 2;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      has = true;
      i++;
      while (i < n && input[i] !== quote) {
        if (quote === '"' && input[i] === '\\' && /["\\$`]/.test(input[i + 1] ?? '')) {
          cur += input[i + 1];
          i += 2;
        } else {
          cur += input[i];
          i++;
        }
      }
      i++; // closing quote
      continue;
    }

    if (/\s/.test(c)) {
      if (has) { tokens.push(cur); cur = ''; has = false; }
      i++;
      continue;
    }

    cur += c;
    has = true;
    i++;
  }

  if (has) tokens.push(cur);
  return tokens;
}

function splitFlagValue(token: string): [string, string | null] {
  // Supports `--data=foo` and `-Hfoo` (short flag with attached value).
  if (token.startsWith('--')) {
    const eq = token.indexOf('=');
    if (eq !== -1) return [token.slice(0, eq), token.slice(eq + 1)];
    return [token, null];
  }
  if (token.startsWith('-') && token.length > 2) {
    return [token.slice(0, 2), token.slice(2)];
  }
  return [token, null];
}

function findHeader(headers: KeyValue[], name: string): KeyValue | undefined {
  return headers.find((h) => h.key.toLowerCase() === name.toLowerCase());
}

function decodeBasic(token: string): { username: string; password: string } {
  try {
    const decoded = atob(token);
    const idx = decoded.indexOf(':');
    return idx === -1
      ? { username: decoded, password: '' }
      : { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return { username: '', password: '' };
  }
}

export interface ParseCurlResult {
  ok: boolean;
  request?: ApiRequest;
  error?: string;
}

export function parseCurl(input: string): ParseCurlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Empty input' };
  if (!/^\s*curl\b/i.test(trimmed)) {
    return { ok: false, error: 'Command must start with "curl"' };
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() === 'curl') tokens.shift();

  let method: HttpMethod | null = null;
  let url = '';
  const headers: KeyValue[] = [];
  const dataParts: string[] = [];
  const formFields: KeyValue[] = [];
  let auth: AuthConfig = defaultAuth();
  let useGet = false;
  let isUrlEncodedData = false;

  const takeValue = (
    tokensRef: string[],
    index: number,
    attached: string | null,
  ): [string, number] => {
    if (attached != null) return [attached, index];
    return [tokensRef[index + 1] ?? '', index + 1];
  };

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const [flag, attached] = splitFlagValue(raw);

    switch (flag) {
      case '-X':
      case '--request': {
        const [val, ni] = takeValue(tokens, i, attached);
        const upper = val.toUpperCase() as HttpMethod;
        if (HTTP_METHODS.includes(upper)) method = upper;
        i = ni;
        break;
      }
      case '-H':
      case '--header': {
        const [val, ni] = takeValue(tokens, i, attached);
        const idx = val.indexOf(':');
        if (idx !== -1) {
          const key = val.slice(0, idx).trim();
          const value = val.slice(idx + 1).trim();
          headers.push(emptyKeyValue({ key, value }));
        }
        i = ni;
        break;
      }
      case '-A':
      case '--user-agent': {
        const [val, ni] = takeValue(tokens, i, attached);
        headers.push(emptyKeyValue({ key: 'User-Agent', value: val }));
        i = ni;
        break;
      }
      case '-e':
      case '--referer': {
        const [val, ni] = takeValue(tokens, i, attached);
        headers.push(emptyKeyValue({ key: 'Referer', value: val }));
        i = ni;
        break;
      }
      case '-b':
      case '--cookie': {
        const [val, ni] = takeValue(tokens, i, attached);
        headers.push(emptyKeyValue({ key: 'Cookie', value: val }));
        i = ni;
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-ascii':
      case '--data-binary': {
        const [val, ni] = takeValue(tokens, i, attached);
        dataParts.push(val);
        i = ni;
        break;
      }
      case '--data-urlencode': {
        const [val, ni] = takeValue(tokens, i, attached);
        dataParts.push(val);
        isUrlEncodedData = true;
        i = ni;
        break;
      }
      case '--json': {
        const [val, ni] = takeValue(tokens, i, attached);
        dataParts.push(val);
        if (!findHeader(headers, 'content-type')) {
          headers.push(emptyKeyValue({ key: 'Content-Type', value: 'application/json' }));
        }
        i = ni;
        break;
      }
      case '-F':
      case '--form': {
        const [val, ni] = takeValue(tokens, i, attached);
        const idx = val.indexOf('=');
        const key = idx === -1 ? val : val.slice(0, idx);
        const value = idx === -1 ? '' : val.slice(idx + 1);
        formFields.push(emptyKeyValue({ key, value }));
        i = ni;
        break;
      }
      case '-u':
      case '--user': {
        const [val, ni] = takeValue(tokens, i, attached);
        const idx = val.indexOf(':');
        auth = {
          ...auth,
          type: 'basic',
          basic: {
            username: idx === -1 ? val : val.slice(0, idx),
            password: idx === -1 ? '' : val.slice(idx + 1),
          },
        };
        i = ni;
        break;
      }
      case '-G':
      case '--get':
        useGet = true;
        break;
      case '--url': {
        const [val, ni] = takeValue(tokens, i, attached);
        url = val;
        i = ni;
        break;
      }
      // Boolean flags we can safely ignore.
      case '-L':
      case '--location':
      case '-k':
      case '--insecure':
      case '-s':
      case '--silent':
      case '-S':
      case '--show-error':
      case '-i':
      case '--include':
      case '-v':
      case '--verbose':
      case '--compressed':
      case '-f':
      case '--fail':
        break;
      default: {
        if (!flag.startsWith('-') && flag) {
          if (!url) url = flag;
        }
        break;
      }
    }
  }

  if (!url) return { ok: false, error: 'No URL found in command' };

  // Map an Authorization header to the structured auth config.
  const authHeader = findHeader(headers, 'authorization');
  if (authHeader && auth.type === 'none') {
    const [scheme, ...rest] = authHeader.value.split(' ');
    const token = rest.join(' ').trim();
    if (/^bearer$/i.test(scheme)) {
      auth = { ...auth, type: 'bearer', bearer: { token } };
    } else if (/^basic$/i.test(scheme)) {
      auth = { ...auth, type: 'basic', basic: decodeBasic(token) };
    }
  }
  const headersWithoutAuth =
    auth.type !== 'none'
      ? headers.filter((h) => h.key.toLowerCase() !== 'authorization')
      : headers;

  const rawData = isUrlEncodedData ? dataParts.join('&') : dataParts.join('&');
  const hasBody = formFields.length > 0 || rawData.length > 0;

  // `-G` sends data as query parameters instead of a body.
  let params = paramsFromUrl(url);
  if (useGet && rawData) {
    for (const pair of rawData.split('&')) {
      const eq = pair.indexOf('=');
      params.push(
        emptyKeyValue({
          key: eq === -1 ? pair : pair.slice(0, eq),
          value: eq === -1 ? '' : pair.slice(eq + 1),
        }),
      );
    }
  }
  const finalUrl = params.length ? urlWithParams(url, params) : url;

  if (!method) method = hasBody && !useGet ? 'POST' : 'GET';

  const body = defaultBody();
  if (!useGet && hasBody) {
    if (formFields.length > 0) {
      body.type = 'form-data';
      body.formData = [...formFields, emptyKeyValue()];
    } else {
      const contentType = (findHeader(headers, 'content-type')?.value ?? '').toLowerCase();
      if (contentType.includes('application/json') || (!contentType && looksLikeJson(rawData))) {
        body.type = 'json';
        const pretty = formatJson(rawData);
        body.json = pretty.ok ? pretty.value : rawData;
      } else if (contentType.includes('application/x-www-form-urlencoded') || isUrlEncodedData) {
        body.type = 'form-urlencoded';
        body.formUrlEncoded = [
          ...rawData.split('&').filter(Boolean).map((pair) => {
            const eq = pair.indexOf('=');
            return emptyKeyValue({
              key: eq === -1 ? pair : decodeURIComponent(pair.slice(0, eq)),
              value: eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1)),
            });
          }),
          emptyKeyValue(),
        ];
      } else {
        body.type = 'raw';
        body.raw = rawData;
      }
    }
  }

  const request = createRequest({
    name: 'Imported from cURL',
    method,
    url: finalUrl,
    params: params.length ? [...params, emptyKeyValue()] : [emptyKeyValue()],
    headers: headersWithoutAuth.length ? [...headersWithoutAuth, emptyKeyValue()] : [emptyKeyValue()],
    auth,
    body,
  });

  return { ok: true, request };
}
