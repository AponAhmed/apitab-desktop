import { create } from 'zustand';
import { uuid } from '@/utils/id';
import { byteLength } from '@/utils/format';
import type {
  ConsoleEntry,
  ConsoleLogLevel,
  ConsoleScriptLog,
  HttpMethod,
  PreparedRequest,
  ApiResponse,
  ApiError,
  ScriptRunResult,
} from '@/types';

export const CONSOLE_ENTRY_LIMIT = 200;
// Console entries store request/response bodies inline (unlike history, which
// only ever holds one small snapshot per request) — cap each body's stored
// size so one huge response can't bloat the whole in-memory buffer.
export const CONSOLE_BODY_TRUNCATE_BYTES = 100_000;

function truncate(body: string | null | undefined): { body: string | null; truncated: boolean } {
  if (!body || byteLength(body) <= CONSOLE_BODY_TRUNCATE_BYTES) {
    return { body: body ?? null, truncated: false };
  }
  // The slice point itself doesn't need to be byte-exact (this is a display
  // cap, not a wire-format concern) — slicing by character count after
  // confirming the real byte length is over the cap is safe, since a
  // character-count slice is always <= the equivalent byte count.
  return { body: body.slice(0, CONSOLE_BODY_TRUNCATE_BYTES), truncated: true };
}

const LEVEL_ORDER: ConsoleLogLevel[] = ['error', 'warn', 'info', 'log'];

function entryLevel(scriptLogs: ConsoleScriptLog[], hasError: boolean): ConsoleLogLevel {
  if (hasError) return 'error';
  for (const lvl of LEVEL_ORDER) {
    if (scriptLogs.some((l) => l.level === lvl)) return lvl;
  }
  return 'log';
}

interface BuildConsoleEntryInput {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  prepared: PreparedRequest;
  resolved: boolean;
  response: ApiResponse | null;
  error: ApiError | null;
  scriptRun: ScriptRunResult | null;
}

/** Builds a ConsoleEntry from the same prepared/result/scriptRun values requestStore.ts's send() already computes. */
export function buildConsoleEntry(input: BuildConsoleEntryInput): ConsoleEntry {
  const scriptLogs: ConsoleScriptLog[] = [
    ...(input.scriptRun?.pre?.logs.map((l) => ({ ...l, phase: 'pre' as const })) ?? []),
    ...(input.scriptRun?.post?.logs.map((l) => ({ ...l, phase: 'post' as const })) ?? []),
  ];

  const reqBody = truncate(input.prepared.body);
  const resBody = truncate(input.response?.body);

  const hasError = Boolean(input.error || input.scriptRun?.pre?.error || input.scriptRun?.post?.error);

  return {
    id: uuid(),
    requestId: input.requestId,
    requestName: input.requestName,
    method: input.method,
    prepared: { ...input.prepared, body: reqBody.body },
    resolved: input.resolved,
    timestamp: Date.now(),
    response: input.response ? { ...input.response, body: resBody.body ?? '' } : null,
    error: input.error,
    scriptLogs,
    level: entryLevel(scriptLogs, hasError),
    requestBodyTruncated: reqBody.truncated,
    responseBodyTruncated: resBody.truncated,
  };
}

interface ConsoleState {
  entries: ConsoleEntry[];
  levelFilter: ConsoleLogLevel | 'all';
  requestFilter: string | 'all';
  addEntry: (entry: ConsoleEntry) => void;
  clear: () => void;
  setLevelFilter: (level: ConsoleLogLevel | 'all') => void;
  setRequestFilter: (requestId: string | 'all') => void;
}

// Deliberately no `persist` middleware — a debug console log is ephemeral,
// session-scoped state (same convention as dialogStore/toastStore), not
// meant to survive a restart. This also sidesteps browser.storage.local's
// quota entirely on the extension side, since nothing here is ever written
// to disk.
export const useConsoleStore = create<ConsoleState>()((set) => ({
  entries: [],
  levelFilter: 'all',
  requestFilter: 'all',
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries].slice(0, CONSOLE_ENTRY_LIMIT) })),
  clear: () => set({ entries: [] }),
  setLevelFilter: (levelFilter) => set({ levelFilter }),
  setRequestFilter: (requestFilter) => set({ requestFilter }),
}));
