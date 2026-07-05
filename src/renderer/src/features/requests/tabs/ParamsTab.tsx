import { useRequestStore } from '@/stores/requestStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';

export function ParamsTab() {
  const params = useRequestStore((s) => s.request.params);
  const updateParam = useRequestStore((s) => s.updateParam);
  const removeParam = useRequestStore((s) => s.removeParam);

  return (
    <div className="space-y-2 p-2.5">
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
  );
}
