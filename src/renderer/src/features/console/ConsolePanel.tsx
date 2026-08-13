import { useMemo, useState } from 'react';
import { Terminal, X } from 'lucide-react';
import { useConsoleStore } from '@/stores/consoleStore';
import { useUiStore } from '@/stores/uiStore';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ConsoleEntryRow } from './ConsoleEntryRow';
import type { ConsoleLogLevel } from '@/types';

const LEVELS: ConsoleLogLevel[] = ['log', 'info', 'warn', 'error'];

export function ConsolePanel() {
  const entries = useConsoleStore((s) => s.entries);
  const levelFilter = useConsoleStore((s) => s.levelFilter);
  const requestFilter = useConsoleStore((s) => s.requestFilter);
  const setLevelFilter = useConsoleStore((s) => s.setLevelFilter);
  const setRequestFilter = useConsoleStore((s) => s.setRequestFilter);
  const clear = useConsoleStore((s) => s.clear);
  const toggleConsole = useUiStore((s) => s.toggleConsole);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [clearOpen, setClearOpen] = useState(false);

  const requestOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) if (!seen.has(e.requestId)) seen.set(e.requestId, e.requestName);
    return Array.from(seen.entries());
  }, [entries]);

  const filtered = entries.filter(
    (e) =>
      (levelFilter === 'all' || e.level === levelFilter) &&
      (requestFilter === 'all' || e.requestId === requestFilter),
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
        <Terminal className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Console · {filtered.length}/{entries.length}
        </span>

        <div className="flex-1" />

        <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as ConsoleLogLevel | 'all')} className="h-7 text-xs">
          <option value="all">All levels</option>
          {LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl[0].toUpperCase() + lvl.slice(1)}
            </option>
          ))}
        </Select>

        <Select
          value={requestFilter}
          onChange={(e) => setRequestFilter(e.target.value)}
          className="h-7 max-w-[180px] text-xs"
        >
          <option value="all">All requests</option>
          {requestOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name || 'Untitled'}
            </option>
          ))}
        </Select>

        <Button size="sm" variant="ghost" onClick={() => setClearOpen(true)} disabled={entries.length === 0}>
          Clear
        </Button>

        <IconButton size="sm" title="Close Console" aria-label="Close Console" onClick={toggleConsole}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title={entries.length === 0 ? 'No requests logged yet' : 'No entries match the current filters'}
            description={
              entries.length === 0 ? 'Send a request to see it logged here in real time.' : undefined
            }
          />
        ) : (
          filtered.map((e) => (
            <ConsoleEntryRow key={e.id} entry={e} expanded={expanded.has(e.id)} onToggle={() => toggleExpanded(e.id)} />
          ))
        )}
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear Console"
        message="Remove all console entries? This cannot be undone."
        confirmLabel="Clear"
        onConfirm={clear}
        onClose={() => setClearOpen(false)}
      />
    </div>
  );
}
