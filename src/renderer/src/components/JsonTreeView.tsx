import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';
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

/** Exact text a leaf value renders as — shared with the search indexer below so match offsets line up with what's on screen. */
function primitiveDisplay(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function countMatches(text: string, term: string): number {
  if (!term) return 0;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  let count = 0;
  let i = 0;
  for (;;) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) break;
    count += 1;
    i = idx + needle.length;
  }
  return count;
}

interface MatchEntry {
  /** This text's first match's index into the flat, render-order match list. */
  offset: number;
  count: number;
}

/**
 * Walks the tree in the same order Node renders it (key, then value, per
 * entry, depth-first) so each match's flat index lines up with visual
 * top-to-bottom order — that's what lets "3 / 12" and prev/next navigation
 * make sense. Also records which container paths must be forced open (even
 * if the user collapsed them) so an existing match doesn't hide from them.
 */
function buildMatchIndex(
  value: unknown,
  path: string,
  key: string | undefined,
  ancestorChain: string[],
  term: string,
  index: Map<string, MatchEntry>,
  counter: { current: number },
  forceExpand: Set<string>,
): void {
  if (key !== undefined) {
    const count = countMatches(key, term);
    if (count > 0) {
      index.set(`${path}#key`, { offset: counter.current, count });
      counter.current += count;
      ancestorChain.forEach((p) => forceExpand.add(p));
    }
  }

  if (!isContainer(value)) {
    const text = primitiveDisplay(value as string | number | boolean | null);
    const count = countMatches(text, term);
    if (count > 0) {
      index.set(`${path}#value`, { offset: counter.current, count });
      counter.current += count;
      ancestorChain.forEach((p) => forceExpand.add(p));
    }
    return;
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i): [string, unknown] => [String(i), v]) : Object.entries(value);
  const nextChain = [...ancestorChain, path];
  for (const [k, v] of entries) {
    const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
    buildMatchIndex(v, childPath, isArray ? undefined : k, nextChain, term, index, counter, forceExpand);
  }
}

/** Wraps every case-insensitive occurrence of `term` in `text` with a <mark>, tinting whichever one is `activeMatchIndex` differently. */
function HighlightedText({
  text,
  term,
  entry,
  activeMatchIndex,
}: {
  text: string;
  term: string;
  entry: MatchEntry | undefined;
  activeMatchIndex: number;
}) {
  if (!term || !entry) return <>{text}</>;

  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let matchNumber = 0;

  for (;;) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    const matchIndex = entry.offset + matchNumber;
    parts.push(
      <mark
        key={idx}
        data-match-index={matchIndex}
        className={cn(
          'rounded-sm',
          matchIndex === activeMatchIndex
            ? 'bg-orange-400 text-slate-900 dark:bg-orange-500 dark:text-slate-900'
            : 'bg-yellow-200 text-slate-900 dark:bg-yellow-500/40 dark:text-slate-100',
        )}
      >
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    matchNumber += 1;
    i = idx + term.length;
  }

  return <>{parts}</>;
}

function Leaf({
  value,
  path,
  search,
  matchIndex,
  activeMatchIndex,
}: {
  value: string | number | boolean | null;
  path: string;
  search: string;
  matchIndex: Map<string, MatchEntry>;
  activeMatchIndex: number;
}) {
  const text = primitiveDisplay(value);
  const colorClass =
    value === null ? COLOR.null : typeof value === 'boolean' ? COLOR.boolean : typeof value === 'number' ? COLOR.number : COLOR.string;

  return (
    <span className={colorClass}>
      <HighlightedText text={text} term={search} entry={matchIndex.get(`${path}#value`)} activeMatchIndex={activeMatchIndex} />
    </span>
  );
}

function Node({
  value,
  path,
  collapsed,
  onToggle,
  isLast,
  search,
  matchIndex,
  activeMatchIndex,
  forceExpand,
}: {
  value: unknown;
  path: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  isLast: boolean;
  search: string;
  matchIndex: Map<string, MatchEntry>;
  activeMatchIndex: number;
  forceExpand: Set<string>;
}) {
  if (!isContainer(value)) {
    return (
      <>
        <Leaf
          value={value as string | number | boolean | null}
          path={path}
          search={search}
          matchIndex={matchIndex}
          activeMatchIndex={activeMatchIndex}
        />
        {!isLast && <span className={COLOR.punct}>,</span>}
      </>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i): [string, unknown] => [String(i), v]) : Object.entries(value);
  // A match inside a manually-collapsed branch would otherwise be invisible
  // and unreachable by "next match" — force it open for the duration of the
  // search instead of fighting the user's own Expand/Collapse-all state.
  const isCollapsed = collapsed.has(path) && !(search && forceExpand.has(path));
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
            {entries.map(([k, v], i) => {
              const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
              return (
                <div key={k}>
                  {!isArray && (
                    <span className={COLOR.key}>
                      "
                      <HighlightedText
                        text={k}
                        term={search}
                        entry={matchIndex.get(`${childPath}#key`)}
                        activeMatchIndex={activeMatchIndex}
                      />
                      "
                    </span>
                  )}
                  {!isArray && <span className={COLOR.punct}>: </span>}
                  <Node
                    value={v}
                    path={childPath}
                    collapsed={collapsed}
                    onToggle={onToggle}
                    isLast={i === entries.length - 1}
                    search={search}
                    matchIndex={matchIndex}
                    activeMatchIndex={activeMatchIndex}
                    forceExpand={forceExpand}
                  />
                </div>
              );
            })}
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

/** Interactive, collapsible-per-node JSON viewer with Expand all / Collapse all and keyword search. */
export function JsonTreeView({ value, className }: { value: unknown; className?: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const allPaths = useMemo(() => {
    const out: string[] = [];
    collectContainerPaths(value, '$', out);
    return out;
  }, [value]);

  const { matchIndex, totalMatches, forceExpand } = useMemo(() => {
    const index = new Map<string, MatchEntry>();
    const forceExpandPaths = new Set<string>();
    if (search) {
      const counter = { current: 0 };
      buildMatchIndex(value, '$', undefined, [], search, index, counter, forceExpandPaths);
      return { matchIndex: index, totalMatches: counter.current, forceExpand: forceExpandPaths };
    }
    return { matchIndex: index, totalMatches: 0, forceExpand: forceExpandPaths };
  }, [value, search]);

  // New search term (or one that no longer matches) — snap back to the
  // first match instead of leaving the index pointed past the new total.
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [search, value]);

  useEffect(() => {
    if (!search || totalMatches === 0 || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-match-index="${activeMatchIndex}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [search, activeMatchIndex, totalMatches]);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function goToMatch(delta: number) {
    if (totalMatches === 0) return;
    setActiveMatchIndex((prev) => (prev + delta + totalMatches) % totalMatches);
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-slate-200/70 bg-slate-50/90 px-2 py-1 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/90">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              goToMatch(e.shiftKey ? -1 : 1);
            }}
            placeholder="Search JSON…"
            className="h-6 w-full rounded-md border border-slate-200 bg-white pl-7 pr-6 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {search && (
          <div className="flex shrink-0 items-center gap-0.5">
            <span className="px-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              {totalMatches === 0 ? '0 / 0' : `${activeMatchIndex + 1} / ${totalMatches}`}
            </span>
            <button
              type="button"
              onClick={() => goToMatch(-1)}
              disabled={totalMatches === 0}
              aria-label="Previous match"
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => goToMatch(1)}
              disabled={totalMatches === 0}
              aria-label="Next match"
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          disabled={collapsed.size === 0}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(allPaths))}
          disabled={collapsed.size === allPaths.length}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Collapse all
        </button>
        <CopyButton value={JSON.stringify(value, null, 2)} />
      </div>
      <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
        <Node
          value={value}
          path="$"
          collapsed={collapsed}
          onToggle={toggle}
          isLast
          search={search}
          matchIndex={matchIndex}
          activeMatchIndex={activeMatchIndex}
          forceExpand={forceExpand}
        />
      </pre>
    </div>
  );
}
