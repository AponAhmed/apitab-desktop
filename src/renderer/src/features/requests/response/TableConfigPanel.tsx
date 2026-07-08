import { useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { computePopoverPosition } from '@/utils/popoverPosition';
import {
  DEFAULT_TABLE_CONFIG,
  type PaginationMode,
  type TableColumnConfig,
  type TableViewConfig,
} from '@/stores/tableConfigStore';

const PANEL_WIDTH = 340;

interface RowStatus {
  ok: boolean;
  message: string;
}

interface TableConfigPanelProps {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  config: TableViewConfig;
  onChange: (next: TableViewConfig) => void;
  onReset: () => void;
  rowStatus: RowStatus;
  autoDetectedPath: string | null;
  /** Column paths available on the currently-resolved rows, used to seed the checklist. */
  availableColumns: string[];
}

/** `config.columns` if the user has customized it, otherwise a materialized view of the auto-detected columns. */
function effectiveColumns(config: TableViewConfig, availableColumns: string[]): TableColumnConfig[] {
  return config.columns ?? availableColumns.map((path) => ({ path, label: path, visible: true }));
}

export function TableConfigPanel({
  anchorRef,
  onClose,
  config,
  onChange,
  onReset,
  rowStatus,
  autoDetectedPath,
  availableColumns,
}: TableConfigPanelProps) {
  const [newColumnPath, setNewColumnPath] = useState('');
  const r = anchorRef.current?.getBoundingClientRect();
  // Right-aligned to the gear button (not left, like most popovers here) —
  // the panel is wide and the button tends to sit near the row's right
  // edge — but still flips above when there's no room below.
  const x = r ? Math.max(8, Math.min(r.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)) : 8;
  const y = r ? computePopoverPosition(r, { width: PANEL_WIDTH, height: 480 }).y : 8;

  const cols = effectiveColumns(config, availableColumns);
  const updateColumns = (next: TableColumnConfig[]) => onChange({ ...config, columns: next });

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        style={{ position: 'fixed', left: x, top: y, width: PANEL_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
        className="z-50 max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Row data path
          </label>
          <Input
            value={config.rowPath}
            onChange={(e) => onChange({ ...config, rowPath: e.target.value })}
            placeholder={autoDetectedPath ? `auto: ${autoDetectedPath}` : 'auto-detect'}
            mono
            className="h-7 text-xs"
          />
          <p
            className={cn(
              'mt-1 text-[11px]',
              rowStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {rowStatus.message}
          </p>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Columns</label>
            {config.columns !== null && (
              <button
                type="button"
                onClick={() => onChange({ ...config, columns: null })}
                className="text-[11px] text-brand-600 hover:underline dark:text-brand-400"
              >
                Reset to auto
              </button>
            )}
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-1.5 dark:border-slate-700">
            {cols.length === 0 && (
              <p className="px-1 py-1 text-[11px] text-slate-400">No fields detected yet.</p>
            )}
            {cols.map((col, i) => (
              <div key={`${col.path}-${i}`} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() =>
                    updateColumns(cols.map((c, idx) => (idx === i ? { ...c, visible: !c.visible } : c)))
                  }
                  className="h-3.5 w-3.5 shrink-0 accent-brand-500"
                  aria-label={`Show column ${col.label}`}
                />
                <input
                  value={col.label}
                  onChange={(e) =>
                    updateColumns(cols.map((c, idx) => (idx === i ? { ...c, label: e.target.value } : c)))
                  }
                  className="h-6 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs text-slate-700 hover:border-slate-200 focus:border-brand-500 focus:outline-none dark:text-slate-200 dark:hover:border-slate-600"
                />
                <span
                  className="hidden shrink-0 truncate font-mono text-[10px] text-slate-400 sm:block sm:max-w-[70px]"
                  title={col.path}
                >
                  {col.path}
                </span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...cols];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    updateColumns(next);
                  }}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                  aria-label="Move column up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={i === cols.length - 1}
                  onClick={() => {
                    const next = [...cols];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    updateColumns(next);
                  }}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                  aria-label="Move column down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => updateColumns(cols.filter((_, idx) => idx !== i))}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                  aria-label={`Remove column ${col.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1">
            <Input
              value={newColumnPath}
              onChange={(e) => setNewColumnPath(e.target.value)}
              placeholder="field.nested.path"
              mono
              className="h-6 text-[11px]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const path = newColumnPath.trim();
                if (!path) return;
                updateColumns([...cols, { path, label: path, visible: true }]);
                setNewColumnPath('');
              }}
              disabled={!newColumnPath.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Pagination
          </label>
          <div className="flex items-center gap-1.5">
            <Select
              value={config.paginationMode}
              onChange={(e) => onChange({ ...config, paginationMode: e.target.value as PaginationMode })}
              className="h-7 w-28 text-xs"
              aria-label="Pagination method"
            >
              <option value="pages">Pages</option>
              <option value="loadMore">Load more</option>
              <option value="none">Show all</option>
            </Select>
            {config.paginationMode !== 'none' && (
              <>
                <span className="text-[11px] text-slate-400">rows</span>
                <Input
                  type="number"
                  min={5}
                  max={500}
                  value={config.pageSize}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      pageSize: Math.max(5, Math.min(500, Number(e.target.value) || DEFAULT_TABLE_CONFIG.pageSize)),
                    })
                  }
                  className="h-7 w-16 text-xs"
                />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-slate-500 hover:underline dark:text-slate-400"
          >
            Reset all
          </button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
