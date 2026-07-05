import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { cn } from '@/utils/cn';

interface VariablePopoverProps {
  name: string;
  x: number;
  y: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocusChange: (focused: boolean) => void;
}

/** Floating editor for a single `{{variable}}` shown on hover. */
export function VariablePopover({
  name,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
  onFocusChange,
}: VariablePopoverProps) {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const upsertVariable = useEnvironmentStore((s) => s.upsertVariable);
  const createEnvironment = useEnvironmentStore((s) => s.createEnvironment);
  const setActive = useEnvironmentStore((s) => s.setActiveEnvironment);

  const activeEnv = environments.find((e) => e.id === activeId) ?? null;
  const existing = activeEnv?.variables.find((v) => v.key.trim() === name && v.key.trim() !== '');
  // Other environments that define this variable (for a helpful hint).
  const otherEnv = environments.find(
    (e) => e.id !== activeId && e.variables.some((v) => v.key.trim() === name && v.value !== ''),
  );

  const [draft, setDraft] = useState(existing?.value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(existing?.value ?? '');
  }, [name, activeId, existing?.value]);

  const commit = (val: string) => {
    setDraft(val);
    if (activeEnv) upsertVariable(activeEnv.id, name, val);
  };

  const createAndSet = () => {
    const env = createEnvironment('Development');
    setActive(env.id);
    upsertVariable(env.id, name, draft);
    inputRef.current?.focus();
  };

  return createPortal(
    <div
      style={{ position: 'fixed', left: x, top: y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => e.stopPropagation()}
      className="z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <code className="truncate font-mono text-xs font-semibold text-brand-600 dark:text-brand-300">
          {`{{${name}}}`}
        </code>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            existing
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          )}
        >
          {existing ? 'set' : 'unset'}
        </span>
      </div>

      {activeEnv ? (
        <>
          <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Globe className="h-3 w-3" />
            {activeEnv.name}
          </label>
          <input
            ref={inputRef}
            value={draft}
            placeholder="value"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => commit(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          {!existing && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Typing a value adds it to <span className="font-medium">{activeEnv.name}</span>.
            </p>
          )}
        </>
      ) : (
        <>
          <input
            ref={inputRef}
            value={draft}
            placeholder="value"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={createAndSet}
            className="mt-2 w-full rounded-md bg-brand-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            Create “Development” &amp; save
          </button>
        </>
      )}

      {otherEnv && !existing && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Defined in <span className="font-medium">{otherEnv.name}</span>.
        </p>
      )}
    </div>,
    document.body,
  );
}
