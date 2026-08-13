import { useState } from 'react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { CodeBlock } from '@/components/CodeBlock';
import { ResponseHeadersView } from '@/features/requests/response/ResponseHeadersView';
import { ResponseBody } from '@/features/requests/response/ResponseBody';
import { EmptyState } from '@/components/ui/EmptyState';
import { LOG_COLOR } from '@/utils/consoleLog';
import { formatJson, looksLikeJson } from '@/utils/json';
import { Terminal } from 'lucide-react';
import type { ConsoleEntry } from '@/types';

type DetailTab = 'request' | 'response' | 'console';

function bodyText(body: string | null): string {
  if (!body) return '';
  return looksLikeJson(body) ? formatJson(body).value : body;
}

export function ConsoleEntryDetail({ entry }: { entry: ConsoleEntry }) {
  const [tab, setTab] = useState<DetailTab>('request');

  const tabs: TabItem<DetailTab>[] = [
    { id: 'request', label: 'Request' },
    { id: 'response', label: 'Response' },
    { id: 'console', label: 'Console', badge: entry.scriptLogs.length || undefined },
  ];

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-2 pb-3 pt-1 dark:border-slate-800/60 dark:bg-slate-950/40">
      <Tabs tabs={tabs} active={tab} onChange={setTab} size="sm" />

      <div className="mt-2 max-h-72 overflow-auto">
        {tab === 'request' && (
          <div className="space-y-2">
            <ResponseHeadersView headers={entry.prepared.headers} emptyTitle="No request headers" />
            {entry.prepared.body && (
              <>
                <CodeBlock code={bodyText(entry.prepared.body)} copyValue={entry.prepared.body} className="max-h-40" />
                {entry.requestBodyTruncated && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Body truncated for display (exceeds console size cap).
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'response' &&
          (entry.response ? (
            <div className="space-y-2">
              {entry.response.redirected && (
                <p className="rounded-md bg-sky-50 px-2 py-1 text-[11px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  Redirected to: {entry.response.finalUrl}
                </p>
              )}
              <ResponseHeadersView headers={entry.response.headers} />
              <div className="h-40">
                <ResponseBody response={entry.response} />
              </div>
              {entry.responseBodyTruncated && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Body truncated for display (exceeds console size cap).
                </p>
              )}
            </div>
          ) : (
            <p className="px-1 py-2 text-xs text-red-600 dark:text-red-400">
              {entry.error?.message ?? 'No response.'}
            </p>
          ))}

        {tab === 'console' &&
          (entry.scriptLogs.length === 0 ? (
            <EmptyState icon={Terminal} title="No console output" />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950">
              {entry.scriptLogs.map((l, i) => (
                <div key={i} className={`whitespace-pre-wrap break-words ${LOG_COLOR[l.level]}`}>
                  <span className="opacity-60">[{l.phase}]</span> {l.text}
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
