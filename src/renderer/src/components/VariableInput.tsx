import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react';
import { cn } from '@/utils/cn';
import { findOpenVariableTrigger, tokenizeVariables } from '@/utils/variables';
import { useActiveVariables } from '@/hooks/useActiveVariables';
import { VariablePopover } from './VariablePopover';
import { VariableAutocomplete } from './VariableAutocomplete';

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>;

interface VariableInputProps extends BaseProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  mono?: boolean;
  variant?: 'box' | 'bare';
}

let measureCanvas: HTMLCanvasElement | null = null;
function measureText(text: string, font: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

interface ActiveVar {
  name: string;
  x: number;
  y: number;
}

interface AutocompleteState {
  triggerStart: number;
  query: string;
  x: number;
  y: number;
  highlightedIndex: number;
}

export function VariableInput({
  value,
  onValueChange,
  className,
  mono = true,
  variant = 'box',
  placeholder,
  ...rest
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const vars = useActiveVariables();

  const segments = useMemo(() => tokenizeVariables(value), [value]);
  const hasVars = useMemo(() => segments.some((s) => s.type === 'var'), [segments]);

  const [active, setActive] = useState<ActiveVar | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overPopover = useRef(false);
  const popoverFocused = useRef(false);

  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null);
  const autocompleteNames = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();
    return Object.keys(vars).filter((name) => name.toLowerCase().includes(q));
  }, [autocomplete, vars]);

  const syncScroll = () => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (input && overlay) overlay.style.transform = `translateX(${-input.scrollLeft}px)`;
  };
  useLayoutEffect(syncScroll, [value]);

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const scheduleHide = () => {
    if (hideTimer.current) return;
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      if (!overPopover.current && !popoverFocused.current) setActive(null);
    }, 220);
  };

  const onMouseMove = (e: ReactMouseEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    if (!input || !hasVars) return;
    const cs = getComputedStyle(input);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const rect = input.getBoundingClientRect();
    const x = e.clientX - rect.left - padL + input.scrollLeft;

    let found: ActiveVar | null = null;
    for (const seg of segments) {
      if (seg.type !== 'var' || !seg.name) continue;
      const left = measureText(value.slice(0, seg.start), font);
      const right = measureText(value.slice(0, seg.end), font);
      if (x >= left && x <= right) {
        const anchor = Math.max(0, Math.min(left + padL - input.scrollLeft, rect.width - 16));
        const px = Math.max(8, Math.min(rect.left + anchor, window.innerWidth - 268));
        found = { name: seg.name, x: px, y: rect.bottom + 4 };
        break;
      }
    }

    if (found) {
      clearHide();
      setActive((prev) =>
        prev && prev.name === found!.name && Math.abs(prev.x - found!.x) < 1 ? prev : found,
      );
    } else if (active) {
      scheduleHide();
    }
  };

  const updateAutocomplete = (val: string, caret: number) => {
    const trigger = findOpenVariableTrigger(val, caret);
    const input = inputRef.current;
    if (!trigger || !input) {
      setAutocomplete(null);
      return;
    }
    const cs = getComputedStyle(input);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const rect = input.getBoundingClientRect();
    const left = measureText(val.slice(0, trigger.triggerStart), font);
    const anchor = Math.max(0, Math.min(left + padL - input.scrollLeft, rect.width - 16));
    const x = Math.max(8, Math.min(rect.left + anchor, window.innerWidth - 232));
    setAutocomplete({ triggerStart: trigger.triggerStart, query: trigger.query, x, y: rect.bottom + 4, highlightedIndex: 0 });
  };

  const insertVariable = (name: string) => {
    if (!autocomplete) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? value.length;
    const newValue = `${value.slice(0, autocomplete.triggerStart)}{{${name}}}${value.slice(caret)}`;
    onValueChange(newValue);
    setAutocomplete(null);
    requestAnimationFrame(() => {
      const pos = autocomplete.triggerStart + name.length + 4; // '{{' + name + '}}'
      input?.setSelectionRange(pos, pos);
      input?.focus();
    });
  };

  const onSelect = (e: SyntheticEvent<HTMLInputElement>) => {
    updateAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!autocomplete) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocomplete((s) =>
        s && autocompleteNames.length > 0
          ? { ...s, highlightedIndex: (s.highlightedIndex + 1) % autocompleteNames.length }
          : s,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocomplete((s) =>
        s && autocompleteNames.length > 0
          ? { ...s, highlightedIndex: (s.highlightedIndex - 1 + autocompleteNames.length) % autocompleteNames.length }
          : s,
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (autocompleteNames.length === 0) return;
      e.preventDefault();
      insertVariable(autocompleteNames[autocomplete.highlightedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocomplete(null);
    }
  };

  const pad = variant === 'box' ? 'px-2.5' : 'px-2';

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative h-8 w-full overflow-hidden',
          variant === 'box'
            ? 'rounded-md border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-600 dark:bg-slate-800'
            : 'focus-within:bg-brand-50/50 dark:focus-within:bg-brand-950/30',
        )}
      >
        {/* Highlight layer (behind the transparent input). */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center overflow-hidden text-sm',
            pad,
            mono && 'font-mono',
          )}
          aria-hidden
        >
          <div ref={overlayRef} className="whitespace-pre text-slate-800 dark:text-slate-100">
            {value === '' ? (
              <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
            ) : (
              segments.map((seg, i) =>
                seg.type === 'var' ? (
                  <span
                    key={i}
                    className={cn(
                      'rounded-[3px]',
                      seg.name && Object.prototype.hasOwnProperty.call(vars, seg.name)
                        ? 'bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300'
                        : 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400',
                    )}
                  >
                    {seg.value}
                  </span>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            updateAutocomplete(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={onSelect}
          onKeyDown={onKeyDown}
          onBlur={() => setAutocomplete(null)}
          onScroll={syncScroll}
          onMouseMove={onMouseMove}
          onMouseLeave={scheduleHide}
          spellCheck={false}
          className={cn(
            'absolute inset-0 h-full w-full bg-transparent text-sm text-transparent caret-slate-800 outline-none dark:caret-slate-100',
            pad,
            mono && 'font-mono',
          )}
          {...rest}
        />
      </div>

      {autocomplete && (
        <VariableAutocomplete
          names={autocompleteNames}
          highlightedIndex={autocomplete.highlightedIndex}
          x={autocomplete.x}
          y={autocomplete.y}
          onSelect={insertVariable}
          onHighlight={(i) => setAutocomplete((s) => (s ? { ...s, highlightedIndex: i } : s))}
        />
      )}

      {active && (
        <VariablePopover
          name={active.name}
          x={active.x}
          y={active.y}
          onMouseEnter={() => {
            overPopover.current = true;
            clearHide();
          }}
          onMouseLeave={() => {
            overPopover.current = false;
            scheduleHide();
          }}
          onFocusChange={(focused) => {
            popoverFocused.current = focused;
            if (focused) clearHide();
            else scheduleHide();
          }}
        />
      )}
    </div>
  );
}
