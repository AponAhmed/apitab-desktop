export interface JsonResult {
  ok: boolean;
  value: string;
  error?: string;
}

/**
 * Strips `//` line comments from JSON text, so the body editor can accept
 * JSON annotated for readability while every consumer downstream (the
 * actual request sent over the wire, generated cURL/code snippets,
 * validation, beautify/minify) still sees plain, spec-compliant JSON.
 * String-literal aware — a `//` inside a quoted value (e.g. a URL) is left
 * alone, since a naive strip would corrupt it.
 */
export function stripJsonComments(text: string): string {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (ch === '\\' && i + 1 < text.length) {
        result += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/** Pretty-prints JSON text (comments are dropped, since JSON.stringify has no way to preserve them). Returns the original text on failure with an error. */
export function formatJson(text: string, indent = 2): JsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: '' };
  try {
    const parsed = JSON.parse(stripJsonComments(trimmed));
    return { ok: true, value: JSON.stringify(parsed, null, indent) };
  } catch (err) {
    return { ok: false, value: text, error: (err as Error).message };
  }
}

/** Minifies JSON text (comments are dropped). Returns the original text on failure. */
export function minifyJson(text: string): JsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: '' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(stripJsonComments(trimmed))) };
  } catch (err) {
    return { ok: false, value: text, error: (err as Error).message };
  }
}

export interface JsonValidation {
  valid: boolean;
  error?: string;
}

/** Validates that text is parseable JSON once `//` comments are stripped (empty is considered valid/no-op). */
export function validateJson(text: string): JsonValidation {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true };
  try {
    JSON.parse(stripJsonComments(trimmed));
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/** True when the text appears to be JSON (object/array/primitive). */
export function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const first = t[0];
  return (
    first === '{' ||
    first === '[' ||
    first === '"' ||
    /^-?\d/.test(t) ||
    t === 'true' ||
    t === 'false' ||
    t === 'null'
  );
}
