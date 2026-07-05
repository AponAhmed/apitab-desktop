import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from '@/utils/cn';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  label?: string;
}

const WIDTH = 176;

export function Menu({ items, label = 'Actions' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current!.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)),
      y: r.bottom + 4,
    });
    setOpen((o) => !o);
  };

  return (
    <>
      <IconButton
        ref={btnRef}
        size="sm"
        title={label}
        aria-label={label}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </IconButton>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
            />
            <div
              style={{ position: 'fixed', left: pos.x, top: pos.y, width: WIDTH }}
              onClick={(e) => e.stopPropagation()}
              className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              {items.map((item, i) => (
                <div key={item.label}>
                  {item.separatorBefore && i > 0 && (
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700/70" />
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                      item.danger
                        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60',
                    )}
                  >
                    {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
                    {item.label}
                  </button>
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
