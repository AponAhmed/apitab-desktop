import { useRequestStore } from '@/stores/requestStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { COMMON_HEADERS, headerValueSuggestions } from '@/utils/ui';

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
        valueSuggestionsForKey={headerValueSuggestions}
        showNotes
      />
    </div>
  );
}
