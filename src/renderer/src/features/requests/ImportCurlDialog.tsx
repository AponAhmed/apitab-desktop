import { useEffect, useState } from 'react';
import { useRequestStore } from '@/stores/requestStore';
import { useDialogStore } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export function ImportCurlDialog() {
  const open = useDialogStore((s) => s.importCurlOpen);
  const close = useDialogStore((s) => s.closeImportCurl);
  const importCurl = useRequestStore((s) => s.importCurl);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open]);

  const submit = () => {
    const result = importCurl(text);
    if (result.ok) {
      toast.success('Imported from cURL');
      close();
    } else {
      setError(result.error ?? 'Could not parse the cURL command.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import from cURL"
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={text.trim() === ''}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Paste a cURL command to populate the URL, method, headers, auth and body.
        </p>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder={"curl -X POST https://api.example.com/users \\\n  -H 'Authorization: Bearer token' \\\n  -d '{\"name\":\"Ada\"}'"}
          className="min-h-[160px]"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}
