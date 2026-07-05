import { Workspace } from '@/features/layout/Workspace';
import { OptionsPage } from '@/pages/OptionsPage';
import { useDialogStore } from '@/stores/dialogStore';

export default function App() {
  const settingsOpen = useDialogStore((s) => s.settingsOpen);
  const closeSettings = useDialogStore((s) => s.closeSettings);

  return (
    <>
      <Workspace />
      {settingsOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <OptionsPage onClose={closeSettings} />
        </div>
      )}
    </>
  );
}
