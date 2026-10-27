import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { app, shell } from 'electron';

export interface LogEntryInput {
  source: 'main' | 'renderer';
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  /** Where this was caught from, e.g. 'uncaughtException', 'window.onerror', a React error boundary's component stack. */
  context?: string;
}

const RETAIN_DAYS = 3;
const FILENAME_RE = /^\d{4}-\d{2}-\d{2}\.log$/;

// The OS temp directory rather than userData: guaranteed writable by the
// current user on Windows (%TEMP%), macOS ($TMPDIR, typically under
// /var/folders) and Linux ($TMPDIR or /tmp) alike, by OS convention — no
// admin rights, no macOS TCC prompt (unlike Desktop/Documents/Downloads,
// temp dirs aren't permission-gated at all). A dedicated subfolder (not the
// bare temp root) keeps every day's file together and avoids colliding with
// anything else writing to the same shared directory.
function logsDir(): string {
  const dir = join(app.getPath('temp'), 'apitab-logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function todayFilename(): string {
  return `${new Date().toISOString().slice(0, 10)}.log`;
}

/**
 * Deletes every log file except the `RETAIN_DAYS` most recent. Filenames are
 * `YYYY-MM-DD.log`, which sorts chronologically as a plain string — no date
 * parsing needed. Run on every write rather than on a schedule: under normal
 * use a day produces very few entries, so this stays cheap and keeps the
 * folder self-cleaning without a separate timer to manage.
 */
function pruneOldLogs(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => FILENAME_RE.test(f))
    .sort();
  const stale = files.slice(0, Math.max(0, files.length - RETAIN_DAYS));
  for (const f of stale) {
    try {
      unlinkSync(join(dir, f));
    } catch {
      // Best-effort — a file already gone or locked shouldn't break logging.
    }
  }
}

function formatLine(entry: LogEntryInput): string {
  const header = `${new Date().toISOString()} [${entry.source}] [${entry.level}]${entry.context ? ` (${entry.context})` : ''} ${entry.message}\n`;
  const stack = entry.stack
    ? entry.stack
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n') + '\n'
    : '';
  return header + stack;
}

/**
 * Appends one line (plus an indented stack trace, if given) to today's log
 * file, creating the logs folder on first use. Deliberately synchronous
 * (`appendFileSync`) — this only ever fires on an actual error/warning, not
 * a hot path, so the simplicity of not juggling a promise outweighs the
 * (negligible, for a few-line append) blocking cost. Never throws: a logging
 * failure must not cascade into whatever error handler called this in the
 * first place. A write failure here should be rare — see logsDir()'s own
 * comment for why the temp directory was chosen specifically to avoid
 * permission issues — but if it ever happens, this fails into the main
 * process's own stderr instead of total silence, so logging-can't-log isn't
 * invisible to whoever's actually debugging it.
 */
export function logEntry(entry: LogEntryInput): void {
  try {
    const dir = logsDir();
    appendFileSync(join(dir, todayFilename()), formatLine(entry), 'utf-8');
    pruneOldLogs(dir);
  } catch (err) {
    console.error('[logger] failed to write log entry:', err);
  }
}

export function openLogsFolder(): Promise<string> {
  return shell.openPath(logsDir());
}
