import { useMemo, useState } from 'react';
import { useRequestStore } from '@/stores/requestStore';
import { useActiveVariables } from '@/hooks/useActiveVariables';
import { prepareRequest } from '@/services/requestService';
import { generateSnippet, SNIPPETS, type SnippetLanguage } from '@/utils/snippets';
import { CodeBlock } from '@/components/CodeBlock';
import { cn } from '@/utils/cn';

export function CodeView() {
  const request = useRequestStore((s) => s.request);
  const vars = useActiveVariables();
  const [lang, setLang] = useState<SnippetLanguage>('fetch');

  const code = useMemo(
    () => generateSnippet(lang, prepareRequest(request, vars)),
    [lang, request, vars],
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {SNIPPETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setLang(s.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              lang === s.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <CodeBlock code={code} copyValue={code} className="flex-1" />
    </div>
  );
}
