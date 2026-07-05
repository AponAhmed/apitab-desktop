import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToastStore } from '@/stores/toastStore';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const COLORS = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-brand-500',
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Icon className={cn('h-4 w-4 shrink-0', COLORS[t.type])} />
            {t.message}
          </button>
        );
      })}
    </div>
  );
}
