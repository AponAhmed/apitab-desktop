import { X } from 'lucide-react';
import { useStressTestStore } from '@/stores/stressTestStore';
import { MethodBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { STRESS_TEST_STATUS_CLASS, STRESS_TEST_STATUS_LABEL } from '@/utils/stressTestStats';
import { cn } from '@/utils/cn';

export function StressTestRunRow({ runId }: { runId: string }) {
  const run = useStressTestStore((s) => s.runs[runId]);
  const expandRun = useStressTestStore((s) => s.expandRun);
  const dismissRun = useStressTestStore((s) => s.dismissRun);

  if (!run) return null;
  const completed = Object.keys(run.results).length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => expandRun(runId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') expandRun(runId);
      }}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      <MethodBadge method={run.method} className="w-9 shrink-0 text-right text-[10px]" />
      <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
        {run.requestName}
      </span>
      {run.status === 'running' && <Spinner className="h-3 w-3 shrink-0 text-amber-500" />}
      <span className={cn('shrink-0 text-[11px] font-medium', STRESS_TEST_STATUS_CLASS[run.status])}>
        {STRESS_TEST_STATUS_LABEL[run.status]}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400">
        {completed}/{run.config.count}
      </span>
      <IconButton
        size="sm"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          dismissRun(runId);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
