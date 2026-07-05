import { useMemo } from 'react';
import { useRequestStore } from '@/stores/requestStore';
import { useActiveVariables } from '@/hooks/useActiveVariables';
import { prepareRequest } from '@/services/requestService';
import { buildCurl } from '@/utils/curl';
import { CodeBlock } from '@/components/CodeBlock';

export function CurlView() {
  const request = useRequestStore((s) => s.request);
  const vars = useActiveVariables();
  const curl = useMemo(() => buildCurl(prepareRequest(request, vars)), [request, vars]);

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Generated from the current request (variables resolved).
      </p>
      <CodeBlock code={curl} copyValue={curl} wrap className="flex-1" />
    </div>
  );
}
