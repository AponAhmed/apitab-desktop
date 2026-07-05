import { useState } from 'react';
import { History as HistoryIcon, Trash2 } from 'lucide-react';
import { useHistoryStore } from '@/stores/historyStore';
import { useRequestStore } from '@/stores/requestStore';
import { MethodBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatRelativeTime } from '@/utils/format';

export function HistoryPanel() {
  const entries = useHistoryStore((s) => s.entries);
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const clearAll = useHistoryStore((s) => s.clearAll);
  const loadRequest = useRequestStore((s) => s.loadRequest);
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {entries.length} request{entries.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setClearOpen(true)} disabled={entries.length === 0}>
          Clear all
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {entries.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No history yet"
            description="Requests you send are saved here automatically."
          />
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              onClick={() =>
                loadRequest(e.request, null, {
                  response: e.response ?? null,
                  error: e.error ?? null,
                  scriptRun: e.scriptRun ?? null,
                  sentAt: e.timestamp,
                })
              }
              className="group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/70"
            >
              <span className="w-10 shrink-0 text-right">
                <MethodBadge method={e.method} className="text-[10px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                  {e.url || 'Untitled'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatRelativeTime(e.timestamp)}
                  {e.status ? ` · ${e.status}` : ''}
                </p>
              </div>
              <IconButton
                size="sm"
                title="Delete"
                className="opacity-0 group-hover:opacity-100"
                onClick={(ev) => {
                  ev.stopPropagation();
                  deleteEntry(e.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </IconButton>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear History"
        message="Remove all history entries? This cannot be undone."
        confirmLabel="Clear"
        onConfirm={clearAll}
        onClose={() => setClearOpen(false)}
      />
    </div>
  );
}
