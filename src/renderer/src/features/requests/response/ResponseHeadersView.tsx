import { EmptyState } from '@/components/ui/EmptyState';
import { List } from 'lucide-react';
import type { ResponseHeader } from '@/types';

export function ResponseHeadersView({ headers }: { headers: ResponseHeader[] }) {
  if (headers.length === 0) {
    return <EmptyState icon={List} title="No response headers" />;
  }
  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-xs">
        <tbody>
          {headers.map((h, i) => (
            <tr
              key={`${h.key}-${i}`}
              className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
            >
              <td className="w-1/3 whitespace-nowrap px-3 py-1.5 align-top font-mono font-medium text-slate-600 dark:text-slate-300">
                {h.key}
              </td>
              <td className="break-all px-3 py-1.5 align-top font-mono text-slate-500 dark:text-slate-400">
                {h.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
