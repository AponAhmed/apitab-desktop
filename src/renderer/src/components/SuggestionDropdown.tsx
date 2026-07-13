import { createPortal } from 'react-dom';
import { computePopoverPosition } from '@/utils/popoverPosition';

interface SuggestionDropdownProps {
  suggestions: string[];
  anchor: DOMRect;
  onSelect: (value: string) => void;
}

const ROW_HEIGHT = 28;

/**
 * Floating suggestion list anchored under a value input/textarea. Exists
 * because native `<datalist>` doesn't work here: the value cell it's used
 * with (KeyValueEditor's ExpandableValueCell) swaps to a plain `<textarea>`
 * on focus, and `<textarea>` has no `list` attribute at all per the HTML
 * spec — a `<datalist>`-based approach silently stops suggesting the moment
 * the user actually clicks in.
 */
export function SuggestionDropdown({ suggestions, anchor, onSelect }: SuggestionDropdownProps) {
  if (suggestions.length === 0) return null;

  const height = Math.min(suggestions.length * ROW_HEIGHT + 8, 224);
  const { x, y } = computePopoverPosition(anchor, { width: anchor.width, height });

  return createPortal(
    <div
      style={{ position: 'fixed', left: x, top: y, width: anchor.width }}
      // Prevents the input/textarea from blurring when a suggestion is
      // clicked — without this, blur fires (and the cell collapses, unmounting
      // this dropdown) before the button's onClick ever runs.
      onMouseDown={(e) => e.preventDefault()}
      className="z-50 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="flex w-full items-center px-2.5 py-1.5 text-left font-mono text-xs text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-brand-950/40"
        >
          {s}
        </button>
      ))}
    </div>,
    document.body,
  );
}
