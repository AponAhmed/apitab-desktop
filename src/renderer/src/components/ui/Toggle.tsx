import { cn } from '@/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  'aria-label'?: string;
  className?: string;
}

/** Compact accessible on/off switch (used for enable columns). */
export function Toggle({ checked, onChange, title, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-3.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
