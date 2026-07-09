import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import { useRequestStore } from '@/stores/requestStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { validateJson } from '@/utils/json';
import { METHODS_WITH_BODY, type BodyType } from '@/types';

const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'json', label: 'JSON' },
  { id: 'raw', label: 'Raw' },
  { id: 'form-urlencoded', label: 'Form URL Encoded' },
  { id: 'form-data', label: 'Form Data' },
];

function JsonBody() {
  const json = useRequestStore((s) => s.request.body.json);
  const setJsonBody = useRequestStore((s) => s.setJsonBody);
  const formatJsonBody = useRequestStore((s) => s.formatJsonBody);
  const validation = validateJson(json);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={formatJsonBody} disabled={json.trim() === ''}>
          <Wand2 className="h-3.5 w-3.5" />
          Beautify
        </Button>
        {json.trim() !== '' &&
          (validation.valid ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" /> Invalid JSON
            </span>
          ))}
      </div>
      <Textarea
        value={json}
        onChange={(e) => setJsonBody(e.target.value)}
        placeholder={'{\n  "name": "Ada",\n  "active": true\n}'}
        className={cn(
          'min-h-[220px] flex-1',
          json.trim() !== '' && !validation.valid && 'border-red-400 focus:border-red-400 focus:ring-red-400/25',
        )}
      />
      {json.trim() !== '' && !validation.valid && validation.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{validation.error}</p>
      )}
    </div>
  );
}

function RawBody() {
  const raw = useRequestStore((s) => s.request.body.raw);
  const setRawBody = useRequestStore((s) => s.setRawBody);
  return (
    <Textarea
      value={raw}
      onChange={(e) => setRawBody(e.target.value)}
      placeholder="Raw request body…"
      className="min-h-[220px]"
    />
  );
}

function FormUrlEncodedBody() {
  const rows = useRequestStore((s) => s.request.body.formUrlEncoded);
  const update = useRequestStore((s) => s.updateFormUrlEncoded);
  const remove = useRequestStore((s) => s.removeFormUrlEncoded);
  return <KeyValueEditor rows={rows} onChange={update} onRemove={remove} keyPlaceholder="Field" showNotes />;
}

function FormDataBody() {
  const rows = useRequestStore((s) => s.request.body.formData);
  const update = useRequestStore((s) => s.updateFormData);
  const remove = useRequestStore((s) => s.removeFormData);
  return <KeyValueEditor rows={rows} onChange={update} onRemove={remove} keyPlaceholder="Field" showNotes />;
}

export function BodyTab() {
  const type = useRequestStore((s) => s.request.body.type);
  const method = useRequestStore((s) => s.request.method);
  const setBodyType = useRequestStore((s) => s.setBodyType);
  const bodyIgnored = !METHODS_WITH_BODY.includes(method);

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {BODY_TYPES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBodyType(b.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              type === b.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {bodyIgnored && type !== 'none' && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          {method} requests are sent without a body.
        </p>
      )}

      <div className="min-h-0 flex-1">
        {type === 'none' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">This request has no body.</p>
        )}
        {type === 'json' && <JsonBody />}
        {type === 'raw' && <RawBody />}
        {type === 'form-urlencoded' && <FormUrlEncodedBody />}
        {type === 'form-data' && <FormDataBody />}
      </div>
    </div>
  );
}
