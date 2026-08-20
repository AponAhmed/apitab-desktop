import { Agent, setGlobalDispatcher } from 'undici';
import type { ApiError, PreparedRequest, RequestResult, ResponseHeader } from '@shared/types';

// Node's fetch (undici) defaults to a ~4s keep-alive timeout on pooled
// connections — shorter than the gap between two manually-clicked "Send"s
// in normal use, so every request was paying a full DNS+TCP+TLS handshake
// (measured 400-600ms+ to a typical HTTPS API) instead of reusing the
// connection from the previous request (measured ~60-90ms warm), the actual
// cause of ApiTab feeling slower than tools like Postman that keep
// connections alive longer. Widening the pool's timeout — once, for the
// whole process — fixes every request through `fetch()` below, not just
// this module's own calls.
setGlobalDispatcher(new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 120_000 }));

// A separate dispatcher, not the global one — TLS verification stays on for
// every request by default, and only opts out per-request when the caller
// explicitly asks (Settings > Requests > "Ignore SSL certificate errors").
// Created lazily since most users never touch the setting.
let insecureDispatcher: Agent | undefined;
function getInsecureDispatcher(): Agent {
  insecureDispatcher ??= new Agent({
    keepAliveTimeout: 60_000,
    keepAliveMaxTimeout: 120_000,
    connect: { rejectUnauthorized: false },
  });
  return insecureDispatcher;
}

// Node surfaces a self-signed/untrusted-chain cert as this exact set of
// system error codes — common for local dev (e.g. a Docker Compose HTTPS
// service with a self-signed or mkcert-issued certificate the OS doesn't
// trust). Recognized here purely to point the user at the fix instead of
// leaving them to guess from a raw OpenSSL code.
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function classifyError(err: unknown): ApiError {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out.' };
  }
  if (err instanceof TypeError) {
    // Node's fetch (undici) wraps the real reason in `.cause` — usually a
    // system error with a `.code` (ECONNRESET, ECONNREFUSED, CERT_*, etc.).
    // Surfacing it is the difference between a dead end and an actionable
    // error; the generic fallback only fires when Node gives us nothing.
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    const detail = cause?.code ?? cause?.message ?? (err.message !== 'fetch failed' ? err.message : undefined);
    const hint =
      cause?.code && TLS_ERROR_CODES.has(cause.code)
        ? ' — for local development against a self-signed certificate, enable Settings > Requests > "Ignore SSL certificate errors".'
        : '';
    return {
      type: 'network',
      message: detail
        ? `Network error: ${detail}${hint}`
        : 'Network error — the host may be unreachable or the DNS lookup failed.',
    };
  }
  return { type: 'unknown', message: (err as Error)?.message ?? 'Unknown error' };
}

/**
 * Executes a fully-prepared HTTP request in the main process using Node's
 * built-in `fetch`. Unlike the extension (which relies on the background
 * service worker + host permissions to bypass page CORS), a desktop main
 * process has no CORS restriction to begin with — this is a plain HTTP
 * client, no extra permissions or workarounds needed.
 */
export async function executeRequest(req: PreparedRequest): Promise<RequestResult> {
  if (!/^https?:\/\//i.test(req.url)) {
    return {
      ok: false,
      error: {
        type: 'invalid-url',
        message: req.url
          ? `Invalid URL: "${req.url}". URLs must start with http:// or https://`
          : 'URL is required.',
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  const start = performance.now();

  try {
    const headers = new Headers();
    for (const [key, value] of req.headers) {
      if (key) headers.append(key, value);
    }

    let body: BodyInit | undefined;
    const methodAllowsBody = req.method !== 'GET' && req.method !== 'HEAD';
    if (methodAllowsBody) {
      if (req.bodyType === 'form-data' && req.formData?.length) {
        const fd = new FormData();
        for (const f of req.formData) {
          if (!f.key) continue;
          if (f.fileData) {
            fd.append(f.key, new Blob([Buffer.from(f.fileData, 'base64')], { type: f.fileType || 'application/octet-stream' }), f.fileName || 'file');
          } else {
            fd.append(f.key, f.value);
          }
        }
        body = fd;
        // Let fetch set the multipart boundary.
        headers.delete('content-type');
      } else if (req.bodyType === 'binary' && req.binary) {
        // A Blob body's own `type` becomes the Content-Type header
        // automatically per the fetch spec, but only when the caller hasn't
        // already set one — an explicit header (set below) still wins.
        body = new Blob([Buffer.from(req.binary.fileData, 'base64')], { type: req.binary.fileType || 'application/octet-stream' });
      } else if (req.body) {
        body = req.body;
      }
    }

    const res = await fetch(req.url, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'follow',
      // `dispatcher` is undici's own fetch extension (not in the standard
      // RequestInit type), hence the cast — only set at all when the
      // request actually asked for it, so every other request still goes
      // through the real global (verifying) dispatcher.
      ...(req.ignoreTlsErrors ? { dispatcher: getInsecureDispatcher() } : {}),
    } as RequestInit);

    const buffer = await res.arrayBuffer();
    const timeMs = performance.now() - start;
    const text = new TextDecoder('utf-8').decode(buffer);

    const responseHeaders: ResponseHeader[] = [];
    res.headers.forEach((value, key) => responseHeaders.push({ key, value }));

    return {
      ok: true,
      response: {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: responseHeaders,
        body: text,
        contentType: res.headers.get('content-type') ?? '',
        timeMs,
        sizeBytes: buffer.byteLength,
        redirected: res.redirected,
        finalUrl: res.url,
      },
    };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  } finally {
    clearTimeout(timer);
  }
}
