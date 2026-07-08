/** Resolves a dot-separated path (e.g. `data.0.content_type.name`) against a parsed JSON value. */
export function getByPath(value: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return value;
  return trimmed.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) {
      const index = Number(key);
      return Number.isInteger(index) ? acc[index] : undefined;
    }
    if (typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, value);
}
