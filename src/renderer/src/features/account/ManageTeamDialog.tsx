import { useState, useEffect, type FormEvent } from 'react';
import { useTeamStore } from '@/stores/teamStore';
import { useAccountStore } from '@/stores/accountStore';
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
  const currentUserId = useAccountStore((s) => s.session?.user.id ?? null);

  const team = teams.find((t) => t.id === activeTeamId);
  const members = activeTeamId ? (membersRecord[activeTeamId] ?? []) : [];
  const myRole = members.find((m) => m.userId === currentUserId)?.role;

  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Extract<TeamRole, 'admin' | 'member'>>('member');
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

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

  // Load members when the dialog opens.
  useEffect(() => {
    if (!open || !activeTeamId) return;
    setMembersLoading(true);
    apiClient
      .fetchTeamDetail(activeTeamId)
      .then((detail) => setMembers(activeTeamId, detail.members))
      .catch(() => toast.error('Failed to load team members'))
      .finally(() => setMembersLoading(false));
  }, [open, activeTeamId, setMembers]);

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

  if (!team) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Manage Team: ${team.name}`} className="max-w-md">
      <div className="space-y-4">
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
    </Modal>
  );
}
