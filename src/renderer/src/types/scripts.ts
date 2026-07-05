export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ConsoleLog {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

/** Result of running a single user script in the sandbox. */
export interface ScriptRun {
  tests: TestResult[];
  logs: ConsoleLog[];
  /** Environment variables the script set/unset (null = unset). */
  envUpdates: Record<string, string | null>;
  error?: string;
}

/** Read-only context handed to a script. */
export interface ScriptContext {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  response?: {
    status: number;
    statusText: string;
    headers: { key: string; value: string }[];
    body: string;
    timeMs: number;
    sizeBytes: number;
  };
  environment: Record<string, string>;
}

export interface ScriptRunResult {
  pre?: ScriptRun;
  post?: ScriptRun;
}
