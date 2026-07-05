export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  /**
   * Opt-in flag: include this variable (with its value) when exporting or
   * sharing the collection it's used with. Defaults to false/unset — a
   * variable is never bundled into an export unless the user explicitly
   * marks it shareable, since values often hold secrets (tokens, keys).
   */
  shared?: boolean;
}

/**
 * A named set of variables, e.g. Development / Staging / Production.
 * Environments are always local-only — they typically hold secrets
 * (tokens, API keys) and are never synced to the team server. Individual
 * variables can still be opted into collection exports via `shared`.
 */
export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
  createdAt: number;
  updatedAt: number;
}
