import { apiClient, ConflictError } from './apiClient';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useTeamVariablesStore } from '@/stores/teamVariablesStore';
import { usePendingAssignmentsStore } from '@/stores/pendingAssignmentsStore';
import { toast } from '@/stores/toastStore';
import type { Collection, Environment, TeamVariable } from '@/types';

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

/** This device's role on `teamId`, or undefined if the team isn't known locally. */
function roleForTeam(teamId: string): string | undefined {
  return useTeamStore.getState().teams.find((t) => t.id === teamId)?.role;
}

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
      const current = err.current as Collection;
      pushedVersions.set(collection.id, current.updatedAt);
      applyingRemote = true;
      useCollectionStore.getState().mergeSync(teamId, [current], []);
      toast.info(`"${current.name}" was updated elsewhere — synced the latest version.`);
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
      // Plain members get a local-only, read-through view of shared
      // collections — the server rejects their writes anyway (403), so
      // don't even attempt the round trip; their edit just stays on-device.
      if (roleForTeam(c.teamId) === 'member') continue;
      void pushTeamCollection(c.teamId, c);
    }
  }

  const currentIds = new Set(state.collections.map((c) => c.id));
  for (const prev of prevState.collections) {
    if (prev.teamId && !currentIds.has(prev.id)) {
      const role = roleForTeam(prev.teamId);
      pushedVersions.delete(prev.id);
      if (role === 'member') {
        // A plain member can't persist a real delete (the server would
        // 403 an owner/admin-only destroy), so this instead declines their
        // own assignment — the fix for deleted shared collections
        // reappearing after re-login: previously this was a silent no-op,
        // meaning the server never learned about the removal at all and
        // the very next sync pull re-added its still-existing server copy.
        void apiClient.leaveTeamCollection(prev.teamId, prev.id).catch(() => {
          // Best-effort: if this fails, their assignment is still
          // 'accepted' server-side, so it may reappear on next pull, which is safe.
        });
        continue;
      }
      void apiClient.deleteRemoteCollection(prev.teamId, prev.id).catch(() => {
        // Best-effort: if this fails the item may reappear on next pull, which is safe.
      });
    }
  }
}

/**
 * Last known pushed/pulled `{teamId, updatedAt}` per *environment variable*
 * id that's flagged `shared`. Keyed by the variable's own id so a push and a
 * later pull agree on identity even though environments themselves never
 * sync — only the flagged values, via the flat per-team pool.
 */
const pushedVariableVersions = new Map<string, { teamId: string; updatedAt: number }>();

/** Every `shared` variable across all local environments, by id. Empty keys are dropped. */
function desiredSharedVariables(environments: Environment[]): Map<string, { key: string; value: string }> {
  const map = new Map<string, { key: string; value: string }>();
  for (const env of environments) {
    for (const v of env.variables) {
      if (v.shared && v.key.trim() !== '') map.set(v.id, { key: v.key.trim(), value: v.value });
    }
  }
  return map;
}

async function pushSharedVariableUpsert(
  teamId: string,
  id: string,
  key: string,
  value: string,
  isNew: boolean,
): Promise<void> {
  const now = Date.now();
  const draft: TeamVariable = { id, key, value, createdAt: now, updatedAt: now };
  try {
    const saved = isNew
      ? await apiClient.createTeamVariable(teamId, draft)
      : await apiClient.updateTeamVariable(teamId, draft);
    pushedVariableVersions.set(id, { teamId, updatedAt: saved.updatedAt });
    useTeamVariablesStore.getState().upsertLocal(teamId, saved);
  } catch (err) {
    if (err instanceof ConflictError) {
      // Same rule as collections: server wins, no merge UI.
      const current = err.current as TeamVariable;
      pushedVariableVersions.set(id, { teamId, updatedAt: current.updatedAt });
      useTeamVariablesStore.getState().upsertLocal(teamId, current);
      toast.info(`Shared variable "${current.key}" was updated elsewhere — synced the latest version.`);
    }
    // Network/other errors: leave as-is; the next environment edit or poll retries.
  }
}

async function pushSharedVariableDelete(teamId: string, id: string): Promise<void> {
  pushedVariableVersions.delete(id);
  try {
    await apiClient.deleteTeamVariable(teamId, id);
  } catch {
    // Best-effort: if this fails the item may reappear on next pull, which is safe.
  } finally {
    useTeamVariablesStore.getState().removeLocal(teamId, id);
  }
}

function onEnvironmentsChanged(
  state: ReturnType<typeof useEnvironmentStore.getState>,
  _prevState: ReturnType<typeof useEnvironmentStore.getState>,
) {
  if (applyingRemote) return;
  const teamId = useTeamStore.getState().activeTeamId;
  if (!teamId) return;

  const desired = desiredSharedVariables(state.environments);

  for (const [id, { key, value }] of desired) {
    const known = pushedVariableVersions.get(id);
    if (!known) {
      pushedVariableVersions.set(id, { teamId, updatedAt: Date.now() }); // optimistic, avoids duplicate concurrent pushes
      void pushSharedVariableUpsert(teamId, id, key, value, true);
      continue;
    }
    if (known.teamId !== teamId) {
      // Active team changed while still shared — move it: drop from the old
      // team's pool, create fresh in the new one.
      void pushSharedVariableDelete(known.teamId, id);
      pushedVariableVersions.set(id, { teamId, updatedAt: Date.now() });
      void pushSharedVariableUpsert(teamId, id, key, value, true);
      continue;
    }
    const local = useTeamVariablesStore.getState().variablesByTeam[teamId]?.find((v) => v.id === id);
    if (!local || local.key !== key || local.value !== value) {
      pushedVariableVersions.set(id, { teamId, updatedAt: Date.now() });
      void pushSharedVariableUpsert(teamId, id, key, value, false);
    }
  }

  for (const [id, known] of pushedVariableVersions) {
    if (!desired.has(id)) void pushSharedVariableDelete(known.teamId, id);
  }
}

/**
 * Removes a variable from a team's shared pool. If it originated from one of
 * this device's own environments (flagged `shared`), unsharing it locally is
 * enough — `onEnvironmentsChanged` picks up the flip and pushes the delete.
 * Otherwise (e.g. a variable shared by a teammate, not present in any local
 * environment) it's removed from the pool directly.
 */
export function unshareTeamVariable(teamId: string, variableId: string): void {
  for (const env of useEnvironmentStore.getState().environments) {
    const match = env.variables.find((v) => v.id === variableId);
    if (match?.shared) {
      useEnvironmentStore.getState().updateVariable(env.id, variableId, { shared: false });
      return;
    }
  }
  void pushSharedVariableDelete(teamId, variableId);
}

let initialized = false;

/**
 * Wires the push-on-mutation watchers (once per page). Safe to call
 * repeatedly. Poll *scheduling* itself lives in `hooks/useTeamSync.ts`
 * (focus-aware fast/slow cadence), not here.
 */
export function initSyncService(): void {
  if (initialized) return;
  initialized = true;

  for (const c of useCollectionStore.getState().collections) {
    if (c.teamId) pushedVersions.set(c.id, c.updatedAt);
  }

  const activeTeamId = useTeamStore.getState().activeTeamId;
  if (activeTeamId) {
    for (const v of useTeamVariablesStore.getState().variablesByTeam[activeTeamId] ?? []) {
      pushedVariableVersions.set(v.id, { teamId: activeTeamId, updatedAt: v.updatedAt });
    }
  }

  useCollectionStore.subscribe(onCollectionsChanged);
  useEnvironmentStore.subscribe(onEnvironmentsChanged);
}

/** Shares a local (untagged) collection with a team: creates it remotely, optionally assigning it to specific member(s) right away. */
export async function shareCollectionToTeam(
  collectionId: string,
  teamId: string,
  userIds: string[] = [],
): Promise<void> {
  const collection = useCollectionStore.getState().collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error('Collection not found');

  const created = await apiClient.createRemoteCollection(teamId, collection, userIds);
  pushedVersions.set(collectionId, created.updatedAt);
  applyingRemote = true;
  try {
    useCollectionStore.setState((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, teamId, updatedAt: created.updatedAt, createdBy: created.createdBy }
          : c,
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
      useTeamVariablesStore.getState().mergeSync(teamId, res.variables, res.deletedVariableIds);
    } finally {
      applyingRemote = false;
    }

    for (const c of res.collections) pushedVersions.set(c.id, c.updatedAt);
    for (const id of res.deletedCollectionIds) pushedVersions.delete(id);

    for (const v of res.variables) pushedVariableVersions.set(v.id, { teamId, updatedAt: v.updatedAt });
    for (const id of res.deletedVariableIds) pushedVariableVersions.delete(id);

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

  // Refresh the team membership list itself before syncing each team's
  // collections/variables. Without this, being newly added to a team (or a
  // team gaining collections you'd never synced before) stays invisible
  // until the next login — polling only ever synced teams already known
  // locally, never discovered new ones.
  try {
    const { teams } = await apiClient.fetchTeams();
    useTeamStore.getState().setTeams(teams);
  } catch {
    // Offline or a transient failure — fall back to the already-known list.
  }

  for (const team of useTeamStore.getState().teams) {
    await runSyncTick(team.id);
  }

  try {
    const { assignments } = await apiClient.fetchPendingAssignments();
    usePendingAssignmentsStore.getState().setAll(assignments);
  } catch {
    // Offline/transient — keep showing the last known list.
  }
}
