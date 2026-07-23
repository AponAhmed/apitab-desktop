import { useEffect, useMemo, useState } from 'react';
import { useCollectionStore } from '@/stores/collectionStore';
import { useRequestStore } from '@/stores/requestStore';
import { useTeamStore } from '@/stores/teamStore';
import { useDialogStore } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { flattenContainers } from '@/utils/collectionTree';

const NEW = '__new__';

export function SaveRequestDialog() {
  const open = useDialogStore((s) => s.saveRequestOpen);
  const close = useDialogStore((s) => s.closeSaveRequest);
  const collections = useCollectionStore((s) => s.collections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const saveToCollection = useRequestStore((s) => s.saveToCollection);
  const requestName = useRequestStore((s) => s.request.name);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  // Only the currently selected workspace's collections — matches the same
  // scoping CollectionsPanel's sidebar already applies, so "Save to" never
  // offers a collection you can't actually see without switching workspace
  // first (which would make the saved request seem to vanish).
  const workspaceCollections = useMemo(
    () => collections.filter((c) => (activeTeamId ? c.teamId === activeTeamId : !c.teamId)),
    [collections, activeTeamId],
  );
  const targets = useMemo(() => flattenContainers(workspaceCollections), [workspaceCollections]);

  const [name, setName] = useState('');
  const [target, setTarget] = useState<string>(NEW);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(requestName || 'Untitled Request');
    setTarget(targets[0]?.id ?? NEW);
    setNewCollectionName('');
  }, [open, requestName, targets]);

  const isNew = target === NEW;
  const canSave = name.trim() !== '' && (!isNew || newCollectionName.trim() !== '');

  const submit = () => {
    if (!canSave) return;
    const targetId = isNew ? createCollection(newCollectionName).id : target;
    saveToCollection(targetId, name);
    toast.success('Request saved');
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Save Request"
      noBackdropBlur
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Request name
          </span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Save to
          </span>
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {`${'  '.repeat(t.depth)}${t.isCollection ? '' : '↳ '}${t.name}`}
              </option>
            ))}
            <option value={NEW}>+ New collection…</option>
          </Select>
        </label>

        {isNew && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              New collection name
            </span>
            <Input
              value={newCollectionName}
              placeholder="My Collection"
              onChange={(e) => setNewCollectionName(e.target.value)}
            />
          </label>
        )}
      </form>
    </Modal>
  );
}
