import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { CodeBlock } from '@/components/CodeBlock';
import { formatJson, looksLikeJson } from '@/utils/json';
import { highlightJson } from '@/utils/highlight';
import type { ApiResponse } from '@/types';

type View = 'pretty' | 'raw';

export function ResponseBody({ response }: { response: ApiResponse }) {
  const isJson =
    response.contentType.includes('json') || looksLikeJson(response.body);
  const [view, setView] = useState<View>(isJson ? 'pretty' : 'raw');

  const pretty = useMemo(() => {
    if (!isJson) return response.body;
    const result = formatJson(response.body);
    return result.ok ? result.value : response.body;
  }, [response.body, isJson]);

  const html = useMemo(
    () => (view === 'pretty' && isJson ? highlightJson(pretty) : undefined),
    [view, isJson, pretty],
  );

  if (response.body === '') {
    return (
      <div className="grid h-full place-items-center text-xs text-slate-400 dark:text-slate-500">
        Empty response body
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {isJson && (
        <div className="flex items-center gap-1">
          {(['pretty', 'raw'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      <CodeBlock
        code={view === 'pretty' ? pretty : response.body}
        html={html}
        copyValue={view === 'pretty' ? pretty : response.body}
        wrap={view === 'raw'}
        className="flex-1"
      />
    </div>
  );
}
