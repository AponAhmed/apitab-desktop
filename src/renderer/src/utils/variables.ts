/**
 * Environment variable interpolation. Variables use the `{{name}}` syntax,
 * e.g. `{{base_url}}/users`.
 */

export const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export type VariableMap = Record<string, string>;

/** Replaces every `{{name}}` occurrence with its value (unknown names are kept). */
export function resolveString(input: string, vars: VariableMap): string {
  if (!input || input.indexOf('{{') === -1) return input;
  return input.replace(VARIABLE_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

/** Returns the distinct variable names referenced in the input. */
export function extractVariables(input: string): string[] {
  const names = new Set<string>();
  if (!input) return [];
  for (const m of input.matchAll(VARIABLE_PATTERN)) names.add(m[1]);
  return [...names];
}

/** Variable names referenced in the input that are missing from `vars`. */
export function findUnresolvedVariables(input: string, vars: VariableMap): string[] {
  return extractVariables(input).filter(
    (name) => !Object.prototype.hasOwnProperty.call(vars, name),
  );
}

export interface VarSegment {
  type: 'text' | 'var';
  /** Raw text (for `var`, includes the `{{ }}` braces). */
  value: string;
  /** Variable name (only for `var` segments). */
  name?: string;
  start: number;
  end: number;
}

/** Splits text into plain and `{{variable}}` segments for highlighting. */
export function tokenizeVariables(input: string): VarSegment[] {
  const segments: VarSegment[] = [];
  if (!input) return segments;
  let last = 0;
  for (const m of input.matchAll(VARIABLE_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      segments.push({ type: 'text', value: input.slice(last, idx), start: last, end: idx });
    }
    segments.push({ type: 'var', value: m[0], name: m[1], start: idx, end: idx + m[0].length });
    last = idx + m[0].length;
  }
  if (last < input.length) {
    segments.push({ type: 'text', value: input.slice(last), start: last, end: input.length });
  }
  return segments;
}

/** True when the text references at least one `{{variable}}`. */
export function hasVariables(input: string): boolean {
  return input.indexOf('{{') !== -1 && /\{\{\s*[\w.-]+\s*\}\}/.test(input);
}

export interface OpenVariableTrigger {
  /** Index (into `text`) where the triggering `{{` starts. */
  triggerStart: number;
  /** Partial variable name typed so far — the autocomplete filter query. */
  query: string;
}

/**
 * If the caret sits just after an unclosed `{{` (not yet followed by `}}`),
 * returns where that `{{` starts and the partial name typed so far. Returns
 * `null` when there's no nearby unclosed `{{`, it's already closed, or the
 * in-between text couldn't be a variable name (e.g. contains a space run
 * that isn't just leading whitespace).
 */
export function findOpenVariableTrigger(text: string, caret: number): OpenVariableTrigger | null {
  const CAP = 64; // variable names are short; cap the backward scan
  const from = Math.max(0, caret - CAP);
  const slice = text.slice(from, caret);
  const openIdx = slice.lastIndexOf('{{');
  if (openIdx === -1) return null;
  const between = slice.slice(openIdx + 2);
  if (between.includes('}}') || between.includes('{{')) return null;
  if (!/^\s*[\w.-]*$/.test(between)) return null;
  return { triggerStart: from + openIdx, query: between.trim() };
}
