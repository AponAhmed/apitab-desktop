import type { ScriptContext, ScriptRun } from '@/types';

export const SANDBOX_READY = 'apitab:sandbox-ready' as const;
export const SANDBOX_RUN = 'apitab:sandbox-run' as const;
export const SANDBOX_RESULT = 'apitab:sandbox-result' as const;

export interface SandboxReadyMessage {
  type: typeof SANDBOX_READY;
}

export interface SandboxRunMessage {
  type: typeof SANDBOX_RUN;
  id: string;
  code: string;
  context: ScriptContext;
}

export interface SandboxResultMessage {
  type: typeof SANDBOX_RESULT;
  id: string;
  result: ScriptRun;
}
