import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Square, XCircle } from 'lucide-react';
import { useStressTestStore } from '@/stores/stressTestStore';
import {
  computeStressTestSummary,
  STRESS_TEST_STATUS_CLASS,
  STRESS_TEST_STATUS_LABEL,
} from '@/utils/stressTestStats';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';
import type { StressTestRequestResult } from '@/types';

function ResultRow({ result }: { result: StressTestRequestResult }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(result.error) || Boolean(result.body);

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 px-2 py-1.5 text-left',
          hasDetail && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50',
        )}
      >
        {hasDetail ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="w-14 shrink-0 text-[11px] text-slate-400">#{result.requestNumber}</span>
        {result.error ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Error
          </span>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{result.status}</span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-slate-400">
          {result.timeMs != null ? `${Math.round(result.timeMs)}ms` : ''}
        </span>
      </button>

      {open && hasDetail && (
        <div className="space-y-1.5 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
          {result.error && (
            <p className="font-mono text-[11px] text-red-600 dark:text-red-400">{result.error.message}</p>
          )}
          {result.body != null && (
            <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              {result.body}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1 text-center dark:bg-slate-800/60">
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

export function StressTestRunDetail({
  runId,
  onHeaderPointerDown,
}: {
  runId: string;
  /** Drag handle for the floating panel — applied only to the non-interactive part of the header, never the whole view (which contains real buttons). */
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}) {
  const run = useStressTestStore((s) => s.runs[runId]);
  const expandRun = useStressTestStore((s) => s.expandRun);
  const stopRun = useStressTestStore((s) => s.stopRun);

  const summary = useMemo(() => (run ? computeStressTestSummary(run) : null), [run]);

  if (!run || !summary) return null;

  const results = Object.values(run.results).sort((a, b) => a.requestNumber - b.requestNumber);
  const fmtMs = (v: number | null) => (v == null ? '—' : `${Math.round(v)}ms`);

  return (
    <div className="flex max-h-[70vh] w-80 flex-col">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-2 py-2 dark:border-slate-800">
        <IconButton size="sm" aria-label="Back" onClick={() => expandRun(null)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <span
          onPointerDown={onHeaderPointerDown}
          className="min-w-0 flex-1 cursor-move truncate text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          {run.requestName}
        </span>
        {run.status === 'running' ? (
          <Button variant="danger" size="sm" onClick={() => stopRun(runId)}>
            <Square className="h-3 w-3" /> Stop
          </Button>
        ) : (
          <span className={cn('shrink-0 text-[11px] font-medium', STRESS_TEST_STATUS_CLASS[run.status])}>
            {STRESS_TEST_STATUS_LABEL[run.status]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-2 py-2">
        <StatChip label="Completed" value={`${summary.completed}/${summary.total}`} />
        <StatChip label="Successful" value={String(summary.successful)} />
        <StatChip label="Failed" value={String(summary.failed)} />
        <StatChip label="Avg" value={fmtMs(summary.avgTimeMs)} />
        <StatChip label="Min" value={fmtMs(summary.minTimeMs)} />
        <StatChip label="Max" value={fmtMs(summary.maxTimeMs)} />
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
        <span className="text-[11px] text-slate-400">
          {summary.requestsPerSec != null ? `${summary.requestsPerSec.toFixed(1)} req/s` : ''}
        </span>
        {Object.entries(summary.statusCounts).map(([status, count]) => (
          <span
            key={status}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              status === 'error'
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {status}: {count}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-2">
        {results.length === 0 ? (
          <EmptyState title="Waiting for the first result…" />
        ) : (
          results.map((r) => <ResultRow key={r.requestNumber} result={r} />)
        )}
      </div>
    </div>
  );
}
