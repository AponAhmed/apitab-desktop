import { useEffect, useId, useRef, useState } from 'react';
import { Trash2, Share2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Toggle } from './ui/Toggle';
import { IconButton } from './ui/IconButton';
import { VariableInput } from './VariableInput';
import type { KeyValue } from '@/types';

interface KeyValueEditorProps {
  rows: KeyValue[];
  onChange: (id: string, patch: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  valueSuggestions?: string[];
  /** Highlight `{{variables}}` and show the hover editor (default true). */
  enableVariables?: boolean;
  /** Grid track sizes for the key/value columns (default equal width). */
  columnRatio?: [string, string];
  /**
   * Shows a per-row "include in export" toggle (used by Environments, so the
   * user opts individual variables into collection exports/shares — nothing
   * is bundled by default since values often hold secrets).
   */
  showShareToggle?: boolean;
  sharedIds?: ReadonlySet<string>;
  onToggleShared?: (id: string) => void;
  /** Renders the key cell as static text (e.g. path variables, whose names come from the URL, not free typing). */
  readOnlyKeys?: boolean;
  /** Hides the per-row remove button/column, for rows that can't be deleted individually. */
  hideRemove?: boolean;
}

const inputClass =
  'h-8 w-full min-w-0 bg-transparent px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-brand-50/50 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-brand-950/30';

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * A value cell that expands into a wrapping, auto-growing textarea while
 * focused (so long values like tokens/URLs are fully visible while editing),
 * and collapses back to the compact single-line view on blur.
 */
function ExpandableValueCell({
  value,
  onChange,
  placeholder,
  listId,
  dim,
  enableVariables,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  listId?: string;
  dim: boolean;
  enableVariables: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused) autosize(textareaRef.current);
  }, [focused, value]);

  if (focused) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoFocus
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setFocused(false)}
        className={cn(
          inputClass,
          'h-auto resize-none overflow-hidden whitespace-pre-wrap break-all py-1.5 font-mono leading-snug',
          'border-l border-slate-200 dark:border-slate-800',
        )}
      />
    );
  }

  return (
    <Cell
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      listId={listId}
      dim={dim}
      borderL
      enableVariables={enableVariables}
      onFocus={() => setFocused(true)}
    />
  );
}

function Cell({
  value,
  onChange,
  placeholder,
  listId,
  dim,
  borderL,
  enableVariables,
  onFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  listId?: string;
  dim: boolean;
  borderL?: boolean;
  enableVariables: boolean;
  onFocus?: () => void;
}) {
  const border = borderL ? 'border-l border-slate-200 dark:border-slate-800' : undefined;
  if (enableVariables) {
    return (
      <VariableInput
        variant="bare"
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        list={listId}
        onFocus={onFocus}
        className={cn(border, dim && 'opacity-50')}
      />
    );
  }
  return (
    <input
      list={listId}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      className={cn(inputClass, 'font-mono', border, dim && 'opacity-50')}
    />
  );
}

export function KeyValueEditor({
  rows,
  onChange,
  onRemove,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions,
  valueSuggestions,
  enableVariables = true,
  columnRatio = ['1fr', '1fr'],
  showShareToggle = false,
  sharedIds,
  onToggleShared,
  readOnlyKeys = false,
  hideRemove = false,
}: KeyValueEditorProps) {
  const keyListId = useId();
  const valueListId = useId();
  const shareCol = showShareToggle ? ' 2rem' : '';
  const removeCol = hideRemove ? '' : ' 2.25rem';

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      {keySuggestions && (
        <datalist id={keyListId}>
          {keySuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {valueSuggestions && (
        <datalist id={valueListId}>
          {valueSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {rows.map((row, i) => {
        const isTrailing = i === rows.length - 1 && row.key === '' && row.value === '';
        const dim = !row.enabled && !isTrailing;
        const shared = sharedIds?.has(row.id) ?? false;
        return (
          <div
            key={row.id}
            style={{
              gridTemplateColumns: `2.25rem ${columnRatio[0]} ${columnRatio[1]}${shareCol}${removeCol}`,
            }}
            className={cn(
              'grid items-center',
              i > 0 && 'border-t border-slate-200 dark:border-slate-800',
            )}
          >
            <div className="grid place-items-center">
              <Toggle
                checked={row.enabled}
                onChange={(v) => onChange(row.id, { enabled: v })}
                aria-label="Toggle row"
                className={cn(isTrailing && 'opacity-0')}
              />
            </div>
            {readOnlyKeys ? (
              <span
                className={cn(
                  'truncate px-2 font-mono text-sm text-violet-600 dark:text-violet-300',
                  dim && 'opacity-50',
                )}
              >
                {row.key}
              </span>
            ) : (
              <Cell
                value={row.key}
                onChange={(v) => onChange(row.id, { key: v })}
                placeholder={keyPlaceholder}
                listId={keySuggestions ? keyListId : undefined}
                dim={dim}
                enableVariables={enableVariables}
              />
            )}
            <ExpandableValueCell
              value={row.value}
              onChange={(v) => onChange(row.id, { value: v })}
              placeholder={valuePlaceholder}
              listId={valueSuggestions ? valueListId : undefined}
              dim={dim}
              enableVariables={enableVariables}
            />
            {showShareToggle && (
              <div className="grid place-items-center">
                {!isTrailing && (
                  <IconButton
                    size="sm"
                    onClick={() => onToggleShared?.(row.id)}
                    aria-label={shared ? 'Included in export — click to exclude' : 'Excluded from export — click to include'}
                    title={shared ? 'Included when exporting/sharing' : 'Not included when exporting/sharing'}
                    // `!` (important) modifier: IconButton bakes in its own
                    // text-slate-* default at equal specificity, so a plain
                    // className override can silently lose that cascade tie.
                    className={shared ? '!text-brand-600 dark:!text-brand-400' : undefined}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            )}
            {!hideRemove && (
              <div className="grid place-items-center">
                {!isTrailing && (
                  <IconButton size="sm" onClick={() => onRemove(row.id)} aria-label="Remove row">
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
