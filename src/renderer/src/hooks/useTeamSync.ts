import { useEffect } from 'react';
import { initSyncService, runAllTeamsSync } from '@/services/syncService';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';

/** Background auto-sync cadence. Manual sync (the toolbar button) is unaffected and always fires immediately on click. */
const POLL_MS = 300_000; // 5 minutes

/**
 * Wires the push-on-mutation watcher (once per page) and triggers an
 * immediate sync pass on mount, so opening the workspace always shows fresh
 * team data instead of waiting for the next scheduled poll.
 */
export function useTeamSync() {
  const loggedIn = !!useAccountStore((s) => s.session);
  const teamCount = useTeamStore((s) => s.teams.length);

  useEffect(() => {
    initSyncService();
  }, []);

  useEffect(() => {
    if (loggedIn && teamCount > 0) void runAllTeamsSync();
  }, [loggedIn, teamCount]);

  // Self-rescheduling setTimeout (not setInterval, so a slow tick can't
  // overlap the next one). Regaining focus jumps straight to an immediate
  // sync rather than waiting out a stale tick, so switching back to the tab
  // always shows fresh data without needing a manual click.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      void runAllTeamsSync().finally(() => {
        if (cancelled) return;
        timer = setTimeout(tick, POLL_MS);
      });
    };
    const onFocus = () => {
      if (timer) clearTimeout(timer);
      tick();
    };

    timer = setTimeout(tick, POLL_MS);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const isSyncing = useTeamStore((s) => s.isSyncing);
  const syncError = useTeamStore((s) => s.lastSyncError);

  return { isSyncing, syncError, refresh: runAllTeamsSync };
}
