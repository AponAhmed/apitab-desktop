import { useEffect } from 'react';
import { initSyncService, runAllTeamsSync } from '@/services/syncService';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';

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

  const isSyncing = useTeamStore((s) => s.isSyncing);
  const syncError = useTeamStore((s) => s.lastSyncError);

  return { isSyncing, syncError, refresh: runAllTeamsSync };
}
