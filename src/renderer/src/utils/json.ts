export interface JsonResult {
  ok: boolean;
  value: string;
  error?: string;
}

/** Pretty-prints JSON text. Returns the original text on failure with an error. */
export function formatJson(text: string, indent = 2): JsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: '' };
  try {
    const parsed = JSON.parse(trimmed);
    return { ok: true, value: JSON.stringify(parsed, null, indent) };
  } catch (err) {
    return { ok: false, value: text, error: (err as Error).message };
  }
}

/** Minifies JSON text. Returns the original text on failure. */
export function minifyJson(text: string): JsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: '' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(trimmed)) };
  } catch (err) {
    return { ok: false, value: text, error: (err as Error).message };
  }
}

export interface JsonValidation {
  valid: boolean;
  error?: string;
}

/** Validates that text is parseable JSON (empty is considered valid/no-op). */
export function validateJson(text: string): JsonValidation {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true };
  try {
    JSON.parse(trimmed);
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
