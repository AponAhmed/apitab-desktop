import type { ConsoleLog, ScriptContext, ScriptRun, TestResult } from '@/types';

/*
 * Pure script-execution engine (no DOM). Runs user pre-request / post-response
 * scripts against an `apitab` API modeled on Postman's `pm` (same shape:
 * environment, response, test, expect) so pasted Postman scripts still work.
 * `pm` remains available as an alias for that reason. Kept DOM-free so it can
 * be unit-tested and reused by the sandbox entrypoint.
 */

function fmt(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fmtLog(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  return ak.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string' || Array.isArray(v)) return (v as string).length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

/** A compact chai-style assertion object with `.not` and fluent chains. */
function createMatcher(actual: unknown, negate: boolean): Record<string, unknown> {
  const assert = (pass: boolean, msg: string) => {
    if (negate ? pass : !pass) {
      throw new Error(`expected ${fmt(actual)} ${negate ? 'not ' : ''}${msg}`);
    }
  };
  const m: Record<string, unknown> = {};
  const ret =
    (fn: (...args: never[]) => void) =>
    (...args: never[]) => {
      fn(...args);
      return m;
    };

  Object.assign(m, {
    equal: ret((e: unknown) => assert(actual === e, `to equal ${fmt(e)}`)),
    eql: ret((e: unknown) => assert(deepEqual(actual, e), `to deeply equal ${fmt(e)}`)),
    include: ret((e: unknown) =>
      assert(
        typeof actual === 'string'
          ? actual.includes(String(e))
          : Array.isArray(actual)
            ? actual.includes(e)
            : false,
        `to include ${fmt(e)}`,
      ),
    ),
    above: ret((n: number) => assert((actual as number) > n, `to be above ${n}`)),
    below: ret((n: number) => assert((actual as number) < n, `to be below ${n}`)),
    least: ret((n: number) => assert((actual as number) >= n, `to be at least ${n}`)),
    most: ret((n: number) => assert((actual as number) <= n, `to be at most ${n}`)),
    a: ret((t: string) => assert(typeof actual === t, `to be a ${t}`)),
    an: ret((t: string) => assert(typeof actual === t, `to be an ${t}`)),
    property: ret((k: string) =>
      assert(actual != null && k in Object(actual), `to have property ${fmt(k)}`),
    ),
    lengthOf: ret((n: number) =>
      assert(actual != null && (actual as { length: number }).length === n, `to have length ${n}`),
    ),
    status: ret((n: number) => {
      const s =
        actual && typeof actual === 'object' && 'code' in (actual as object)
          ? (actual as { code: number }).code
          : actual;
      assert(s === n, `to have status ${n}`);
    }),
    match: ret((re: RegExp) => assert(re.test(String(actual)), `to match ${re}`)),
  });

  const self = { get: () => m };
  Object.defineProperties(m, {
    to: self,
    be: self,
    been: self,
    is: self,
    have: self,
    has: self,
    with: self,
    that: self,
    and: self,
    of: self,
    not: { get: () => createMatcher(actual, !negate) },
    ok: { get: () => (assert(Boolean(actual), 'to be truthy'), m) },
    true: { get: () => (assert(actual === true, 'to be true'), m) },
    false: { get: () => (assert(actual === false, 'to be false'), m) },
    null: { get: () => (assert(actual === null, 'to be null'), m) },
    undefined: { get: () => (assert(actual === undefined, 'to be undefined'), m) },
    empty: { get: () => (assert(isEmpty(actual), 'to be empty'), m) },
    exist: { get: () => (assert(actual != null, 'to exist'), m) },
  });
  return m;
}

const expectImpl = (actual: unknown) => createMatcher(actual, false);

function makeResponse(r: NonNullable<ScriptContext['response']>) {
  const resp: Record<string, unknown> = {
    code: r.status,
    status: r.statusText,
    responseTime: r.timeMs,
    responseSize: r.sizeBytes,
    text: () => r.body,
    json: () => JSON.parse(r.body),
    headers: {
      get: (name: string) =>
        r.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value,
      all: () => r.headers,
    },
  };
  Object.defineProperty(resp, 'to', { get: () => createMatcher(resp, false) });
  return resp;
}

/** Executes a user script and returns tests, logs and environment updates. */
export function runUserScript(code: string, context: ScriptContext): ScriptRun {
  const logs: ConsoleLog[] = [];
  const tests: TestResult[] = [];
  const envUpdates: Record<string, string | null> = {};
  const env: Record<string, string> = { ...context.environment };

  const store = {
    get: (k: string) => env[k],
    set: (k: string, v: unknown) => {
      const s = v == null ? '' : String(v);
      env[k] = s;
      envUpdates[k] = s;
    },
    unset: (k: string) => {
      delete env[k];
      envUpdates[k] = null;
    },
    has: (k: string) => k in env,
    toObject: () => ({ ...env }),
  };

  const apitab = {
    environment: store,
    variables: store,
    globals: store,
    request: context.request,
    response: context.response ? makeResponse(context.response) : undefined,
    expect: expectImpl,
    test: (name: string, fn: () => void) => {
      try {
        fn();
        tests.push({ name, passed: true });
      } catch (err) {
        tests.push({ name, passed: false, error: (err as Error)?.message ?? String(err) });
      }
    },
  };

  const sandboxConsole = {
    log: (...a: unknown[]) => logs.push({ level: 'log', text: a.map(fmtLog).join(' ') }),
    info: (...a: unknown[]) => logs.push({ level: 'info', text: a.map(fmtLog).join(' ') }),
    warn: (...a: unknown[]) => logs.push({ level: 'warn', text: a.map(fmtLog).join(' ') }),
    error: (...a: unknown[]) => logs.push({ level: 'error', text: a.map(fmtLog).join(' ') }),
  };

  try {
    // `pm` is kept as an alias of `apitab` so scripts written for Postman
    // (or copy-pasted from there) keep working unchanged.
    const fn = new Function('apitab', 'pm', 'console', `"use strict";\n${code}`);
    fn(apitab, apitab, sandboxConsole);
  } catch (err) {
    return { tests, logs, envUpdates, error: (err as Error)?.message ?? String(err) };
  }
  return { tests, logs, envUpdates };
}
