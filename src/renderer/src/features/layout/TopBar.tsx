import { useState } from 'react';
import { Info, Monitor, Moon, PanelLeft, Settings, Sun } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useDialogStore } from '@/stores/dialogStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/Logo';
import { AboutDialog } from '@/components/AboutDialog';
import { EnvironmentSelector } from '@/features/environments/EnvironmentSelector';
import { TeamSelector, SyncButton, AccountAvatar } from '@/features/account/AccountMenu';
import { LoginDialog } from '@/features/account/LoginDialog';
import { PendingAssignmentsBell } from '@/components/PendingAssignmentsBell';
import { UpdateAvailableBell } from '@/components/UpdateAvailableBell';
import { WindowControls } from '@/components/WindowControls';
import { useWindowControls } from '@/hooks/useWindowControls';

/** Shared "clustered & bordered" pill styling for the context/utility control groups. */
const CLUSTER =
  'flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-800 dark:bg-white/[0.04]';

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_ORDER = ['light', 'dark', 'system'] as const;

function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const Icon = THEME_ICONS[theme];
  return (
    <IconButton
      size="sm"
      title={`Theme: ${theme} (click to change)`}
      aria-label={`Theme: ${theme}`}
      onClick={() => {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
        useSettingsStore.getState().setTheme(next);
      }}
    >
      <Icon className="h-4 w-4" />
    </IconButton>
  );
}

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openSettings = useDialogStore((s) => s.openSettings);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { toggleMaximize } = useWindowControls();

  return (
    // The drag region for moving the window (frame: false — see main/index.ts).
    // Every interactive child below opts back out with no-drag, since a drag
    // region swallows clicks on anything inside it. Double-click-to-maximize
    // is native title-bar behavior a frameless window doesn't get for free.
    <header
      className="flex h-11 shrink-0 items-stretch border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0f111a] [-webkit-app-region:drag]"
      onDoubleClick={toggleMaximize}
    >
      <div className="flex flex-1 items-center gap-1.5 px-2.5">
        <div className="[-webkit-app-region:no-drag]">
          <IconButton size="sm" title="Toggle sidebar" aria-label="Toggle sidebar" onClick={toggleSidebar}>
            <PanelLeft className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex items-center gap-1.5 text-brand-500">
          <Logo className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
            ApiTab
          </span>
        </div>

        <div className="flex-1" />

        <div className="mr-1.5 flex items-center gap-1.5 [-webkit-app-region:no-drag]">
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
            <UpdateAvailableBell />
            <ThemeToggle />
            <IconButton size="sm" title="About" aria-label="About ApiTab" onClick={() => setAboutOpen(true)}>
              <Info className="h-4 w-4" />
            </IconButton>
            <IconButton size="sm" title="Settings" aria-label="Open settings" onClick={openSettings}>
              <Settings className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="[-webkit-app-region:no-drag]">
          <AccountAvatar />
        </div>
      </div>

      <WindowControls />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <LoginDialog />
    </header>
  );
}
