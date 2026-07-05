import { AlertTriangle, Clock, HardDrive, Inbox } from 'lucide-react';
import { useRequestStore, type ResponseTab } from '@/stores/requestStore';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ResponseBody } from './response/ResponseBody';
import { ResponseHeadersView } from './response/ResponseHeadersView';
import { CurlView } from './response/CurlView';
import { CodeView } from './response/CodeView';
import { TestResultsView } from './response/TestResultsView';
import { formatBytes, formatDuration } from '@/utils/format';
import type { ApiErrorType } from '@/types';

const ERROR_TITLES: Record<ApiErrorType, string> = {
  network: 'Network Error',
  cors: 'CORS Error',
  timeout: 'Request Timed Out',
  abort: 'Request Cancelled',
  'invalid-url': 'Invalid URL',
  unknown: 'Request Failed',
};

function ResponseTabContent() {
  const response = useRequestStore((s) => s.response);
  const error = useRequestStore((s) => s.error);
  const isLoading = useRequestStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Spinner /> Sending request…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="font-medium text-red-600 dark:text-red-400">{ERROR_TITLES[error.type]}</p>
        <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {error.message}
        </p>
      </div>
    );
  }
  if (response) return <ResponseBody response={response} />;
  return (
    <EmptyState
      icon={Inbox}
      title="No response yet"
      description="Send a request to see the response here."
    />
  );
}

export function ResponsePanel() {
  const response = useRequestStore((s) => s.response);
  const scriptRun = useRequestStore((s) => s.scriptRun);
  const tab = useRequestStore((s) => s.activeResponseTab);
  const setTab = useRequestStore((s) => s.setResponseTab);

  const allTests = [
    ...(scriptRun?.pre?.tests ?? []),
    ...(scriptRun?.post?.tests ?? []),
  ];
  const testsBadge =
    allTests.length > 0
      ? `${allTests.filter((t) => t.passed).length}/${allTests.length}`
      : undefined;

  const tabs: TabItem<ResponseTab>[] = [
    { id: 'body', label: 'Response' },
    { id: 'headers', label: 'Headers', badge: response?.headers.length || undefined },
    { id: 'curl', label: 'cURL' },
    { id: 'code', label: 'Code' },
    { id: 'tests', label: 'Tests', badge: testsBadge },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pr-3 dark:border-slate-800">
        <Tabs tabs={tabs} active={tab} onChange={setTab} bordered={false} className="px-2" />
        {response && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <StatusBadge status={response.status} statusText={response.statusText} />
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(response.timeMs)}
            </span>
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <HardDrive className="h-3.5 w-3.5" />
              {formatBytes(response.sizeBytes)}
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2.5">
        {tab === 'body' && <ResponseTabContent />}
        {tab === 'headers' &&
          (response ? (
            <ResponseHeadersView headers={response.headers} />
          ) : (
            <EmptyState icon={Inbox} title="No response headers yet" />
          ))}
        {tab === 'curl' && <CurlView />}
        {tab === 'code' && <CodeView />}
        {tab === 'tests' && <TestResultsView />}
      </div>
    </div>
  );
}
