import { useRequestStore } from '@/stores/requestStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { COMMON_CONTENT_TYPES, COMMON_HEADERS } from '@/utils/ui';

export function HeadersTab() {
  const headers = useRequestStore((s) => s.request.headers);
  const updateHeader = useRequestStore((s) => s.updateHeader);
  const removeHeader = useRequestStore((s) => s.removeHeader);

  return (
    <div className="p-2.5">
      <KeyValueEditor
        rows={headers}
        onChange={updateHeader}
        onRemove={removeHeader}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        keySuggestions={COMMON_HEADERS}
        valueSuggestions={COMMON_CONTENT_TYPES}
      />
    </div>
  );
}
