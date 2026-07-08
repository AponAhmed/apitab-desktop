import type { ClipboardEvent } from 'react';
import { Send } from 'lucide-react';
import { HTTP_METHODS, type HttpMethod } from '@/types';
import { useRequestStore } from '@/stores/requestStore';
import { toast } from '@/stores/toastStore';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { VariableInput } from '@/components/VariableInput';
import { Spinner } from '@/components/ui/Spinner';
import { methodColor } from '@/utils/ui';
import { cn } from '@/utils/cn';

export function UrlBar() {
  const method = useRequestStore((s) => s.request.method);
  const url = useRequestStore((s) => s.request.url);
  const isLoading = useRequestStore((s) => s.isLoading);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const send = useRequestStore((s) => s.send);
  const importCurl = useRequestStore((s) => s.importCurl);

  // Pasting a cURL command into the URL field imports it automatically.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/^\s*curl\s/i.test(text)) {
      e.preventDefault();
      const result = importCurl(text);
      if (result.ok) toast.success('Imported from cURL');
      else toast.error(result.error ?? 'Could not parse cURL');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={method}
        onChange={(e) => setMethod(e.target.value as HttpMethod)}
        mono
        className={cn('w-[104px] font-bold', methodColor(method))}
        aria-label="HTTP method"
      >
        {HTTP_METHODS.map((m) => (
          <option key={m} value={m} className={cn('font-bold', methodColor(m))}>
            {m}
          </option>
        ))}
      </Select>

      <VariableInput
        value={url}
        onValueChange={setUrl}
        onPaste={onPaste}
        placeholder="https://api.example.com  or  {{base_url}}/users"
        className="flex-1"
        aria-label="Request URL"
        highlightPathVars
      />

      <Button
        variant="primary"
        onClick={() => void send()}
        disabled={isLoading || url.trim() === ''}
        className="min-w-[92px]"
      >
        {isLoading ? <Spinner className="text-white" /> : <Send className="h-4 w-4" />}
        {isLoading ? 'Sending' : 'Send'}
      </Button>
    </div>
  );
}
