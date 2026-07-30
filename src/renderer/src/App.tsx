import { Workspace } from '@/features/layout/Workspace';
import { OptionsPage } from '@/pages/OptionsPage';
import { WhatsNewDialog } from '@/components/WhatsNewDialog';
import { useDialogStore } from '@/stores/dialogStore';

export default function App() {
  const settingsOpen = useDialogStore((s) => s.settingsOpen);
  const closeSettings = useDialogStore((s) => s.closeSettings);

  return (
    <>
      <Workspace />
      {settingsOpen && <OptionsPage onClose={closeSettings} />}
      <WhatsNewDialog />
    </>
  );
}
