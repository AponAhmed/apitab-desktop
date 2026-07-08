import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { useRequestStore } from '@/stores/requestStore';
import {
  tableConfigKey,
  useTableConfigStore,
  type TableColumnConfig,
} from '@/stores/tableConfigStore';
import { getByPath } from '@/utils/jsonPath';
import { TableConfigPanel } from './TableConfigPanel';

/** Checked (in order) before falling back to the first array-valued property found — covers the most common API envelope shapes. */
const PREFERRED_ARRAY_KEYS = ['data', 'results', 'items', 'records', 'rows', 'list'];

const CELL_CLASS =
  'border-b border-slate-100 px-2 py-1 align-top text-slate-700 dark:border-slate-800/60 dark:text-slate-300';
const HEAD_CLASS =
  'border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400';
const ROW_CLASS = 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-950 dark:even:bg-slate-900/40';

/** Nested values are summarized (not dumped as raw JSON) so a row full of sub-objects/arrays stays scannable. */
function cellPreview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const keyCount = Object.keys(value).length;
    return `{${keyCount} key${keyCount === 1 ? '' : 's'}}`;
  }
  return String(value);
}

/**
 * Finds the array to tabulate: the value itself if it's already an array,
 * otherwise the first array-valued property on it — checking common
 * envelope keys (`data`, `results`, …) first since that's how most real
 * APIs wrap a list (`{ data: [...], meta: {...} }`).
 */
function findTabularArray(value: unknown): { array: unknown[]; key: string | null } | null {
  if (Array.isArray(value)) return { array: value, key: null };
  if (value === null || typeof value !== 'object') return null;

  const obj = value as Record<string, unknown>;
  for (const key of PREFERRED_ARRAY_KEYS) {
    if (Array.isArray(obj[key])) return { array: obj[key] as unknown[], key };
  }
  for (const [key, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return { array: v, key };
  }
  return null;
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full flex-1 place-items-center text-xs text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );
}

function PagesBar({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span>
        {start}–{end} of {total}
      </span>
      <IconButton size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </IconButton>
      <IconButton
        size="sm"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function LoadMoreBar({
  visibleCount,
  total,
  pageSize,
  onLoadMore,
}: {
  visibleCount: number;
  total: number;
  pageSize: number;
  onLoadMore: () => void;
}) {
  if (visibleCount >= total) return null;
  const remaining = total - visibleCount;
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span>
        {visibleCount} of {total} rows
      </span>
      <Button size="sm" variant="secondary" onClick={onLoadMore}>
        Load {Math.min(pageSize, remaining)} more
      </Button>
    </div>
  );
}

/** Renders parsed JSON as a configurable, paginated table — row source, columns, and pagination method are all user-adjustable via the gear icon. */
export function ResponseTable({ json }: { json: string }) {
  const method = useRequestStore((s) => s.request.method);
  const url = useRequestStore((s) => s.request.url);
  const configKey = tableConfigKey(method, url);
  const config = useTableConfigStore((s) => s.getConfig(configKey));
  const setConfig = useTableConfigStore((s) => s.setConfig);
  const resetConfig = useTableConfigStore((s) => s.resetConfig);

  const [page, setPage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(config.pageSize);
  const [configOpen, setConfigOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(json) as unknown };
    } catch {
      return { ok: false as const, value: undefined as unknown };
    }
  }, [json]);

  const auto = useMemo(() => (parsed.ok ? findTabularArray(parsed.value) : null), [parsed]);

  const resolvedArray = useMemo(() => {
    if (!parsed.ok) return undefined;
    const path = config.rowPath.trim();
    if (path) {
      const v = getByPath(parsed.value, path);
      return Array.isArray(v) ? v : null;
    }
    return auto?.array ?? null;
  }, [parsed, config.rowPath, auto]);

  useEffect(() => {
    setPage(0);
    setVisibleCount(config.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, json, config.rowPath, config.pageSize]);

  if (!parsed.ok) {
    return <EmptyNote>Invalid JSON — can&apos;t build a table.</EmptyNote>;
  }

  const path = config.rowPath.trim();
  const rowStatus = path
    ? resolvedArray
      ? { ok: true, message: `✓ ${resolvedArray.length} row${resolvedArray.length === 1 ? '' : 's'} found` }
      : { ok: false, message: `✗ "${path}" isn't an array` }
    : auto
      ? {
          ok: true,
          message: `Auto-detected "${auto.key ?? '(root)'}" — ${auto.array.length} row${auto.array.length === 1 ? '' : 's'}`,
        }
      : { ok: false, message: 'No array found to tabulate' };

  const isObjectArray =
    !!resolvedArray && resolvedArray.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r));
  const autoColumnPaths =
    resolvedArray && isObjectArray
      ? Array.from(
          resolvedArray.reduce<Set<string>>((set, row) => {
            Object.keys(row as object).forEach((k) => set.add(k));
            return set;
          }, new Set()),
        )
      : [];

  const columns: TableColumnConfig[] =
    resolvedArray && !isObjectArray
      ? [{ path: '', label: 'Value', visible: true }]
      : (config.columns ?? autoColumnPaths.map((p) => ({ path: p, label: p, visible: true })));
  const visibleColumns = columns.filter((c) => c.visible);

  const configButton = (
    <>
      <IconButton
        ref={gearRef}
        size="sm"
        title="Configure table"
        aria-label="Configure table"
        onClick={() => setConfigOpen((o) => !o)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </IconButton>
      {configOpen && (
        <TableConfigPanel
          anchorRef={gearRef}
          onClose={() => setConfigOpen(false)}
          config={config}
          onChange={(next) => setConfig(configKey, next)}
          onReset={() => {
            resetConfig(configKey);
            setConfigOpen(false);
          }}
          rowStatus={rowStatus}
          autoDetectedPath={auto?.key ?? null}
          availableColumns={isObjectArray ? autoColumnPaths : []}
        />
      )}
    </>
  );

  let body: ReactNode;
  if (!resolvedArray) {
    body = (
      <EmptyNote>
        {path
          ? 'That path doesn’t resolve to an array — fix it or clear it in the config panel.'
          : "Response isn't an object or array — nothing to tabulate."}
      </EmptyNote>
    );
  } else if (resolvedArray.length === 0) {
    body = <EmptyNote>Empty array</EmptyNote>;
  } else {
    const totalPages = Math.max(1, Math.ceil(resolvedArray.length / config.pageSize));
    const clampedPage = Math.min(page, totalPages - 1);

    let rows: unknown[];
    let startIndex: number;
    if (config.paginationMode === 'none') {
      rows = resolvedArray;
      startIndex = 0;
    } else if (config.paginationMode === 'loadMore') {
      rows = resolvedArray.slice(0, visibleCount);
      startIndex = 0;
    } else {
      startIndex = clampedPage * config.pageSize;
      rows = resolvedArray.slice(startIndex, startIndex + config.pageSize);
    }

    body = (
      <>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className={HEAD_CLASS}>#</th>
                {visibleColumns.map((c, i) => (
                  <th key={`${c.path}-${i}`} className={HEAD_CLASS}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={startIndex + i} className={ROW_CLASS}>
                  <td className={`${CELL_CLASS} text-slate-400`}>{startIndex + i + 1}</td>
                  {visibleColumns.map((c, ci) => (
                    <td key={`${c.path}-${ci}`} className={CELL_CLASS}>
                      {cellPreview(getByPath(row, c.path))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {config.paginationMode === 'pages' && (
          <PagesBar
            page={clampedPage}
            totalPages={totalPages}
            pageSize={config.pageSize}
            total={resolvedArray.length}
            onPageChange={setPage}
          />
        )}
        {config.paginationMode === 'loadMore' && (
          <LoadMoreBar
            visibleCount={visibleCount}
            total={resolvedArray.length}
            pageSize={config.pageSize}
            onLoadMore={() => setVisibleCount((v) => Math.min(resolvedArray.length, v + config.pageSize))}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p
          className={`min-w-0 truncate text-[11px] ${rowStatus.ok ? 'text-slate-400 dark:text-slate-500' : 'text-red-500 dark:text-red-400'}`}
        >
          {rowStatus.message}
        </p>
        {configButton}
      </div>
      {body}
    </div>
  );
}
