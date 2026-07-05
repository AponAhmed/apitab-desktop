import { cn } from '@/utils/cn';
import { CopyButton } from './ui/CopyButton';

interface CodeBlockProps {
  code: string;
  /** Pre-highlighted, already HTML-escaped markup. Falls back to plain text. */
  html?: string;
  copyValue?: string;
  wrap?: boolean;
  className?: string;
}

export function CodeBlock({ code, html, copyValue, wrap, className }: CodeBlockProps) {
  return (
    <div
      className={cn(
        'group relative h-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
    >
      {copyValue != null && (
        <div className="sticky top-0 z-10 float-right opacity-0 transition-opacity group-hover:opacity-100">
          <div className="m-2">
            <CopyButton value={copyValue} />
          </div>
        </div>
      )}
      <pre
        className={cn(
          'p-3 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200',
          wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        )}
      >
        {html != null ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
      </pre>
    </div>
  );
}
