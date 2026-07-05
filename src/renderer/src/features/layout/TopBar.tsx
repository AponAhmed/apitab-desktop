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

      <div className="mr-2 flex items-center gap-1.5">
        <EnvironmentSelector />
        <div className="mx-1.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <TeamSelector />
        <SyncButton />
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton title="About" aria-label="About ApiTab" onClick={() => setAboutOpen(true)}>
          <Info className="h-4 w-4" />
        </IconButton>
        <IconButton title="Settings" aria-label="Open settings" onClick={openSettings}>
          <Settings className="h-4 w-4" />
        </IconButton>
        <AccountAvatar />
      </div>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <LoginDialog />
    </header>
  );
}
