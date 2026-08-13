import type { ConsoleLog } from '@/types';

/** Shared between the response panel's Tests tab and the Debug Console panel. */
export const LOG_COLOR: Record<ConsoleLog['level'], string> = {
  log: 'text-slate-500 dark:text-slate-400',
  info: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
};
