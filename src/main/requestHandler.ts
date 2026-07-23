import type { ApiError, PreparedRequest, RequestResult, ResponseHeader } from '@shared/types';

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
    return {
      type: 'network',
      message: detail
        ? `Network error: ${detail}`
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
        for (const f of req.formData) if (f.key) fd.append(f.key, f.value);
        body = fd;
        // Let fetch set the multipart boundary.
        headers.delete('content-type');
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
    });

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
