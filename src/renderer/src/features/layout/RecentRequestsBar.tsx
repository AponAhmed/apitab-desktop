import { useMemo, useRef, useState, useEffect, useCallback, type WheelEvent } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useHistoryStore } from '@/stores/historyStore';
import { useRequestStore } from '@/stores/requestStore';
import { MethodBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { statusColor } from '@/utils/ui';
import { cn } from '@/utils/cn';
import type { HistoryEntry } from '@/types';

/** Keeps only the most recent entry per method+URL — history is newest-first already. */
function uniqueByRequest(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const unique: HistoryEntry[] = [];
  for (const e of entries) {
    const key = `${e.method} ${e.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  return unique;
}

/** Saved requests keep their given name; unsaved drafts stay at this default. */
const DEFAULT_NAME = 'Untitled Request';

function labelFor(e: HistoryEntry): string {
  const name = e.request.name;
  if (name && name !== DEFAULT_NAME) return name;
  return e.url || DEFAULT_NAME;
}

const SCROLL_STEP = 160;

/**
 * Small, fixed-height quick-switch strip docked under the response panel —
 * every distinct request that's been sent, each showing its latest status,
 * so you can jump back to one without digging through the History tab.
 */
export function RecentRequestsBar() {
  const entries = useHistoryStore((s) => s.entries);
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const loadRequest = useRequestStore((s) => s.loadRequest);
  const activeMethod = useRequestStore((s) => s.request.method);
  const activeUrl = useRequestStore((s) => s.request.url);

  const unique = useMemo(() => uniqueByRequest(entries), [entries]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [unique.length, updateScrollState]);

  // Redirects vertical mouse-wheel scrolling to horizontal, so a plain
  // mouse (not just a trackpad) can scroll this strip without Shift.
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  const scrollBy = (delta: number) => scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  const removeUnique = (e: HistoryEntry) => {
    const key = `${e.method} ${e.url}`;
    for (const entry of entries) {
      if (`${entry.method} ${entry.url}` === key) deleteEntry(entry.id);
    }
  };

  if (unique.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-center border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
      <IconButton
        size="sm"
        aria-label="Scroll left"
        onClick={() => scrollBy(-SCROLL_STEP)}
        disabled={!canScrollLeft}
        className={cn('!h-6 !w-6 mx-0.5 shrink-0', !canScrollLeft && 'invisible')}
      >
        <ChevronLeft className="h-3 w-3" />
      </IconButton>

      <div
        ref={scrollerRef}
        onWheel={onWheel}
        onScroll={updateScrollState}
        className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {unique.map((e) => {
          const active = e.method === activeMethod && e.url === activeUrl;
          return (
            <div
              key={`${e.method} ${e.url}`}
              onClick={() =>
                loadRequest(e.request, null, {
                  response: e.response ?? null,
                  error: e.error ?? null,
                  scriptRun: e.scriptRun ?? null,
                  sentAt: e.timestamp,
                })
              }
              title={e.url}
              className={cn(
                'group flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded pl-1.5 pr-0.5 text-[11px] leading-none transition-colors',
                active
                  ? 'bg-white shadow-sm dark:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60',
              )}
            >
              <MethodBadge method={e.method} className="text-[9px]" />
              <span className="max-w-[140px] truncate">{labelFor(e)}</span>
              {e.status != null && (
                <span
                  className={cn(
                    'rounded px-1 py-px text-[9px] font-semibold leading-none',
                    statusColor(e.status),
                  )}
                >
                  {e.status}
                </span>
              )}
              <IconButton
                size="sm"
                aria-label="Remove from recent"
                title="Remove"
                className="!h-4 !w-4 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeUnique(e);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </IconButton>
            </div>
          );
        })}
      </div>

      <IconButton
        size="sm"
        aria-label="Scroll right"
        onClick={() => scrollBy(SCROLL_STEP)}
        disabled={!canScrollRight}
        className={cn('!h-6 !w-6 mx-0.5 shrink-0', !canScrollRight && 'invisible')}
      >
        <ChevronRight className="h-3 w-3" />
      </IconButton>
    </div>
  );
}
