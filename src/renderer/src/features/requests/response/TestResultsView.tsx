import { AlertTriangle, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { useRequestStore } from '@/stores/requestStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';
import type { ConsoleLog, ScriptRunResult, TestResult } from '@/types';

function collect(run: ScriptRunResult | null) {
  const tests: TestResult[] = [
    ...(run?.pre?.tests ?? []),
    ...(run?.post?.tests ?? []),
  ];
  const logs: ConsoleLog[] = [...(run?.pre?.logs ?? []), ...(run?.post?.logs ?? [])];
  const errors: string[] = [run?.pre?.error, run?.post?.error].filter(Boolean) as string[];
  return { tests, logs, errors };
}

const LOG_COLOR: Record<ConsoleLog['level'], string> = {
  log: 'text-slate-500 dark:text-slate-400',
  info: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
};

export function TestResultsView() {
  const scriptRun = useRequestStore((s) => s.scriptRun);
  const { tests, logs, errors } = collect(scriptRun);

  if (!scriptRun || (tests.length === 0 && logs.length === 0 && errors.length === 0)) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test results"
        description="Add a Post-response script (Scripts tab) with apitab.test(...) to see results here."
      />
    );
  }

  const passed = tests.filter((t) => t.passed).length;

  return (
    <div className="h-full space-y-3 overflow-auto pr-1">
      {tests.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {passed} passed
          </span>
          {tests.length - passed > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              {tests.length - passed} failed
            </span>
          )}
        </div>
      )}

      {errors.map((err, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Script error</p>
            <p className="font-mono">{err}</p>
          </div>
        </div>
      ))}

      {tests.length > 0 && (
        <ul className="space-y-1">
          {tests.map((t, i) => (
            <li
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                t.passed
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                  : 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20',
              )}
            >
              {t.passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <div className="min-w-0">
                <p className="text-slate-700 dark:text-slate-200">{t.name}</p>
                {!t.passed && t.error && (
                  <p className="font-mono text-[11px] text-red-600 dark:text-red-400">{t.error}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {logs.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Console
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950">
            {logs.map((l, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-words', LOG_COLOR[l.level])}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
