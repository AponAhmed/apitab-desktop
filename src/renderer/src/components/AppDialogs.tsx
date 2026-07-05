import { SaveRequestDialog } from '@/features/requests/SaveRequestDialog';
import { ImportCurlDialog } from '@/features/requests/ImportCurlDialog';

/** Mounts the app-level dialogs once; visibility is driven by the dialog store. */
export function AppDialogs() {
  return (
    <>
      <SaveRequestDialog />
      <ImportCurlDialog />
    </>
  );
}
