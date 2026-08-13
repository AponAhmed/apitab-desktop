import { ChevronRight } from 'lucide-react';
import { MethodBadge, StatusBadge } from '@/components/ui/Badge';
import { formatDuration, formatTimestamp } from '@/utils/format';
import { LOG_COLOR } from '@/utils/consoleLog';
import { cn } from '@/utils/cn';
import { ConsoleEntryDetail } from './ConsoleEntryDetail';
import type { ConsoleEntry } from '@/types';

export function ConsoleEntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: ConsoleEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/70"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-90')}
        />
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', LOG_COLOR[entry.level].replaceAll('text-', 'bg-'))}
        />
        <span className="w-16 shrink-0 text-right">
          <MethodBadge method={entry.method} className="text-[10px]" />
        </span>
        {entry.response ? (
          <StatusBadge status={entry.response.status} />
        ) : (
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
            {entry.error?.type ?? 'error'}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
          {entry.prepared.url}
        </span>
        {entry.response && (
          <span className="shrink-0 text-[11px] text-slate-400">{formatDuration(entry.response.timeMs)}</span>
        )}
        <span className="shrink-0 text-[11px] text-slate-400" title={formatTimestamp(entry.timestamp)}>
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </button>
      {expanded && <ConsoleEntryDetail entry={entry} />}
    </div>
  );
}
