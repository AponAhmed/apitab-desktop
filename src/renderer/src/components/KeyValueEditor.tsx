import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Trash2, Share2, Paperclip, Type, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Toggle } from './ui/Toggle';
import { IconButton } from './ui/IconButton';
import { VariableInput } from './VariableInput';
import { SuggestionDropdown } from './SuggestionDropdown';
import { VariableAutocomplete } from './VariableAutocomplete';
import { findOpenVariableTrigger } from '@/utils/variables';
import { useActiveVariables } from '@/hooks/useActiveVariables';
import { useFileStore, formDataFileKey } from '@/stores/fileStore';
import { middleEllipsis } from '@/utils/format';
import type { KeyValue } from '@/types';

interface KeyValueEditorProps {
  rows: KeyValue[];
  onChange: (id: string, patch: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  valueSuggestions?: string[];
  /**
   * Per-row value suggestions derived from that row's own key (e.g. Headers:
   * suggest `application/json` etc. only once the key reads `Content-Type`).
   * Takes precedence over `valueSuggestions` when it returns a non-empty
   * list for a given row; falls back to `valueSuggestions` (or nothing)
   * otherwise, so keys with no known vocabulary still work as plain text.
   */
  valueSuggestionsForKey?: (key: string) => string[] | undefined;
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
  /** Adds a free-text "Description" column per row (Params, Headers, form bodies) — not sent with the request. */
  showNotes?: boolean;
  /**
   * Form Data only: lets each row's value be a chosen file instead of text
   * (adds a small text/file mode toggle per row). The `File` itself is kept
   * in `stores/fileStore.ts` (keyed by the row's id), never in this
   * persisted `rows` list — only `valueType`/`fileName` are.
   */
  allowFileValues?: boolean;
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
 *
 * Suggestions are a custom floating dropdown (`SuggestionDropdown`), not a
 * native `<datalist>` — a `<textarea>` has no `list` attribute at all per
 * the HTML spec, so a datalist-based approach would silently stop
 * suggesting the instant this cell expands into one on focus.
 */
function ExpandableValueCell({
  value,
  onChange,
  placeholder,
  suggestions,
  dim,
  enableVariables,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  dim: boolean;
  enableVariables: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vars = useActiveVariables();

  useEffect(() => {
    if (focused) autosize(textareaRef.current);
  }, [focused, value]);

  const filtered = useMemo(() => {
    if (!focused || !suggestions || suggestions.length === 0) return [];
    const q = value.trim().toLowerCase();
    return suggestions.filter((s) => !q || (s.toLowerCase().startsWith(q) && s.toLowerCase() !== q));
  }, [focused, suggestions, value]);

  const select = (v: string) => {
    onChange(v);
    setFocused(false);
  };

  // The expanding textarea (below) is a separate element from the collapsed
  // Cell/VariableInput view, so it needs its own `{{`-trigger autocomplete —
  // otherwise the moment a value cell is focused for editing, variable
  // suggestions (available everywhere else: URL, params, the key cell here)
  // silently stop working.
  const [varTrigger, setVarTrigger] = useState<{
    triggerStart: number;
    query: string;
    highlightedIndex: number;
  } | null>(null);
  const varNames = useMemo(() => {
    if (!varTrigger) return [];
    const q = varTrigger.query.toLowerCase();
    return Object.keys(vars).filter((n) => n.toLowerCase().includes(q));
  }, [varTrigger, vars]);

  const insertVariable = (name: string) => {
    if (!varTrigger) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const newValue = `${value.slice(0, varTrigger.triggerStart)}{{${name}}}${value.slice(caret)}`;
    onChange(newValue);
    setVarTrigger(null);
    requestAnimationFrame(() => {
      const pos = varTrigger.triggerStart + name.length + 4; // '{{' + name + '}}'
      el?.setSelectionRange(pos, pos);
      el?.focus();
    });
  };

  const updateVarTrigger = (val: string, caret: number) => {
    if (!enableVariables) return;
    const trigger = findOpenVariableTrigger(val, caret);
    setVarTrigger(trigger ? { ...trigger, highlightedIndex: 0 } : null);
  };

  const onTextareaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!varTrigger) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVarTrigger((s) =>
        s && varNames.length > 0 ? { ...s, highlightedIndex: (s.highlightedIndex + 1) % varNames.length } : s,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVarTrigger((s) =>
        s && varNames.length > 0
          ? { ...s, highlightedIndex: (s.highlightedIndex - 1 + varNames.length) % varNames.length }
          : s,
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (varNames.length === 0) return;
      e.preventDefault();
      insertVariable(varNames[varTrigger.highlightedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setVarTrigger(null);
    }
  };

  const dropdown = varTrigger ? (
    anchor && (
      <VariableAutocomplete
        names={varNames}
        highlightedIndex={varTrigger.highlightedIndex}
        x={anchor.left}
        y={anchor.bottom + 4}
        onSelect={insertVariable}
        onHighlight={(i) => setVarTrigger((s) => (s ? { ...s, highlightedIndex: i } : s))}
      />
    )
  ) : (
    anchor &&
    filtered.length > 0 && <SuggestionDropdown suggestions={filtered} anchor={anchor} onSelect={select} />
  );

  if (focused) {
    return (
      <>
        <textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoFocus
          rows={1}
          onChange={(e) => {
            onChange(e.target.value);
            updateVarTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => updateVarTrigger(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onTextareaKeyDown}
          onFocus={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
          onBlur={() => {
            setFocused(false);
            setVarTrigger(null);
          }}
          className={cn(
            inputClass,
            'h-auto resize-none overflow-hidden whitespace-pre-wrap break-all py-1.5 font-mono leading-snug',
            'border-l border-slate-200 dark:border-slate-800',
          )}
        />
        {dropdown}
      </>
    );
  }

  return (
    <>
      <Cell
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        dim={dim}
        borderL
        enableVariables={enableVariables}
        onFocus={(e) => {
          setAnchor(e.currentTarget.getBoundingClientRect());
          setFocused(true);
        }}
      />
      {dropdown}
    </>
  );
}

/** Value cell for a form-data row in file mode: a filename picker instead of free text. */
function FileValueCell({
  fileName,
  dim,
  onPick,
  onClear,
}: {
  fileName?: string;
  dim: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-1 border-l border-slate-200 px-2 dark:border-slate-800',
        dim && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title={fileName}
        className="min-w-0 flex-1 truncate text-left font-mono text-sm text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
      >
        {fileName ? middleEllipsis(fileName, 24) : 'Choose file…'}
      </button>
      {fileName && (
        <IconButton size="sm" onClick={onClear} aria-label="Remove file">
          <X className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </div>
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
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
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
  valueSuggestionsForKey,
  enableVariables = true,
  columnRatio = ['1fr', '1fr'],
  showShareToggle = false,
  sharedIds,
  onToggleShared,
  readOnlyKeys = false,
  hideRemove = false,
  showNotes = false,
  allowFileValues = false,
}: KeyValueEditorProps) {
  const keyListId = useId();
  const shareCol = showShareToggle ? ' 2rem' : '';
  const removeCol = hideRemove ? '' : ' 2.25rem';
  const notesCol = showNotes ? ' 1fr' : '';
  const fileToggleCol = allowFileValues ? ' 2rem' : '';
  const gridTemplateColumns = `2.25rem ${columnRatio[0]} ${columnRatio[1]}${fileToggleCol}${notesCol}${shareCol}${removeCol}`;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      {showNotes && (
        <div
          style={{ gridTemplateColumns }}
          className="grid items-center border-b border-slate-200 bg-slate-50 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
        >
          <span />
          <span className="px-2">{keyPlaceholder}</span>
          <span className="px-2 border-l border-slate-200 dark:border-slate-800">{valuePlaceholder}</span>
          {allowFileValues && <span />}
          <span className="px-2 border-l border-slate-200 dark:border-slate-800">Description</span>
        </div>
      )}
      {keySuggestions && (
        <datalist id={keyListId}>
          {keySuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {rows.map((row, i) => {
        // A row switched to file mode counts as "filled in" even before a
        // key is typed or a file is actually chosen — otherwise it'd stay
        // indistinguishable from the perpetual blank trailing row (dimmed,
        // no remove button, no fresh row appended below it once used).
        const isTrailing = i === rows.length - 1 && row.key === '' && row.value === '' && row.valueType !== 'file';
        const dim = !row.enabled && !isTrailing;
        const shared = sharedIds?.has(row.id) ?? false;
        const rowValueSuggestions = valueSuggestionsForKey?.(row.key) ?? valueSuggestions;
        return (
          <div
            key={row.id}
            style={{ gridTemplateColumns }}
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
            {allowFileValues && row.valueType === 'file' ? (
              <FileValueCell
                fileName={row.fileName}
                dim={dim}
                onPick={(file) => {
                  useFileStore.getState().setFile(formDataFileKey(row.id), file);
                  onChange(row.id, { fileName: file.name, value: '' });
                }}
                onClear={() => {
                  useFileStore.getState().removeFile(formDataFileKey(row.id));
                  onChange(row.id, { fileName: undefined });
                }}
              />
            ) : (
              <ExpandableValueCell
                value={row.value}
                onChange={(v) => onChange(row.id, { value: v })}
                placeholder={valuePlaceholder}
                suggestions={rowValueSuggestions}
                dim={dim}
                enableVariables={enableVariables}
              />
            )}
            {allowFileValues && (
              <div className="grid place-items-center">
                <IconButton
                  size="sm"
                  onClick={() => {
                    if (row.valueType === 'file') {
                      useFileStore.getState().removeFile(formDataFileKey(row.id));
                      onChange(row.id, { valueType: 'text', fileName: undefined });
                    } else {
                      onChange(row.id, { valueType: 'file', value: '' });
                    }
                  }}
                  aria-label={row.valueType === 'file' ? 'Switch to text value' : 'Switch to file value'}
                  title={row.valueType === 'file' ? 'Switch to text value' : 'Switch to file value'}
                >
                  {row.valueType === 'file' ? <Type className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                </IconButton>
              </div>
            )}
            {showNotes && (
              <input
                value={row.description ?? ''}
                placeholder="Description"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => onChange(row.id, { description: e.target.value })}
                className={cn(
                  inputClass,
                  'border-l border-slate-200 dark:border-slate-800',
                  dim && 'opacity-50',
                )}
              />
            )}
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
