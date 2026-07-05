import { cn } from '@/utils/cn';
import { methodColor, statusColor } from '@/utils/ui';
import type { HttpMethod } from '@/types';

export function MethodBadge({
  method,
  className,
}: {
  method: HttpMethod;
  className?: string;
}) {
  return (
    <span className={cn('font-mono text-[11px] font-bold tracking-wide', methodColor(method), className)}>
      {method}
    </span>
  );
}

export function StatusBadge({
  status,
  statusText,
}: {
  status: number;
  statusText?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
        statusColor(status),
      )}
    >
      {status}
      {statusText ? <span className="font-normal opacity-80">{statusText}</span> : null}
    </span>
  );
}
