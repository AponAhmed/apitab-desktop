import { Sparkles } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { MiniMarkdown } from '@/utils/miniMarkdown';
import { useWhatsNew } from '@/hooks/useWhatsNew';

/** Auto-shows once per update — see useWhatsNew()/main/autoUpdate.ts's pendingWhatsNew handling. */
export function WhatsNewDialog() {
  const { info, dismiss } = useWhatsNew();

  return (
    <Modal
      open={info != null}
      onClose={dismiss}
      title={
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand-500" />
          What&rsquo;s new in v{info?.version}
        </span>
      }
      footer={
        <Button size="sm" variant="primary" onClick={dismiss}>
          Got it
        </Button>
      }
    >
      <div className="max-h-[50vh] overflow-y-auto pr-1">
        {info?.releaseNotes ? (
          <MiniMarkdown text={info.releaseNotes} />
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You&rsquo;re now on the latest version.
          </p>
        )}
      </div>
    </Modal>
  );
}
