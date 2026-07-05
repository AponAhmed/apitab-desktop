import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, RefreshCw, UserPlus, Users, LogOut, Settings as SettingsIcon, UsersRound, Monitor, Sun, Moon } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { useTeamVariablesStore } from '@/stores/teamVariablesStore';
import { useDialogStore } from '@/stores/dialogStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/services/apiClient';
import { runAllTeamsSync } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { PromptDialog } from '@/components/PromptDialog';
import { ManageTeamDialog } from './ManageTeamDialog';
import { cn } from '@/utils/cn';

const NEW_TEAM = '__new_team__';

export function TeamSelector() {
  const teams = useTeamStore((s) => s.teams);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const setTeams = useTeamStore((s) => s.setTeams);
  const [createOpen, setCreateOpen] = useState(false);

  const createTeam = async (name: string) => {
    try {
      const created = await apiClient.createTeam(name);
      setTeams([...teams, created]);
      setActiveTeam(created.id);
      toast.success(`Created "${created.name}"`);
    } catch {
      toast.error('Could not create team');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5" title="Active workspace">
        <Users className="h-4 w-4 shrink-0 text-slate-400" />
        {teams.length > 0 ? (
          <Select
            value={activeTeamId ?? ''}
            onChange={(e) => {
              if (e.target.value === NEW_TEAM) setCreateOpen(true);
              else setActiveTeam(e.target.value || null);
            }}
            className="h-8 w-32 text-xs border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 shadow-none focus:ring-0"
            aria-label="Active team"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={NEW_TEAM}>+ New workspace…</option>
          </Select>
        ) : (
          <IconButton size="sm" title="Create a workspace" aria-label="Create a workspace" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>

      <PromptDialog
        open={createOpen}
        title="Create Workspace"
        label="Workspace name"
        placeholder="My Workspace"
        confirmLabel="Create"
        onConfirm={(v) => void createTeam(v)}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}

export function SyncButton() {
  const isSyncing = useTeamStore((s) => s.isSyncing);
  return (
    <IconButton
      size="sm"
      title="Sync now"
      aria-label="Sync now"
      onClick={() => void runAllTeamsSync()}
      disabled={isSyncing}
    >
      <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
    </IconButton>
  );
}

export function AccountAvatar() {
  const session = useAccountStore((s) => s.session);
  const clearSession = useAccountStore((s) => s.clearSession);
  const openLogin = useDialogStore((s) => s.openLogin);
  const openSettings = useDialogStore((s) => s.openSettings);
  const resetTeams = useTeamStore((s) => s.reset);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teams = useTeamStore((s) => s.teams);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const canManageTeam = activeTeam?.role === 'owner' || activeTeam?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  // Every hook must run unconditionally on every render — the `!session`
  // early return below must come after all hook calls, not before.
  const theme = useSettingsStore((s) => s.theme);

  if (!session) {
    return (
      <Button variant="outline" size="sm" onClick={openLogin}>
        <LogIn className="h-3.5 w-3.5" />
        Log in
      </Button>
    );
  }

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {}
    clearSession();
    resetTeams();
    useTeamVariablesStore.getState().reset();
    toast.info('Logged out');
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ x: r.right - 200, y: r.bottom + 8 });
    setOpen((o) => !o);
  };

  const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
  const ThemeIcon = ICONS[theme];

  const initial = session.user.name ? session.user.name.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
        aria-label="Account menu"
      >
        {initial}
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} onContextMenu={(e) => { e.preventDefault(); setOpen(false); }} />
            <div
              style={{ position: 'fixed', left: pos.x, top: pos.y, width: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-[#151722]"
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white shrink-0">
                    {initial}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{session.user.name}</span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{session.user.email}</span>
                  </div>
                </div>
              </div>

              <div className="px-1.5 py-1">
                {canManageTeam && (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
                    onClick={() => {
                      setOpen(false);
                      setManageOpen(true);
                    }}
                  >
                    <UsersRound className="h-4 w-4" /> Manage team
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
                  onClick={() => {
                    setOpen(false);
                    openSettings();
                  }}
                >
                  <SettingsIcon className="h-4 w-4" /> Account settings
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ORDER = ['light', 'dark', 'system'] as const;
                    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
                    useSettingsStore.getState().setTheme(next);
                  }}
                >
                  <ThemeIcon className="h-4 w-4" /> Appearance: <span className="capitalize">{theme}</span>
                </button>
              </div>
              
              <div className="mx-2 my-1 border-t border-slate-100 dark:border-slate-700/50" />
              
              <div className="px-1.5 py-1">
                <button
                  onClick={() => { setOpen(false); void logout(); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}

      <ManageTeamDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </>
  );
}
