import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PromptDialog } from '@/components/PromptDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/utils/cn';
import type { Environment } from '@/types';

function sharedIds(env: Environment): Set<string> {
  return new Set(env.variables.filter((v) => v.shared).map((v) => v.id));
}

export function EnvironmentsPanel() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActive = useEnvironmentStore((s) => s.setActiveEnvironment);
  const createEnv = useEnvironmentStore((s) => s.createEnvironment);
  const renameEnv = useEnvironmentStore((s) => s.renameEnvironment);
  const deleteEnv = useEnvironmentStore((s) => s.deleteEnvironment);
  const duplicateEnv = useEnvironmentStore((s) => s.duplicateEnvironment);
  const updateVariable = useEnvironmentStore((s) => s.updateVariable);
  const removeVariable = useEnvironmentStore((s) => s.removeVariable);

  const [expanded, setExpanded] = useState<string | null>(activeId);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Environment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Environments</span>
        <IconButton size="sm" title="New environment" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {environments.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No environments"
            description="Create Development, Staging or Production with {{variables}}."
          />
        ) : (
          environments.map((env) => {
            const isOpen = expanded === env.id;
            const isActive = activeId === env.id;
            return (
              <div key={env.id} className="mb-1">
                <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800/70">
                  <button
                    onClick={() => setExpanded(isOpen ? null : env.id)}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {env.name}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        active
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                    <IconButton
                      size="sm"
                      title={isActive ? 'Deactivate' : 'Set active'}
                      onClick={() => setActive(isActive ? null : env.id)}
                    >
                      <Check className={cn('h-3 w-3', isActive && 'text-emerald-600 dark:text-emerald-400')} />
                    </IconButton>
                    <IconButton size="sm" title="Rename" onClick={() => setRenameTarget(env)}>
                      <Pencil className="h-3 w-3" />
                    </IconButton>
                    <IconButton size="sm" title="Duplicate" onClick={() => duplicateEnv(env.id)}>
                      <Copy className="h-3 w-3" />
                    </IconButton>
                    <IconButton size="sm" title="Delete" onClick={() => setDeleteTarget(env)}>
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-1.5">
                    <KeyValueEditor
                      rows={env.variables}
                      onChange={(id, patch) => updateVariable(env.id, id, patch)}
                      onRemove={(id) => removeVariable(env.id, id)}
                      keyPlaceholder="Variable"
                      valuePlaceholder="Value"
                      enableVariables={false}
                      columnRatio={['0.75fr', '1.25fr']}
                      showShareToggle
                      sharedIds={sharedIds(env)}
                      onToggleShared={(id) => {
                        const v = env.variables.find((x) => x.id === id);
                        updateVariable(env.id, id, { shared: !v?.shared });
                      }}
                    />
                    <p className="mt-1.5 flex items-center gap-1 px-0.5 text-[11px] text-slate-400">
                      <Share2 className="h-3 w-3 shrink-0" />
                      Toggle the share icon to include a variable (with its value) when you export
                      or share a collection.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PromptDialog
        open={createOpen}
        title="New Environment"
        label="Environment name"
        placeholder="Development"
        confirmLabel="Create"
        onConfirm={(v) => setExpanded(createEnv(v).id)}
        onClose={() => setCreateOpen(false)}
      />
      <PromptDialog
        open={!!renameTarget}
        title="Rename Environment"
        label="Environment name"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onConfirm={(v) => renameTarget && renameEnv(renameTarget.id, v)}
        onClose={() => setRenameTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Environment"
        message={
          <>
            Delete <b>{deleteTarget?.name}</b> and its variables?
          </>
        }
        onConfirm={() => deleteTarget && deleteEnv(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
