import { useState } from 'react';
import { Info, PanelLeft, Settings } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useDialogStore } from '@/stores/dialogStore';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/Logo';
import { AboutDialog } from '@/components/AboutDialog';
import { EnvironmentSelector } from '@/features/environments/EnvironmentSelector';
import { TeamSelector, SyncButton, AccountAvatar } from '@/features/account/AccountMenu';
import { LoginDialog } from '@/features/account/LoginDialog';
import { PendingAssignmentsBell } from '@/components/PendingAssignmentsBell';

/** Shared "clustered & bordered" pill styling for the context/utility control groups. */
const CLUSTER =
  'flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-800 dark:bg-white/[0.04]';

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openSettings = useDialogStore((s) => s.openSettings);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-[#0f111a]">
      <IconButton title="Toggle sidebar" aria-label="Toggle sidebar" onClick={toggleSidebar}>
        <PanelLeft className="h-4 w-4" />
      </IconButton>

      <div className="ml-1 flex items-center gap-2 text-brand-500">
        <Logo className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
          ApiTab
        </span>
      </div>

      <div className="flex-1" />

      <div className="mr-2 flex items-center gap-2">
        {/* Context: what you're working in. */}
        <div className={CLUSTER}>
          <EnvironmentSelector />
          <div className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <TeamSelector />
        </div>

        {/* Utilities: sync, notifications, app-level actions. */}
        <div className={CLUSTER}>
          <SyncButton />
          <PendingAssignmentsBell />
          <IconButton size="sm" title="About" aria-label="About ApiTab" onClick={() => setAboutOpen(true)}>
            <Info className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" title="Settings" aria-label="Open settings" onClick={openSettings}>
            <Settings className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <AccountAvatar />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <LoginDialog />
    </header>
  );
}
