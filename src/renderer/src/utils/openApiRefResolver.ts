/*
 * Generic, version-agnostic `$ref` resolution for OpenAPI/Swagger documents.
 * Only internal pointers ('#/components/schemas/Pet', '#/definitions/Pet')
 * are resolvable — this import flow only ever has the text of the single
 * file the user picked, no filesystem/network access to chase an external
 * ref into another file or URL.
 */

export interface RefResolutionCtx {
  /** Pointer strings currently being resolved — cycle guard (self-referential schemas, e.g. Node.children: Node[], are valid OpenAPI and must not infinite-loop). */
  inProgress: Set<string>;
  /** Shared with the caller's warnings accumulator — mutated in place. */
  warnings: string[];
}

export function createRefResolutionCtx(warnings: string[]): RefResolutionCtx {
  return { inProgress: new Set(), warnings };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves a single '#/a/b/c' pointer against the parsed document. Returns
 * undefined (never throws) if any segment is missing, or if `ref` isn't an
 * internal ('#/...') pointer.
 */
export function resolveRef(doc: unknown, ref: string): unknown | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const segments = ref
    .slice(2)
    .split('/')
    .map((s) => decodeURIComponent(s.replace(/~1/g, '/').replace(/~0/g, '~')));

  let current: unknown = doc;
  for (const segment of segments) {
    if (isRecord(current) && segment in current) {
      current = current[segment];
    } else if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
    } else {
      return undefined;
    }
  }
  return current;
}

const MAX_RESOLVE_DEPTH = 20;

/**
 * Recursively resolves every `$ref` found within `node`, returning a plain,
 * ref-free deep value. Internal refs are inlined (and themselves recursively
 * resolved); external refs (anything not starting with '#/') resolve to `{}`
 * plus one warning; a ref already in `ctx.inProgress` (self-referential
 * schema) resolves to `{}` without recursing further and does NOT warn — a
 * self-referential schema is valid OpenAPI, not a defect. `maxDepth` is
 * defense-in-depth against any mutually-referential chain shape the
 * inProgress Set doesn't directly short-circuit.
 */
export function resolveSchema(
  doc: unknown,
  node: unknown,
  ctx: RefResolutionCtx,
  depth = 0,
  maxDepth = MAX_RESOLVE_DEPTH,
): unknown {
  if (depth > maxDepth) return {};
  if (Array.isArray(node)) return node.map((item) => resolveSchema(doc, item, ctx, depth + 1, maxDepth));
  if (!isRecord(node)) return node;

  const ref = node.$ref;
  if (typeof ref === 'string') {
    if (!ref.startsWith('#/')) {
      ctx.warnings.push(`Unresolvable external $ref "${ref}" — only refs within the same file are supported, left blank.`);
      return {};
    }
    if (ctx.inProgress.has(ref)) return {};
    const resolved = resolveRef(doc, ref);
    if (resolved === undefined) {
      ctx.warnings.push(`$ref "${ref}" could not be found in this document — left blank.`);
      return {};
    }
    ctx.inProgress.add(ref);
    const result = resolveSchema(doc, resolved, ctx, depth + 1, maxDepth);
    ctx.inProgress.delete(ref);
    return result;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = resolveSchema(doc, value, ctx, depth + 1, maxDepth);
  }
  return out;
}
