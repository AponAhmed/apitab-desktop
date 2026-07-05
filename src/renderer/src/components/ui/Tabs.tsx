import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  bordered?: boolean;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  size = 'md',
  bordered = true,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-0.5',
        bordered && 'border-b border-slate-200 dark:border-slate-800',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 border-b-2 font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-[13px]',
              selected
                ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {tab.label}
            {tab.badge != null && tab.badge !== '' && tab.badge !== 0 && (
              <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
