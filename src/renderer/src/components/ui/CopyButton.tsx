import { Check, Copy } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClipboard } from '@/hooks/useClipboard';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ value, label = 'Copy', className, size = 'sm' }: CopyButtonProps) {
  const { copied, copy } = useClipboard();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm',
        copied
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
