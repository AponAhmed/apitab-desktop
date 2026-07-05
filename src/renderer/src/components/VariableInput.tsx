import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { cn } from '@/utils/cn';
import { tokenizeVariables } from '@/utils/variables';
import { useActiveVariables } from '@/hooks/useActiveVariables';
import { VariablePopover } from './VariablePopover';

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
          onChange={(e) => onValueChange(e.target.value)}
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
