import { useEffect } from 'react';
import { initSyncService, runAllTeamsSync } from '@/services/syncService';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';

/** Poll cadence while an ApiTab page is open and focused — fast enough that a freshly-shared collection's Accept/Decline popover shows up without a re-login. */
const FOCUSED_POLL_MS = 7_000;
/** Cadence while open but unfocused (or, in the extension, whenever no page has focus at all). */
const BLURRED_POLL_MS = 600_000; // 10 minutes

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

  // Focus-aware fast polling: self-rescheduling setTimeout (not setInterval,
  // so a slow tick can't overlap the next one) rather than a flat interval.
  // "Foreground" is simply "this page is open and focused" — the same
  // concept applies whether this hook is mounted in the desktop's single
  // renderer or an open extension tab.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      void runAllTeamsSync().finally(() => {
        if (cancelled) return;
        timer = setTimeout(tick, document.hasFocus() ? FOCUSED_POLL_MS : BLURRED_POLL_MS);
      });
    };
    const onFocus = () => {
      if (timer) clearTimeout(timer);
      tick(); // jump straight to a fast poll instead of waiting out a stale blurred-tier tick
    };

    timer = setTimeout(tick, document.hasFocus() ? FOCUSED_POLL_MS : BLURRED_POLL_MS);
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
