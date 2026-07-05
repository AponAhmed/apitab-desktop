import { useEffect, useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { useTeamStore } from '@/stores/teamStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useAccountStore } from '@/stores/accountStore';
import { shareCollectionToTeam } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export function ShareToTeamDialog() {
  const collectionId = useDialogStore((s) => s.shareToTeamCollectionId);
  const close = useDialogStore((s) => s.closeShareToTeam);
  const teams = useTeamStore((s) => s.teams);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const loggedIn = !!useAccountStore((s) => s.session);
  const collection = useCollectionStore((s) =>
    s.collections.find((c) => c.id === collectionId),
  );

  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (collectionId) setTeamId(activeTeamId ?? teams[0]?.id ?? '');
  }, [collectionId, activeTeamId, teams]);

  const submit = async () => {
    if (!collectionId || !teamId) return;
    setLoading(true);
    try {
      await shareCollectionToTeam(collectionId, teamId);
      toast.success(`Shared "${collection?.name}" with the team`);
      close();
    } catch {
      toast.error('Could not share this collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!collectionId}
      onClose={close}
      title="Share to Team"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!teamId || loading || !loggedIn}
          >
            {loading ? 'Sharing…' : 'Share'}
          </Button>
        </>
      }
    >
      {!loggedIn ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Log in first to share collections with a team.
        </p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You're not part of a team yet. Create one from the account menu first.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Share <b>{collection?.name}</b> with:
          </p>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-400">
            Owners/admins can edit it for everyone; plain members see it read-through — their
            local changes never leave their device. Environments are never shared.
          </p>
        </div>
      )}
    </Modal>
  );
}
