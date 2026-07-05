import { apiClient, ConflictError } from './apiClient';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { toast } from '@/stores/toastStore';
import type { Collection } from '@/types';

/*
 * Owns all awareness of "sync this to the server." collectionStore itself
 * stays pure local state; this module watches it, pushes team-tagged edits,
 * and pulls periodic changes.
 *
 * A pull merge must not immediately re-trigger a push of the very data it
 * just wrote (feedback loop) — the `applyingRemote` flag suppresses the
 * push-on-mutation watcher for the duration of any remote-origin write.
 *
 * Unlike the browser extension (multiple independent pages + a background
 * worker, each with its own in-memory store copy, needing a
 * `browser.storage.onChanged` listener to stay in sync), this desktop app
 * has exactly one window/renderer holding the one live store — so that
 * cross-context propagation problem doesn't exist here.
 */

let applyingRemote = false;
/** Last known pushed/pulled `updatedAt` per collection id, to diff future local edits. */
const pushedVersions = new Map<string, number>();

async function pushTeamCollection(teamId: string, collection: Collection) {
  try {
    const updated = await apiClient.updateRemoteCollection(teamId, collection);
    pushedVersions.set(collection.id, updated.updatedAt);
    applyingRemote = true;
    useCollectionStore.setState((s) => ({
      collections: s.collections.map((c) =>
        c.id === collection.id ? { ...c, updatedAt: updated.updatedAt } : c,
      ),
    }));
  } catch (err) {
    if (err instanceof ConflictError) {
      // Confirmed rule: server wins, no merge UI. Adopt its copy.
      pushedVersions.set(collection.id, err.current.updatedAt);
      applyingRemote = true;
      useCollectionStore.getState().mergeSync(teamId, [err.current], []);
      toast.info(`"${err.current.name}" was updated elsewhere — synced the latest version.`);
    }
    // Network/other errors: leave local state; the next mutation or poll retries.
  } finally {
    applyingRemote = false;
  }
}

function onCollectionsChanged(
  state: ReturnType<typeof useCollectionStore.getState>,
  prevState: ReturnType<typeof useCollectionStore.getState>,
) {
  if (applyingRemote) return;

  for (const c of state.collections) {
    if (!c.teamId) continue;
    const known = pushedVersions.get(c.id);
    if (known === undefined) {
      // First time we've seen this team-tagged collection in this context
      // (e.g. just rehydrated) — record its version without pushing.
      pushedVersions.set(c.id, c.updatedAt);
      continue;
    }
    if (c.updatedAt > known) {
      pushedVersions.set(c.id, c.updatedAt); // optimistic, avoids duplicate concurrent pushes
      void pushTeamCollection(c.teamId, c);
    }
  }

  const currentIds = new Set(state.collections.map((c) => c.id));
  for (const prev of prevState.collections) {
    if (prev.teamId && !currentIds.has(prev.id)) {
      pushedVersions.delete(prev.id);
      void apiClient.deleteRemoteCollection(prev.teamId, prev.id).catch(() => {
        // Best-effort: if this fails the item may reappear on next pull, which is safe.
      });
    }
  }
}

let initialized = false;
const POLL_INTERVAL_MS = 60_000;

/**
 * Wires the push-on-mutation watcher and starts the periodic pull poll.
 * Safe to call repeatedly. Replaces the extension's `browser.alarms`-driven
 * poll (which existed to survive service-worker suspension) with a plain
 * interval, since this app's process stays alive for as long as it runs.
 */
export function initSyncService(): void {
  if (initialized) return;
  initialized = true;

  for (const c of useCollectionStore.getState().collections) {
    if (c.teamId) pushedVersions.set(c.id, c.updatedAt);
  }

  useCollectionStore.subscribe(onCollectionsChanged);

  setInterval(() => void runAllTeamsSync(), POLL_INTERVAL_MS);
}

/** Shares a local (untagged) collection with a team: creates it remotely. */
export async function shareCollectionToTeam(collectionId: string, teamId: string): Promise<void> {
  const collection = useCollectionStore.getState().collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error('Collection not found');

  const created = await apiClient.createRemoteCollection(teamId, collection);
  pushedVersions.set(collectionId, created.updatedAt);
  applyingRemote = true;
  try {
    useCollectionStore.setState((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, teamId, updatedAt: created.updatedAt } : c,
      ),
    }));
  } finally {
    applyingRemote = false;
  }
}

export async function runSyncTick(teamId: string): Promise<void> {
  useTeamStore.getState().setSyncing(true);
  try {
    const since = useTeamStore.getState().lastSyncedAt[teamId] ?? 0;
    const res = await apiClient.fetchSync(teamId, since);

    applyingRemote = true;
    try {
      useCollectionStore.getState().mergeSync(teamId, res.collections, res.deletedCollectionIds);
    } finally {
      applyingRemote = false;
    }

    for (const c of res.collections) pushedVersions.set(c.id, c.updatedAt);
    for (const id of res.deletedCollectionIds) pushedVersions.delete(id);

    useTeamStore.getState().recordSync(teamId, res.serverTime);
    useTeamStore.getState().setSyncError(null);
  } catch (err) {
    useTeamStore.getState().setSyncError(err instanceof Error ? err.message : 'Sync failed');
  } finally {
    useTeamStore.getState().setSyncing(false);
  }
}

/** Runs one polling pass across every team the user belongs to. No-op if logged out. */
export async function runAllTeamsSync(): Promise<void> {
  // Storage hydration is async (IPC round-trip to the main process) — make
  // sure it has finished before trusting `session`/`teams`, otherwise a poll
  // that fires very early (e.g. on first mount) could read stale (empty)
  // initial state and silently skip.
  await useAccountStore.persist.rehydrate();
  await useTeamStore.persist.rehydrate();

  if (!useAccountStore.getState().session) return;
  for (const team of useTeamStore.getState().teams) {
    await runSyncTick(team.id);
  }
}
