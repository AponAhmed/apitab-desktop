import { useEnvironmentStore } from '@/stores/environmentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHistoryStore } from '@/stores/historyStore';
import { uuid } from '@/utils/id';
import { applyEnvUpdates, executeRequest, prepareRequest } from './requestService';
import { runScript } from './scriptRunner';
import type { ApiError, ApiRequest, ApiResponse, ScriptRunResult } from '@/types';

export interface RunnerRequestResult {
  request: ApiRequest;
  response: ApiResponse | null;
  error: ApiError | null;
  scriptRun: ScriptRunResult | null;
  durationMs: number;
}

export interface RunnerSummary {
  total: number;
  testsPassed: number;
  testsFailed: number;
  /** Requests that errored (network/timeout/thrown script) rather than just failing a test assertion. */
  requestsFailed: number;
}

function headersToRecord(headers: { key: string; value: string }[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const h of headers) record[h.key] = h.value;
  return record;
}

/**
 * Sequentially executes every request in `requests` against the currently
 * active environment, running each request's pre/post scripts exactly like
 * a normal Send (requestStore.ts's send()) — including applying env updates
 * via the shared applyEnvUpdates, so a variable a later request depends on
 * that an earlier request's script set is visible when it runs.
 */
export async function runCollection(
  requests: ApiRequest[],
  onProgress: (result: RunnerRequestResult, index: number) => void,
  shouldStop: () => boolean,
  { recordHistory = true }: { recordHistory?: boolean } = {},
): Promise<RunnerSummary> {
  const summary: RunnerSummary = { total: requests.length, testsPassed: 0, testsFailed: 0, requestsFailed: 0 };
  const timeout = useSettingsStore.getState().requestTimeoutMs;

  for (let i = 0; i < requests.length; i++) {
    if (shouldStop()) break;

    const request = requests[i];
    const envStore = useEnvironmentStore.getState();
    const activeEnvId = envStore.activeEnvironmentId;
    let vars = { ...envStore.getActiveVariables() };
    const scriptRun: ScriptRunResult = {};
    const startedAt = Date.now();

    let response: ApiResponse | null = null;
    let error: ApiError | null = null;
    let preparedUrl = request.url;

    try {
      if (request.scripts.preRequest.trim()) {
        const preview = prepareRequest(request, vars);
        scriptRun.pre = await runScript(request.scripts.preRequest, {
          request: { method: preview.method, url: preview.url, headers: headersToRecord(preview.headers) },
          environment: vars,
        });
        vars = applyEnvUpdates(vars, scriptRun.pre.envUpdates, activeEnvId);
      }

      const { prepared, result } = await executeRequest(request, vars, timeout);
      preparedUrl = prepared.url || request.url;

      if (result.ok) {
        response = result.response;

        if (request.scripts.postResponse.trim()) {
          scriptRun.post = await runScript(request.scripts.postResponse, {
            request: { method: prepared.method, url: prepared.url, headers: headersToRecord(prepared.headers) },
            response: {
              status: result.response.status,
              statusText: result.response.statusText,
              headers: result.response.headers,
              body: result.response.body,
              timeMs: result.response.timeMs,
              sizeBytes: result.response.sizeBytes,
            },
            environment: vars,
          });
          vars = applyEnvUpdates(vars, scriptRun.post.envUpdates, activeEnvId);
        }
      } else {
        error = result.error;
        summary.requestsFailed++;
      }
    } catch (err) {
      error = { type: 'unknown', message: (err as Error).message };
      summary.requestsFailed++;
    }

    const finalScriptRun = scriptRun.pre || scriptRun.post ? scriptRun : null;
    const tests = [...(finalScriptRun?.pre?.tests ?? []), ...(finalScriptRun?.post?.tests ?? [])];
    summary.testsPassed += tests.filter((t) => t.passed).length;
    summary.testsFailed += tests.filter((t) => !t.passed).length;

    const durationMs = Date.now() - startedAt;
    onProgress({ request, response, error, scriptRun: finalScriptRun, durationMs }, i);

    if (recordHistory) {
      useHistoryStore.getState().addEntry(
        {
          id: uuid(),
          method: request.method,
          url: preparedUrl,
          timestamp: Date.now(),
          status: response?.status,
          request: structuredClone(request),
          response,
          error,
          scriptRun: finalScriptRun,
        },
        useSettingsStore.getState().historyLimit,
      );
    }
  }

  return summary;
}
