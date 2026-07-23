import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Skips the backdrop blur — for a modal where staying able to read content behind it (e.g. the collection tree) matters more than the usual focus effect. */
  noBackdropBlur?: boolean;
}

export function Modal({ open, onClose, title, children, footer, className, noBackdropBlur }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4',
        !noBackdropBlur && 'backdrop-blur-sm',
      )}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900',
          // `cn` is a plain joiner (no Tailwind conflict resolution), so a
          // competing `max-w-*` here would silently win over a caller's
          // override depending on generated CSS order — fall back instead
          // of always including the default, so exactly one is ever present.
          className ?? 'max-w-md',
        )}
      >
        {title != null && (
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            <IconButton size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="px-4 py-4">{children}</div>
        {footer != null && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
