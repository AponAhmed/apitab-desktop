import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, LogIn, RefreshCw, UserPlus, Users, LogOut, Settings as SettingsIcon, UsersRound } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { useTeamVariablesStore } from '@/stores/teamVariablesStore';
import { useDialogStore } from '@/stores/dialogStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/services/apiClient';
import { clearTeamCollectionsOnLogout, runAllTeamsSync } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { PromptDialog } from '@/components/PromptDialog';
import { ManageTeamDialog } from './ManageTeamDialog';
import { cn } from '@/utils/cn';

const NEW_TEAM = '__new_team__';

/**
 * The account's real picture (currently only set via Google sign-in — see
 * AuthController::userPayload on the server) when available, falling back
 * to an initial-letter circle otherwise. Also falls back on a load error:
 * Google's photo URLs are hotlink-protected in some configurations and can
 * occasionally 403/404, and this must never leave the account menu blank.
 */
function AccountAvatarImage({
  avatar,
  initial,
  size,
}: {
  avatar?: string | null;
  initial: string;
  size: 'sm' | 'md';
}) {
  const [errored, setErrored] = useState(false);
  const dims = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';

  if (avatar && !errored) {
    return (
      <img
        src={avatar}
        alt=""
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full object-cover', dims)}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white',
        dims,
      )}
    >
      {initial}
    </span>
  );
}

export function TeamSelector() {
  const teams = useTeamStore((s) => s.teams);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const setTeams = useTeamStore((s) => s.setTeams);
  const personalWorkspaceName = useSettingsStore((s) => s.personalWorkspaceName);
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
      {/* This also drives which workspace's collections the sidebar shows —
          not just a display label. */}
      <div className="flex items-center gap-1.5" title="Current workspace">
        <Users className="h-4 w-4 shrink-0 text-slate-400" />
        <Select
          value={activeTeamId ?? ''}
          onChange={(e) => {
            if (e.target.value === NEW_TEAM) setCreateOpen(true);
            else setActiveTeam(e.target.value || null);
          }}
          className="h-7 w-32 text-xs border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 shadow-none focus:ring-0"
          aria-label="Current workspace"
        >
          <option value="">{personalWorkspaceName}</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value={NEW_TEAM}>+ New workspace…</option>
        </Select>
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
    clearTeamCollectionsOnLogout();
    toast.info('Logged out');
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ x: r.right - 200, y: r.bottom + 8 });
    setOpen((o) => !o);
  };

  const initial = session.user.name ? session.user.name.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
        aria-label="Account menu"
      >
        <AccountAvatarImage avatar={session.user.avatar} initial={initial} size="sm" />
        <span className="max-w-[7rem] truncate text-xs font-medium">{session.user.name}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
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
                  <AccountAvatarImage avatar={session.user.avatar} initial={initial} size="md" />
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
                    <UsersRound className="h-4 w-4" /> Manage workspace
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
