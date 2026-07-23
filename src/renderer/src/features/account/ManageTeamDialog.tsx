import { useState, useEffect, type FormEvent } from 'react';
import { useTeamStore } from '@/stores/teamStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { apiClient, ApiError } from '@/services/apiClient';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UserMinus } from 'lucide-react';
import type { TeamMember, TeamRole } from '@/types';

export function ManageTeamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teams = useTeamStore((s) => s.teams);
  const membersRecord = useTeamStore((s) => s.members);
  const setMembers = useTeamStore((s) => s.setMembers);
  const addMemberToStore = useTeamStore((s) => s.addMemberToStore);
  const removeMemberFromStore = useTeamStore((s) => s.removeMemberFromStore);
  const renameTeamInStore = useTeamStore((s) => s.renameTeamInStore);
  const removeTeamFromStore = useTeamStore((s) => s.removeTeamFromStore);
  const removeCollectionsForTeam = useCollectionStore((s) => s.removeCollectionsForTeam);
  const currentUserId = useAccountStore((s) => s.session?.user.id ?? null);

  const team = teams.find((t) => t.id === activeTeamId);
  const members = activeTeamId ? (membersRecord[activeTeamId] ?? []) : [];
  const myRole = members.find((m) => m.userId === currentUserId)?.role;
  const canRename = myRole === 'owner' || myRole === 'admin';

  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Extract<TeamRole, 'admin' | 'member'>>('member');
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [summary, setSummary] = useState<{ createdAt?: number; collectionsCount: number } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  /** Mirrors TeamPolicy::removeMember server-side: never the owner; owner removes anyone else; admin removes plain members only. */
  const canRemove = (m: TeamMember) =>
    m.userId !== team?.ownerId && (myRole === 'owner' || (myRole === 'admin' && m.role === 'member'));

  const handleRemove = async () => {
    if (!activeTeamId || !removeTarget) return;
    try {
      await apiClient.removeTeamMember(activeTeamId, removeTarget.userId);
      removeMemberFromStore(activeTeamId, removeTarget.userId);
      toast.success(`Removed ${removeTarget.name} from the team`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  };

  // Load members + summary when the dialog opens.
  useEffect(() => {
    if (!open || !activeTeamId) return;
    setMembersLoading(true);
    apiClient
      .fetchTeamDetail(activeTeamId)
      .then((detail) => {
        setMembers(activeTeamId, detail.members);
        setSummary({ createdAt: detail.createdAt, collectionsCount: detail.collectionsCount });
      })
      .catch(() => toast.error('Failed to load team members'))
      .finally(() => setMembersLoading(false));
  }, [open, activeTeamId, setMembers]);

  useEffect(() => {
    if (team) setNameDraft(team.name);
  }, [team?.id, team?.name]);

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!activeTeamId || !trimmed || trimmed === team?.name) return;
    setRenaming(true);
    try {
      const updated = await apiClient.updateTeam(activeTeamId, trimmed);
      renameTeamInStore(activeTeamId, updated.name);
      toast.success('Workspace renamed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rename workspace');
    } finally {
      setRenaming(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTeamId || !email.trim()) return;

    setLoading(true);
    try {
      const newMember = await apiClient.addTeamMember(activeTeamId, email.trim(), role);
      addMemberToStore(activeTeamId, newMember);
      toast.success(`Added ${newMember.name} to the team`);
      setEmail('');
      setRole('member');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeTeamId) return;
    try {
      await apiClient.deleteTeam(activeTeamId);
      removeCollectionsForTeam(activeTeamId);
      removeTeamFromStore(activeTeamId);
      toast.success('Workspace deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete workspace');
    }
  };

  if (!team) return null;

  return (
    <Modal open={open} onClose={onClose} title="Manage Workspace" className="max-w-md">
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            Workspace name
          </h4>
          {canRename ? (
            <form onSubmit={(e) => void handleRename(e)} className="flex gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={renaming || !nameDraft.trim() || nameDraft.trim() === team.name}>
                {renaming ? 'Saving…' : 'Save'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300">{team.name}</p>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 text-center dark:divide-slate-800 dark:border-slate-800">
          <div className="px-2 py-2.5">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{members.length}</p>
            <p className="text-[11px] text-slate-400">Members</p>
          </div>
          <div className="px-2 py-2.5">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {summary?.collectionsCount ?? '—'}
            </p>
            <p className="text-[11px] text-slate-400">Collections</p>
          </div>
          <div className="px-2 py-2.5">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {summary?.createdAt ? new Date(summary.createdAt).toLocaleDateString() : '—'}
            </p>
            <p className="text-[11px] text-slate-400">Created</p>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            Invite new member
          </h4>
          <form onSubmit={(e) => void handleAddMember(e)} className="flex gap-2">
            <Input
              type="email"
              placeholder="User email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="w-28"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Adding…' : 'Add'}
            </Button>
          </form>
          <p className="mt-1 text-xs text-slate-400">
            The user must already have an ApiTab account with this email.
          </p>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            Current members ({members.length})
          </h4>
          <div className="max-h-60 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            {membersLoading && members.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Loading members…</div>
            ) : members.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No members yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {m.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {m.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                        {m.role}
                      </span>
                      {canRemove(m) && (
                        <Menu
                          label="Member actions"
                          items={[
                            {
                              label: 'Remove from team',
                              icon: UserMinus,
                              danger: true,
                              onClick: () => setRemoveTarget(m),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {myRole === 'owner' && (
          <div className="rounded-md border border-red-200 p-3 dark:border-red-900/50">
            <h4 className="mb-1 text-sm font-medium text-red-700 dark:text-red-400">Danger zone</h4>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Permanently deletes this workspace, its shared collections, and removes access for
              every member. This can't be undone.
            </p>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              Delete workspace
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member"
        message={
          <>
            Remove <b>{removeTarget?.name}</b> from the team? They'll lose access to this team's
            shared collections.
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => void handleRemove()}
        onClose={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete workspace"
        message={
          <>
            Permanently delete <b>{team.name}</b>? Every member loses access, and all of this
            workspace's shared collections are deleted for everyone. This can't be undone.
          </>
        }
        confirmLabel="Delete workspace"
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </Modal>
  );
}
