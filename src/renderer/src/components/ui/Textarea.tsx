import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, mono = true, ...props }, ref) => (
    <textarea
      ref={ref}
      spellCheck={false}
      className={cn(
        'w-full resize-none rounded-md border border-slate-300 bg-white p-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
