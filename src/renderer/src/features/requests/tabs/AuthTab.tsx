import type { ReactNode } from 'react';
import { useRequestStore } from '@/stores/requestStore';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { VariableInput } from '@/components/VariableInput';
import type { AuthType } from '@/types';

const AUTH_LABELS: Record<AuthType, string> = {
  none: 'No Auth',
  bearer: 'Bearer Token',
  basic: 'Basic Auth',
  apikey: 'API Key',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AuthTab() {
  const auth = useRequestStore((s) => s.request.auth);
  const setAuthType = useRequestStore((s) => s.setAuthType);
  const setBearerToken = useRequestStore((s) => s.setBearerToken);
  const setBasicAuth = useRequestStore((s) => s.setBasicAuth);
  const setApiKeyAuth = useRequestStore((s) => s.setApiKeyAuth);

  return (
    <div className="max-w-xl space-y-3 p-2.5">
      <Field label="Auth Type">
        <Select
          value={auth.type}
          onChange={(e) => setAuthType(e.target.value as AuthType)}
          className="max-w-xs"
        >
          {(Object.keys(AUTH_LABELS) as AuthType[]).map((t) => (
            <option key={t} value={t}>
              {AUTH_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      {auth.type === 'none' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This request does not use any authorization.
        </p>
      )}

      {auth.type === 'bearer' && (
        <Field label="Token">
          <VariableInput
            value={auth.bearer.token}
            onValueChange={setBearerToken}
            placeholder="{{token}}"
          />
        </Field>
      )}

      {auth.type === 'basic' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Username">
            <Input
              value={auth.basic.username}
              onChange={(e) => setBasicAuth({ username: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={auth.basic.password}
              onChange={(e) => setBasicAuth({ password: e.target.value })}
            />
          </Field>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Key">
              <Input
                mono
                value={auth.apiKey.key}
                placeholder="X-API-Key"
                onChange={(e) => setApiKeyAuth({ key: e.target.value })}
              />
            </Field>
            <Field label="Value">
              <VariableInput
                value={auth.apiKey.value}
                onValueChange={(v) => setApiKeyAuth({ value: v })}
                placeholder="{{api_key}}"
              />
            </Field>
          </div>
          <Field label="Add to">
            <Select
              value={auth.apiKey.addTo}
              onChange={(e) => setApiKeyAuth({ addTo: e.target.value as 'header' | 'query' })}
              className="max-w-xs"
            >
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}
