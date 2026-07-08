import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { computePopoverPosition } from '@/utils/popoverPosition';

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'children'> {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  mono?: boolean;
}

interface OptionEntry {
  value: string;
  label: ReactNode;
  className?: string;
  disabled?: boolean;
}

/** Reads plain `<option>` children (the API this component's callers already use) into a renderable list. */
function extractOptions(children: ReactNode): OptionEntry[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    const { value, children: label, className, disabled } = child.props;
    return [{ value: String(value ?? ''), label, className, disabled }];
  });
}

/**
 * A custom-styled dropdown with the same external API as a native
 * `<select>` (`value`/`onChange`/`<option>` children) so every existing
 * call site works unchanged — only the popup rendering differs, since a
 * native `<select>`'s open list can't be themed to match the app.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({ value, onChange, children, mono, className, disabled, id, ...rest }, ref) => {
    const options = useMemo(() => extractOptions(children), [children]);
    const selected = options.find((o) => o.value === value);
    // `cn` is a plain joiner (no Tailwind conflict resolution), so a
    // caller-supplied width/height (e.g. `w-[104px]` on the method selector,
    // or `h-7` on a compact one) would silently lose to these base classes
    // depending on generated CSS order — only fall back to the defaults
    // when the caller didn't specify their own.
    const hasWidthClass = !!className && /(^|\s)w-\S+/.test(className);
    const hasHeightClass = !!className && /(^|\s)h-\S+/.test(className);

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0, width: 0 });
    const [highlight, setHighlight] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);

    const openMenu = () => {
      if (disabled) return;
      const r = btnRef.current!.getBoundingClientRect();
      const width = Math.max(r.width, 160);
      // Estimated popup height (rows ~33px + py-1 padding), capped to match
      // the listbox's own `max-h-64` — used only to decide whether to flip
      // the popup above the trigger when there's no room below.
      const estimatedHeight = Math.min(options.length * 33 + 8, 264);
      const { x, y } = computePopoverPosition(r, { width, height: estimatedHeight });
      setPos({ x, y, width });
      setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlight((h) => Math.min(options.length - 1, h + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => Math.max(0, h - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const opt = options[highlight];
          if (opt && !opt.disabled) {
            onChange({ target: { value: opt.value } });
            setOpen(false);
          }
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [open, options, highlight, onChange]);

    return (
      <>
        <button
          ref={(node) => {
            btnRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openMenu())}
          className={cn(
            'flex items-center justify-between gap-1.5 rounded-md border border-slate-300 bg-white pl-2.5 pr-2 text-sm text-slate-800 transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500',
            !hasWidthClass && 'w-full',
            !hasHeightClass && 'h-8',
            mono && 'font-mono',
            className,
          )}
          {...rest}
        >
          <span className={cn('min-w-0 flex-1 truncate text-left', selected?.className)}>
            {selected?.label ?? value}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open &&
          createPortal(
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
              <div
                role="listbox"
                style={{ position: 'fixed', left: pos.x, top: pos.y, width: pos.width }}
                className="z-50 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
              >
                {options.map((opt, i) => (
                  <button
                    key={opt.value + i}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => {
                      onChange({ target: { value: opt.value } });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                      i === highlight && 'bg-slate-100 dark:bg-slate-700/60',
                      opt.disabled && 'cursor-not-allowed opacity-50',
                      mono && 'font-mono',
                    )}
                  >
                    <span
                      className={cn(
                        'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre',
                        opt.className,
                      )}
                    >
                      {opt.label}
                    </span>
                    {opt.value === value && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
      </>
    );
  },
);
Select.displayName = 'Select';
