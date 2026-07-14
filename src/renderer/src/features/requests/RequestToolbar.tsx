import { FilePlus2, Save, TerminalSquare } from 'lucide-react';
import { useRequestStore } from '@/stores/requestStore';
import { useDialogStore } from '@/stores/dialogStore';
import { useRequestActions } from '@/hooks/useRequestActions';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

export function RequestToolbar() {
  const name = useRequestStore((s) => s.request.name);
  const setName = useRequestStore((s) => s.setName);
  const savedRef = useRequestStore((s) => s.savedRef);
  const isDirty = useRequestStore((s) => s.isDirty);
  const newRequest = useRequestStore((s) => s.newRequest);
  const openImportCurl = useDialogStore((s) => s.openImportCurl);
  const { save } = useRequestActions();

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Untitled Request"
        className="min-w-0 flex-1 truncate bg-transparent text-sm font-semibold text-slate-700 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
        aria-label="Request name"
      />
      {savedRef && isDirty && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
          title="Unsaved changes — saving shortly"
          aria-label="Unsaved changes"
        />
      )}
      {savedRef && !isDirty && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Saved
        </span>
      )}
      <IconButton onClick={openImportCurl} title="Import cURL" aria-label="Import cURL">
        <TerminalSquare className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={newRequest} title="New request (Ctrl+Alt+N)" aria-label="New request">
        <FilePlus2 className="h-4 w-4" />
      </IconButton>
      <Button variant="secondary" size="sm" onClick={save} title="Save request (Ctrl+S)">
        <Save className="h-3.5 w-3.5" />
        Save
      </Button>
    </div>
  );
}
