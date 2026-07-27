import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, FlaskConical, Play, Square, XCircle } from 'lucide-react';
import { useRunnerStore } from '@/stores/runnerStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MethodBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import type { RunnerRequestResult } from '@/services/collectionRunner';

function resultTests(result: RunnerRequestResult) {
  return [...(result.scriptRun?.pre?.tests ?? []), ...(result.scriptRun?.post?.tests ?? [])];
}

function ResultRow({ result, index }: { result: RunnerRequestResult; index: number }) {
  const [open, setOpen] = useState(false);
  const tests = resultTests(result);
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.length - passed;
  const hasDetail = tests.length > 0 || Boolean(result.error);

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
        <span className="w-10 shrink-0 text-right">
          <MethodBadge method={result.request.method} className="text-[10px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
          {result.request.name || result.request.url || 'Untitled'}
        </span>
        {result.error ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Error
          </span>
        ) : (
          <>
            {result.response && (
              <span className="text-[11px] text-slate-400">{result.response.status}</span>
            )}
            {tests.length > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium',
                  failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {failed > 0 ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {passed}/{tests.length}
              </span>
            )}
          </>
        )}
        <span className="w-8 shrink-0 text-right text-[10px] text-slate-400">#{index + 1}</span>
      </button>

      {open && hasDetail && (
        <div className="space-y-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
          {result.error && (
            <p className="font-mono text-[11px] text-red-600 dark:text-red-400">{result.error.message}</p>
          )}
          {tests.map((t, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px]">
              {t.passed ? (
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
              )}
              <div className="min-w-0">
                <span className="text-slate-600 dark:text-slate-300">{t.name}</span>
                {!t.passed && t.error && (
                  <p className="font-mono text-[10px] text-red-600 dark:text-red-400">{t.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RunnerPanel() {
  const open = useRunnerStore((s) => s.open);
  const containerName = useRunnerStore((s) => s.containerName);
  const pendingRequests = useRunnerStore((s) => s.pendingRequests);
  const results = useRunnerStore((s) => s.results);
  const summary = useRunnerStore((s) => s.summary);
  const isRunning = useRunnerStore((s) => s.isRunning);
  const recordHistory = useRunnerStore((s) => s.recordHistory);
  const setRecordHistory = useRunnerStore((s) => s.setRecordHistory);
  const start = useRunnerStore((s) => s.start);
  const stop = useRunnerStore((s) => s.stop);
  const close = useRunnerStore((s) => s.close);

  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);

  const hasStarted = results.length > 0 || isRunning || summary !== null;
  const totalTestsPassed = summary?.testsPassed ?? 0;
  const totalTestsFailed = summary?.testsFailed ?? 0;

  return (
    <Modal open={open} onClose={close} title={`Run — ${containerName ?? ''}`} className="max-w-lg">
      <div className="flex max-h-[70vh] flex-col gap-3">
        <div className="flex items-center gap-2">
          <select
            value={activeEnvId ?? ''}
            onChange={(e) => setActiveEnvironment(e.target.value || null)}
            disabled={isRunning}
            className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">No environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>

          {isRunning ? (
            <Button variant="danger" size="sm" onClick={stop}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={start} disabled={pendingRequests.length === 0}>
              <Play className="h-3.5 w-3.5" /> {hasStarted ? 'Run again' : 'Run'}
            </Button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={recordHistory}
            onChange={(e) => setRecordHistory(e.target.checked)}
            disabled={isRunning}
          />
          Save each request to History
        </label>

        {summary && (
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {totalTestsPassed} passed
            </span>
            {totalTestsFailed > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                {totalTestsFailed} failed
              </span>
            )}
            {summary.requestsFailed > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                {summary.requestsFailed} request error{summary.requestsFailed === 1 ? '' : 's'}
              </span>
            )}
            <span className="text-slate-400">
              {results.length}/{summary.total} requests
            </span>
          </div>
        )}
        {isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Spinner className="h-3.5 w-3.5" />
            Running… {results.length}/{pendingRequests.length}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-1 overflow-auto">
          {!hasStarted ? (
            <EmptyState
              icon={FlaskConical}
              title={`${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} ready`}
              description="Pick an environment above and click Run."
            />
          ) : (
            results.map((r, i) => <ResultRow key={i} result={r} index={i} />)
          )}
        </div>
      </div>
    </Modal>
  );
}
