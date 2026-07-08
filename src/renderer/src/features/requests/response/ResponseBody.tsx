import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { CodeBlock } from '@/components/CodeBlock';
import { formatJson, looksLikeJson } from '@/utils/json';
import { highlightJson } from '@/utils/highlight';
import { ResponseTable } from './ResponseTable';
import type { ApiResponse } from '@/types';

type JsonView = 'pretty' | 'raw' | 'table';
type HtmlView = 'preview' | 'raw';

/** True when the body looks like an HTML document, by content-type or a sniff of the leading markup. */
function looksLikeHtml(contentType: string, body: string): boolean {
  if (contentType.includes('html')) return true;
  return /^\s*(<!doctype\s+html|<html[\s>])/i.test(body);
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors',
        active
          ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
      )}
    >
      {children}
    </button>
  );
}

export function ResponseBody({ response }: { response: ApiResponse }) {
  const isJson = response.contentType.includes('json') || looksLikeJson(response.body);
  const isHtml = !isJson && looksLikeHtml(response.contentType, response.body);

  const [jsonView, setJsonView] = useState<JsonView>('pretty');
  const [htmlView, setHtmlView] = useState<HtmlView>('preview');

  const pretty = useMemo(() => {
    if (!isJson) return response.body;
    const result = formatJson(response.body);
    return result.ok ? result.value : response.body;
  }, [response.body, isJson]);

  const html = useMemo(
    () => (jsonView === 'pretty' && isJson ? highlightJson(pretty) : undefined),
    [jsonView, isJson, pretty],
  );

  if (response.body === '') {
    return (
      <div className="grid h-full place-items-center text-xs text-slate-400 dark:text-slate-500">
        Empty response body
      </div>
    );
  }

  if (isHtml) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-1">
          {(['preview', 'raw'] as HtmlView[]).map((v) => (
            <TabButton key={v} active={htmlView === v} onClick={() => setHtmlView(v)}>
              {v}
            </TabButton>
          ))}
        </div>
        {htmlView === 'preview' ? (
          <iframe
            title="HTML response preview"
            srcDoc={response.body}
            // Fully sandboxed — API response bodies are untrusted content,
            // so scripts/forms/same-origin access/navigation are all denied.
            sandbox=""
            className="h-full w-full flex-1 rounded-lg border border-slate-200 bg-white dark:border-slate-800"
          />
        ) : (
          <CodeBlock code={response.body} copyValue={response.body} wrap className="flex-1" />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {isJson && (
        <div className="flex items-center gap-1">
          {(['pretty', 'raw', 'table'] as JsonView[]).map((v) => (
            <TabButton key={v} active={jsonView === v} onClick={() => setJsonView(v)}>
              {v}
            </TabButton>
          ))}
        </div>
      )}
      {isJson && jsonView === 'table' ? (
        <ResponseTable json={response.body} />
      ) : (
        <CodeBlock
          code={jsonView === 'pretty' ? pretty : response.body}
          html={html}
          copyValue={jsonView === 'pretty' ? pretty : response.body}
          wrap={jsonView === 'raw' || !isJson}
          className="flex-1"
        />
      )}
    </div>
  );
}
