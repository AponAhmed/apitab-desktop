import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CopyButton } from './ui/CopyButton';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Same palette as utils/highlight.ts's flat (non-collapsible) fallback view —
// kept identical so switching between the two (e.g. on a parse failure)
// doesn't change how familiar the colors look.
const COLOR = {
  key: 'text-sky-700 dark:text-sky-300',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-amber-600 dark:text-amber-400',
  boolean: 'text-violet-600 dark:text-violet-400',
  null: 'text-rose-600 dark:text-rose-400',
  punct: 'text-slate-400 dark:text-slate-500',
};

function isContainer(v: unknown): v is Json[] | Record<string, Json> {
  return v !== null && typeof v === 'object';
}

/** Every object/array node's path, for "Collapse all". */
function collectContainerPaths(value: unknown, path: string, out: string[]): void {
  if (!isContainer(value)) return;
  out.push(path);
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectContainerPaths(v, `${path}[${i}]`, out));
  } else {
    for (const [k, v] of Object.entries(value)) collectContainerPaths(v, `${path}.${k}`, out);
  }
}

function Leaf({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className={COLOR.null}>null</span>;
  if (typeof value === 'boolean') return <span className={COLOR.boolean}>{String(value)}</span>;
  if (typeof value === 'number') return <span className={COLOR.number}>{value}</span>;
  return <span className={COLOR.string}>{JSON.stringify(value)}</span>;
}

function Node({
  value,
  path,
  collapsed,
  onToggle,
  isLast,
}: {
  value: unknown;
  path: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  isLast: boolean;
}) {
  if (!isContainer(value)) {
    return (
      <>
        <Leaf value={value as string | number | boolean | null} />
        {!isLast && <span className={COLOR.punct}>,</span>}
      </>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i): [string, unknown] => [String(i), v]) : Object.entries(value);
  const isCollapsed = collapsed.has(path);
  const openBrace = isArray ? '[' : '{';
  const closeBrace = isArray ? ']' : '}';

  if (entries.length === 0) {
    return (
      <>
        <span className={COLOR.punct}>
          {openBrace}
          {closeBrace}
        </span>
        {!isLast && <span className={COLOR.punct}>,</span>}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(path)}
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        className="mr-0.5 inline-flex h-3.5 w-3.5 items-center justify-center align-middle text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <span className={COLOR.punct}>{openBrace}</span>
      {isCollapsed ? (
        <>
          <span className="mx-1 text-[10.5px] italic text-slate-400 dark:text-slate-500">
            {entries.length} {isArray ? (entries.length === 1 ? 'item' : 'items') : entries.length === 1 ? 'key' : 'keys'}
          </span>
          <span className={COLOR.punct}>{closeBrace}</span>
          {!isLast && <span className={COLOR.punct}>,</span>}
        </>
      ) : (
        <>
          <div className="ml-2 border-l border-slate-200 pl-3 dark:border-slate-800">
            {entries.map(([k, v], i) => (
              <div key={k}>
                {!isArray && <span className={COLOR.key}>"{k}"</span>}
                {!isArray && <span className={COLOR.punct}>: </span>}
                <Node
                  value={v}
                  path={isArray ? `${path}[${k}]` : `${path}.${k}`}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  isLast={i === entries.length - 1}
                />
              </div>
            ))}
          </div>
          <div>
            <span className={COLOR.punct}>{closeBrace}</span>
            {!isLast && <span className={COLOR.punct}>,</span>}
          </div>
        </>
      )}
    </>
  );
}

/** Interactive, collapsible-per-node JSON viewer with Expand all / Collapse all. */
export function JsonTreeView({ value, className }: { value: unknown; className?: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allPaths = useMemo(() => {
    const out: string[] = [];
    collectContainerPaths(value, '$', out);
    return out;
  }, [value]);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div
      className={cn(
        'group relative h-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-end gap-1 border-b border-slate-200/70 bg-slate-50/90 px-2 py-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 dark:border-slate-800/70 dark:bg-slate-950/90">
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          disabled={collapsed.size === 0}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(allPaths))}
          disabled={collapsed.size === allPaths.length}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Collapse all
        </button>
        <CopyButton value={JSON.stringify(value, null, 2)} />
      </div>
      <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
        <Node value={value} path="$" collapsed={collapsed} onToggle={toggle} isLast />
      </pre>
    </div>
  );
}
