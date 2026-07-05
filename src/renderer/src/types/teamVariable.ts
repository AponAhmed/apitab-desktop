/**
 * A team-wide shared key/value variable — the sync target for environment
 * variables explicitly flagged `shared`. Deliberately not tied to any one
 * environment: environments stay fully local/device-only, only the flagged
 * values ever leave the device (see EnvVariable.shared in ./environment).
 */
export interface TeamVariable {
  id: string;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}
