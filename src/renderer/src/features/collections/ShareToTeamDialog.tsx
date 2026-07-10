import { useEffect, useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { useTeamStore } from '@/stores/teamStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useAccountStore } from '@/stores/accountStore';
import { shareCollectionToTeam } from '@/services/syncService';
import { apiClient } from '@/services/apiClient';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/utils/cn';
import type { CollectionAssigneeStatus } from '@/types';

export function ShareToTeamDialog() {
  const collectionId = useDialogStore((s) => s.shareToTeamCollectionId);
  const close = useDialogStore((s) => s.closeShareToTeam);
  const teams = useTeamStore((s) => s.teams);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const membersRecord = useTeamStore((s) => s.members);
  const setMembers = useTeamStore((s) => s.setMembers);
  const loggedIn = !!useAccountStore((s) => s.session);
  const currentUserId = useAccountStore((s) => s.session?.user.id ?? null);
  const collection = useCollectionStore((s) =>
    s.collections.find((c) => c.id === collectionId),
  );

  // Already shared (has a teamId) → this is "manage access" for that fixed
  // team; otherwise it's a first-time share, where the team itself is
  // picked via the <Select> below.
  const manageMode = !!collection?.teamId;

  const [teamId, setTeamId] = useState('');
  const [assignments, setAssignments] = useState<CollectionAssigneeStatus[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveTeamId = manageMode ? (collection?.teamId ?? '') : teamId;
  const members = (membersRecord[effectiveTeamId] ?? []).filter((m) => m.userId !== currentUserId);
  const statusByUserId = new Map(assignments.map((a) => [a.userId, a.status]));

  useEffect(() => {
    if (!collectionId) return;
    setSelected(new Set());
    if (!manageMode) setTeamId(activeTeamId ?? teams[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, manageMode]);

  useEffect(() => {
    if (!collectionId || !effectiveTeamId) return;
    setMembersLoading(true);
    const loadMembers = apiClient.fetchTeamDetail(effectiveTeamId).then((detail) => setMembers(effectiveTeamId, detail.members));
    const loadAssignments = manageMode
      ? apiClient.fetchCollectionAssignments(effectiveTeamId, collectionId).then((res) => setAssignments(res.assignments))
      : Promise.resolve();
    Promise.all([loadMembers, loadAssignments])
      .catch(() => toast.error('Failed to load team members'))
      .finally(() => setMembersLoading(false));
  }, [collectionId, effectiveTeamId, manageMode, setMembers]);

  const toggleSelected = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const submit = async () => {
    if (!collectionId || !effectiveTeamId) return;
    setLoading(true);
    try {
      if (manageMode) {
        if (selected.size > 0) {
          await apiClient.assignCollection(effectiveTeamId, collectionId, [...selected]);
        }
        toast.success('Access updated');
      } else {
        await shareCollectionToTeam(collectionId, effectiveTeamId, [...selected]);
        toast.success(`Shared "${collection?.name}" with the team`);
        // The collection now lives in effectiveTeamId — switch the active
        // workspace there so it doesn't vanish from the sidebar's
        // active-workspace-only filter right after sharing it.
        useTeamStore.getState().setActiveTeam(effectiveTeamId);
      }
      close();
    } catch {
      toast.error(manageMode ? 'Could not update access' : 'Could not share this collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!collectionId}
      onClose={close}
      title={manageMode ? 'Manage Access' : 'Share to Team'}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!effectiveTeamId || loading || !loggedIn}
          >
            {loading ? 'Saving…' : manageMode ? 'Save' : 'Share'}
          </Button>
        </>
      }
    >
      {!loggedIn ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Log in first to share collections with a team.
        </p>
      ) : !manageMode && teams.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You're not part of a team yet. Create one from the account menu first.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {manageMode ? (
              <>
                Manage who has <b>{collection?.name}</b> in their workspace.
              </>
            ) : (
              <>
                Share <b>{collection?.name}</b> with:
              </>
            )}
          </p>

          {manageMode ? (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {teams.find((t) => t.id === effectiveTeamId)?.name ?? 'Team'}
            </p>
          ) : (
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}

          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            {membersLoading && members.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Loading members…</div>
            ) : members.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No other members on this team.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {members.map((m) => {
                  const status = statusByUserId.get(m.userId);
                  return (
                    <li key={m.userId} className="flex items-center justify-between gap-2 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800 dark:text-slate-100">{m.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
                        {status === 'declined' && (
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                            Previously declined — check to re-invite
                          </p>
                        )}
                      </div>
                      {status === 'accepted' || status === 'pending' ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            status === 'accepted' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
                            status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                          )}
                        >
                          {status}
                        </span>
                      ) : (
                        // No row yet, or previously `declined` — both are
                        // re-assignable; the backend's assign endpoint
                        // already resets a declined row back to pending.
                        <Toggle
                          checked={selected.has(m.userId)}
                          onChange={() => toggleSelected(m.userId)}
                          aria-label={`Assign to ${m.name}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Owners/admins can edit it for everyone; plain members see it read-through — their
            local changes never leave their device. Environments are never shared.
          </p>
        </div>
      )}
    </Modal>
  );
}
