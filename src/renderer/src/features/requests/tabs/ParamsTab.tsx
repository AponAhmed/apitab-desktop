import { useRequestStore } from '@/stores/requestStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';

export function ParamsTab() {
  const params = useRequestStore((s) => s.request.params);
  const pathVariables = useRequestStore((s) => s.request.pathVariables);
  const updateParam = useRequestStore((s) => s.updateParam);
  const removeParam = useRequestStore((s) => s.removeParam);
  const updatePathVariable = useRequestStore((s) => s.updatePathVariable);

  return (
    <div className="space-y-4 p-2.5">
      <div className="space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Query parameters stay in sync with the URL above.
        </p>
        <KeyValueEditor
          rows={params}
          onChange={updateParam}
          onRemove={removeParam}
          keyPlaceholder="Parameter"
          valuePlaceholder="Value"
        />
      </div>

      {pathVariables.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Path Variables</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Detected from <code className="font-mono">:name</code> segments in the URL above — add
            or remove one there to change this list.
          </p>
          <KeyValueEditor
            rows={pathVariables}
            onChange={updatePathVariable}
            onRemove={() => {}}
            valuePlaceholder="Value"
            readOnlyKeys
            hideRemove
          />
        </div>
      )}
    </div>
  );
}
