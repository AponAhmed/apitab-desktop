import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Database,
  Download,
  ExternalLink,
  GitBranch,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useApplyTheme } from '@/hooks/useApplyTheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { useTeamVariablesStore } from '@/stores/teamVariablesStore';
import { useDialogStore } from '@/stores/dialogStore';
import { apiClient } from '@/services/apiClient';
import { clearTeamCollectionsOnLogout, runAllTeamsSync } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Toaster } from '@/components/Toaster';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/Logo';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoginDialog } from '@/features/account/LoginDialog';
import { ChangePasswordDialog } from '@/features/account/ChangePasswordDialog';
import { ABOUT } from '@/config/about';
import {
  backupFilename,
  buildBackup,
  downloadJson,
  parseBackup,
  readFileAsText,
} from '@/services/backup';
import { cn } from '@/utils/cn';
import type { ThemeMode } from '@/types';

type SectionId = 'general' | 'account' | 'data' | 'about';

const NAV_ITEMS: { id: SectionId; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'account', label: 'Account & Teams', icon: Users },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const SHORTCUTS = [
  ['Send request', 'Ctrl + Enter'],
  ['Save request', 'Ctrl + S'],
  ['Copy as cURL', 'Ctrl + Shift + K'],
  ['New request', 'Ctrl + Alt + N'],
  ['Open ApiTab', 'Ctrl + Shift + U'],
];

/** Small uppercase group label ("APPEARANCE", "REQUESTS", …) above a cluster of controls. */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {children}
    </h3>
  );
}

/** Page-level header inside the content pane: section title + one-line description. */
function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}

export function OptionsPage({ onClose }: { onClose?: () => void }) {
  useApplyTheme();
  const [section, setSection] = useState<SectionId>('general');
  const isMac = window.api.platform === 'darwin';

  const [version, setVersion] = useState('');
  useEffect(() => {
    void window.api.app.getVersion().then(setVersion);
  }, []);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const timeoutMs = useSettingsStore((s) => s.requestTimeoutMs);
  const setRequestTimeout = useSettingsStore((s) => s.setRequestTimeout);
  const historyLimit = useSettingsStore((s) => s.historyLimit);
  const setHistoryLimit = useSettingsStore((s) => s.setHistoryLimit);

  const session = useAccountStore((s) => s.session);
  const clearSession = useAccountStore((s) => s.clearSession);
  const teams = useTeamStore((s) => s.teams);
  const isSyncing = useTeamStore((s) => s.isSyncing);
  const syncError = useTeamStore((s) => s.lastSyncError);
  const resetTeams = useTeamStore((s) => s.reset);
  const openLogin = useDialogStore((s) => s.openLogin);

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Token may already be invalid server-side — clear locally regardless.
    }
    clearSession();
    resetTeams();
    useTeamVariablesStore.getState().reset();
    clearTeamCollectionsOnLogout();
    toast.info('Logged out');
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const exportData = () => {
    const data = buildBackup({
      collections: useCollectionStore.getState().collections,
      environments: useEnvironmentStore.getState().environments,
      history: useHistoryStore.getState().entries,
      settings: useSettingsStore.getState(),
    });
    downloadJson(backupFilename(), data);
    toast.success('Backup exported');
  };

  const importData = async (file: File) => {
    try {
      const parsed = parseBackup(await readFileAsText(file));
      if (!parsed.ok || !parsed.data) {
        toast.error(parsed.error ?? 'Invalid backup file');
        return;
      }
      const { data } = parsed;
      useCollectionStore.getState().mergeImported(data.collections);
      useEnvironmentStore.getState().mergeImported(data.environments);
      if (data.history) useHistoryStore.getState().replaceAll(data.history);
      if (data.settings) useSettingsStore.getState().importSettings(data.settings);
      toast.success('Backup imported');
    } catch {
      toast.error('Could not read the file');
    }
  };

  const clearAll = async () => {
    await window.api.storage.clear();
    location.reload();
  };

  return (
    <div className="flex h-screen bg-white text-slate-800 dark:bg-[#0f111a] dark:text-slate-200">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
        {/* On macOS the native traffic-light buttons (main/index.ts's
            trafficLightPosition) sit at a fixed window-level position —
            they aren't part of this page's DOM, so nothing here naturally
            avoids them the way TopBar.tsx's own layout does. This overlay
            covers TopBar entirely, so without extra top padding here the
            traffic lights render directly over the logo/title below. */}
        <div className={cn('flex items-center gap-2.5 px-5 py-5', isMac && 'pt-11')}>
          <Logo className="h-8 w-8" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
              ApiTab Settings
            </h1>
            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
              Lightweight, local-first API testing
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                section === item.id
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 text-xs text-slate-400 dark:text-slate-500">
          ApiTab v{version} · {ABOUT.license} License
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        {onClose && (
          <IconButton
            title="Close settings"
            aria-label="Close settings"
            onClick={onClose}
            className="absolute right-6 top-6"
          >
            <X className="h-4 w-4" />
          </IconButton>
        )}

        <div className="mx-auto max-w-3xl px-10 py-10">
          {section === 'general' && (
            <>
              <SectionHeader title="General" description="Appearance and request defaults." />

              <div className="space-y-8">
                <div>
                  <GroupLabel>Appearance</GroupLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                          theme === t.id
                            ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60',
                        )}
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <GroupLabel>Requests</GroupLabel>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Request timeout (seconds)
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        value={Math.round(timeoutMs / 1000)}
                        onChange={(e) =>
                          setRequestTimeout(Math.max(1, Number(e.target.value) || 1) * 1000)
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        History limit (entries)
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={historyLimit}
                        onChange={(e) => setHistoryLimit(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {section === 'account' && (
            <>
              <SectionHeader
                title="Account & Teams"
                description="Log in to share collections with a team. Environments are never sent to the server — only collections you explicitly share."
              />

              {!session ? (
                <Button variant="outline" onClick={openLogin}>
                  <LogIn className="h-4 w-4" />
                  Log in / Create account
                </Button>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase text-slate-800 dark:text-slate-100">
                        {session.user.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {session.user.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setChangePasswordOpen(true)}>
                        <KeyRound className="h-3.5 w-3.5" />
                        Change password
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void logout()}>
                        <LogOut className="h-3.5 w-3.5" />
                        Log out
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <Users className="h-3.5 w-3.5" />
                        Teams ({teams.length})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void runAllTeamsSync()}
                        disabled={isSyncing || teams.length === 0}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                        Sync now
                      </Button>
                    </div>
                    {teams.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No teams yet — create one from the account menu in the toolbar.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
                        {teams.map((t) => (
                          <li key={t.id} className="flex items-center justify-between px-3.5 py-2.5">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{t.name}</span>
                            <span className="text-xs capitalize text-slate-400">{t.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {syncError && (
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{syncError}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {section === 'data' && (
            <>
              <SectionHeader
                title="Data"
                description="Collections, environments, history and settings are stored locally on this machine."
              />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportData}>
                  <Download className="h-4 w-4" />
                  Export backup
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Import backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importData(file);
                    e.target.value = '';
                  }}
                />
                <Button variant="danger" onClick={() => setClearOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Clear all data
                </Button>
              </div>
            </>
          )}

          {section === 'about' && (
            <>
              <SectionHeader
                title="About"
                description="Who built this, keyboard shortcuts, and what's under the hood."
              />

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {ABOUT.developer.name}
                      </p>
                      {ABOUT.developer.role && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {ABOUT.developer.role}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {ABOUT.developer.email && (
                        <a
                          href={`mailto:${ABOUT.developer.email}`}
                          title={ABOUT.developer.email}
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {ABOUT.developer.github && (
                        <a
                          href={ABOUT.developer.github}
                          target="_blank"
                          rel="noreferrer"
                          title="GitHub"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <GitBranch className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <a
                    href={ABOUT.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <GitBranch className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {ABOUT.repoUrl.replace(/^https?:\/\//, '')}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ABOUT.techStack.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <GroupLabel>Keyboard Shortcuts</GroupLabel>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
                    {SHORTCUTS.map(([label, keys]) => (
                      <li key={label} className="flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-slate-600 dark:text-slate-300">{label}</span>
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                          {keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-slate-400">
                  ApiTab v{version} · {ABOUT.license} License
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={clearOpen}
        title="Clear all data"
        message="This permanently deletes all collections, environments, history and settings. This cannot be undone."
        confirmLabel="Delete everything"
        onConfirm={clearAll}
        onClose={() => setClearOpen(false)}
      />
      <LoginDialog />
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <Toaster />
    </div>
  );
}
