import { createContext, useContext, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Folder,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { useCollectionStore } from '@/stores/collectionStore';
import { useRequestStore } from '@/stores/requestStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useTeamStore } from '@/stores/teamStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDialogStore } from '@/stores/dialogStore';
import { toast } from '@/stores/toastStore';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { MethodBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PromptDialog } from '@/components/PromptDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ShareToTeamDialog } from './ShareToTeamDialog';
import { cn } from '@/utils/cn';
import { countRequests, isCollection } from '@/utils/collectionTree';
import { exportContainer, parseCollectionExport, sanitizeFilename } from '@/utils/collectionIO';
import { parsePostmanFile } from '@/utils/postmanImport';
import { downloadJson, readFileAsText } from '@/services/backup';
import type { ApiRequest, Collection, Container, TeamRole } from '@/types';

interface CollectionActions {
  activeRequestId: string | null;
  openRequest: (containerId: string, req: ApiRequest) => void;
  newFolder: (parentId: string) => void;
  rename: (container: Container) => void;
  duplicate: (id: string) => void;
  removeContainer: (container: Container) => void;
  exportItem: (container: Container) => void;
  importInto: (containerId: string) => void;
  duplicateRequest: (id: string) => void;
  deleteRequest: (req: ApiRequest) => void;
  shareToTeam: (collectionId: string) => void;
}

const ActionsContext = createContext<CollectionActions | null>(null);
const useActions = () => useContext(ActionsContext)!;

const INDENT = 12;

function RequestNode({
  request,
  containerId,
  depth,
}: {
  request: ApiRequest;
  containerId: string;
  depth: number;
}) {
  const actions = useActions();
  const active = actions.activeRequestId === request.id;
  const items: MenuItem[] = [
    { label: 'Duplicate', icon: Copy, onClick: () => actions.duplicateRequest(request.id) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => actions.deleteRequest(request) },
  ];

  return (
    <div
      onClick={() => actions.openRequest(containerId, request)}
      style={{ paddingLeft: depth * INDENT + 6 }}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-1 hover:bg-slate-100 dark:hover:bg-slate-800/70',
        active && 'bg-brand-50 dark:bg-brand-950/40',
      )}
    >
      <span className="w-9 shrink-0 text-right">
        <MethodBadge method={request.method} className="text-[10px]" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
        {request.name || request.url || 'Untitled'}
      </span>
      <div className="opacity-0 group-hover:opacity-100">
        <Menu items={items} label="Request actions" />
      </div>
    </div>
  );
}

function ContainerNode({
  container,
  depth,
  collapsed,
  toggle,
  role,
  currentUserId,
}: {
  container: Container;
  depth: number;
  collapsed: Record<string, boolean>;
  toggle: (id: string) => void;
  /** This device's role on the owning team, when `container` is a shared root collection. */
  role?: TeamRole;
  currentUserId?: string | null;
}) {
  const actions = useActions();
  const root = isCollection(container);
  const teamId = root ? (container as Collection).teamId : undefined;
  const createdBy = root ? (container as Collection).createdBy : undefined;
  const canManageAccess =
    root && !!teamId && (role === 'owner' || role === 'admin' || createdBy === currentUserId);
  const isCollapsed = !!collapsed[container.id];
  const empty = container.folders.length === 0 && container.requests.length === 0;

  const items: MenuItem[] = [
    { label: 'New folder', icon: FolderPlus, onClick: () => actions.newFolder(container.id) },
    { label: 'Rename', icon: Pencil, onClick: () => actions.rename(container) },
    { label: 'Duplicate', icon: Copy, onClick: () => actions.duplicate(container.id) },
    { label: 'Export', icon: Download, separatorBefore: true, onClick: () => actions.exportItem(container) },
    { label: 'Import here', icon: Upload, onClick: () => actions.importInto(container.id) },
    ...(root && !teamId
      ? [{ label: 'Share to team…', icon: Users, onClick: () => actions.shareToTeam(container.id) }]
      : []),
    ...(canManageAccess
      ? [{ label: 'Manage access…', icon: Users, onClick: () => actions.shareToTeam(container.id) }]
      : []),
    {
      label: root ? 'Delete collection' : 'Delete folder',
      icon: Trash2,
      danger: true,
      separatorBefore: true,
      onClick: () => actions.removeContainer(container),
    },
  ];

  return (
    <div>
      <div
        style={{ paddingLeft: depth * INDENT + 4 }}
        className="group flex items-center gap-1 rounded-md py-1 pr-1 hover:bg-slate-100 dark:hover:bg-slate-800/70"
      >
        <button
          onClick={() => toggle(container.id)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          <Folder className={cn('h-3.5 w-3.5 shrink-0', root ? 'text-brand-500' : 'text-slate-400')} />
          <span
            className={cn(
              'truncate text-xs',
              root ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300',
            )}
          >
            {container.name}
          </span>
          {teamId && (
            <span
              title={
                role === 'member'
                  ? 'Shared with team — your edits stay local to this device'
                  : 'Shared with team — you can edit for everyone'
              }
              className="shrink-0"
            >
              <Users className="h-3 w-3 text-brand-500" />
            </span>
          )}
          <span className="shrink-0 text-[10px] text-slate-400">{countRequests(container)}</span>
        </button>
        <div className="opacity-0 group-hover:opacity-100">
          <Menu items={items} label={root ? 'Collection actions' : 'Folder actions'} />
        </div>
      </div>

      {!isCollapsed && (
        <div>
          {container.folders.map((f) => (
            <ContainerNode key={f.id} container={f} depth={depth + 1} collapsed={collapsed} toggle={toggle} />
          ))}
          {container.requests.map((r) => (
            <RequestNode key={r.id} request={r} containerId={container.id} depth={depth + 1} />
          ))}
          {empty && (
            <p style={{ paddingLeft: (depth + 1) * INDENT + 6 }} className="py-1 text-[11px] text-slate-400">
              Empty
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface WorkspaceGroup {
  key: string;
  label: string;
  isTeam: boolean;
  role?: TeamRole;
  collections: Collection[];
}

/** Groups collections into a personal section + one per team, so shared and own collections read as visually distinct spaces. */
function groupByWorkspace(
  collections: Collection[],
  teams: { id: string; name: string; role: TeamRole }[],
  personalLabel: string,
  currentUserId: string | null,
): WorkspaceGroup[] {
  const groups: WorkspaceGroup[] = [];

  const personal = collections.filter((c) => !c.teamId);
  if (personal.length > 0) {
    groups.push({ key: 'personal', label: personalLabel, isTeam: false, collections: personal });
  }

  for (const team of teams) {
    const teamCollections = collections.filter((c) => c.teamId === team.id);
    if (teamCollections.length > 0) {
      groups.push({ key: team.id, label: team.name, isTeam: true, role: team.role, collections: teamCollections });
    }
  }

  // A collection tagged with a team this device no longer recognizes (left
  // the team, or the team was deleted). Only keep showing it if it might be
  // this user's own (created it, or we can't tell because it predates
  // `createdBy` / came from an older sync) — someone else's collection in a
  // team we no longer belong to should simply disappear, not linger forever.
  const knownTeamIds = new Set(teams.map((t) => t.id));
  const orphaned = collections.filter(
    (c) => c.teamId && !knownTeamIds.has(c.teamId) && (!c.createdBy || c.createdBy === currentUserId),
  );
  if (orphaned.length > 0) {
    groups.push({ key: 'orphaned', label: 'Shared (team unavailable)', isTeam: true, collections: orphaned });
  }

  return groups;
}

function filterContainer<T extends Container>(container: T, q: string): T | null {
  if (container.name.toLowerCase().includes(q)) return container;
  const folders = container.folders
    .map((f) => filterContainer(f, q))
    .filter((f): f is NonNullable<typeof f> => f !== null);
  const requests = container.requests.filter(
    (r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q),
  );
  if (folders.length || requests.length) return { ...container, folders, requests };
  return null;
}

export function CollectionsPanel() {
  const collections = useCollectionStore((s) => s.collections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const createFolder = useCollectionStore((s) => s.createFolder);
  const renameContainer = useCollectionStore((s) => s.renameContainer);
  const deleteContainer = useCollectionStore((s) => s.deleteContainer);
  const duplicateContainer = useCollectionStore((s) => s.duplicateContainer);
  const duplicateRequest = useCollectionStore((s) => s.duplicateRequest);
  const deleteRequest = useCollectionStore((s) => s.deleteRequest);
  const importAsCollection = useCollectionStore((s) => s.importAsCollection);
  const importIntoContainer = useCollectionStore((s) => s.importIntoContainer);

  const loadRequest = useRequestStore((s) => s.loadRequest);
  const activeRequestId = useRequestStore((s) => s.savedRef?.requestId ?? null);
  const openShareToTeam = useDialogStore((s) => s.openShareToTeam);
  const teams = useTeamStore((s) => s.teams);
  const currentUserId = useAccountStore((s) => s.session?.user.id ?? null);
  const personalWorkspaceName = useSettingsStore((s) => s.personalWorkspaceName);
  const setPersonalWorkspaceName = useSettingsStore((s) => s.setPersonalWorkspaceName);

  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const createEnvironment = useEnvironmentStore((s) => s.createEnvironment);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const upsertVariable = useEnvironmentStore((s) => s.upsertVariable);

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [folderParent, setFolderParent] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { id: string; name: string; kind: 'container' | 'request' } | null
  >(null);
  const [personalRenameOpen, setPersonalRenameOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const importTarget = useRef<string | null>(null);

  const toggle = (id: string) => setCollapsed((m) => ({ ...m, [id]: !m[id] }));

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? (collections
            .map((c) => filterContainer(c, q))
            .filter((c): c is Collection => c !== null))
        : collections,
    [collections, q],
  );

  const groups = useMemo(
    () => groupByWorkspace(visible, teams, personalWorkspaceName, currentUserId),
    [visible, teams, personalWorkspaceName, currentUserId],
  );

  const actions: CollectionActions = {
    activeRequestId,
    openRequest: (containerId, req) => loadRequest(req, { containerId, requestId: req.id }),
    newFolder: (parentId) => setFolderParent(parentId),
    rename: (c) => setRenameTarget({ id: c.id, name: c.name }),
    duplicate: (id) => duplicateContainer(id),
    removeContainer: (c) => setDeleteTarget({ id: c.id, name: c.name, kind: 'container' }),
    exportItem: (c) => {
      const activeEnv = environments.find((e) => e.id === activeEnvId);
      const sharedVars = (activeEnv?.variables ?? [])
        .filter((v) => v.shared && v.key.trim() !== '')
        .map((v) => ({ key: v.key.trim(), value: v.value }));
      downloadJson(`apitab-${sanitizeFilename(c.name)}.json`, exportContainer(c, sharedVars));
      toast.success(
        sharedVars.length
          ? `Exported with ${sharedVars.length} shared variable${sharedVars.length === 1 ? '' : 's'}`
          : 'Exported',
      );
    },
    importInto: (containerId) => {
      importTarget.current = containerId;
      fileRef.current?.click();
    },
    duplicateRequest,
    deleteRequest: (req) => setDeleteTarget({ id: req.id, name: req.name, kind: 'request' }),
    shareToTeam: (collectionId) => openShareToTeam(collectionId),
  };

  const importCollectionExport = (data: NonNullable<ReturnType<typeof parseCollectionExport>['data']>) => {
    const target = importTarget.current;
    if (target) importIntoContainer(target, data);
    else importAsCollection(data);

    const sharedVars = data.environmentVariables;
    if (sharedVars?.length) {
      let envId = activeEnvId;
      let envName = environments.find((e) => e.id === envId)?.name;
      if (!envId) {
        const created = createEnvironment('Imported');
        envId = created.id;
        envName = created.name;
        setActiveEnvironment(envId);
      }
      for (const v of sharedVars) upsertVariable(envId, v.key, v.value);
      toast.success(
        `Imported with ${sharedVars.length} shared variable${sharedVars.length === 1 ? '' : 's'} into "${envName}"`,
      );
    } else {
      toast.success('Imported');
    }
  };

  const onFile = async (file: File) => {
    const raw = await readFileAsText(file);

    const native = parseCollectionExport(raw);
    if (native.ok && native.data) {
      importCollectionExport(native.data);
      return;
    }

    // Not an ApiTab export — try it as a Postman collection or environment.
    const postman = parsePostmanFile(raw);
    if (postman.ok && postman.data) {
      importCollectionExport(postman.data);
      return;
    }
    if (postman.ok && postman.environment) {
      const created = createEnvironment(postman.environment.name);
      setActiveEnvironment(created.id);
      for (const v of postman.environment.variables) upsertVariable(created.id, v.key, v.value);
      toast.success(`Imported "${created.name}" with ${postman.environment.variables.length} variables`);
      return;
    }

    toast.error(native.error ?? 'Invalid file — not an ApiTab or Postman export');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests"
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
          />
        </div>
        <IconButton
          size="sm"
          title="Import collection"
          onClick={() => {
            importTarget.current = null;
            fileRef.current?.click();
          }}
        >
          <Upload className="h-4 w-4" />
        </IconButton>
        <IconButton size="sm" title="New collection" onClick={() => setCreateOpen(true)}>
          <FolderPlus className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
        {visible.length === 0 ? (
          <EmptyState
            icon={Folder}
            title={q ? 'No matches' : 'No collections'}
            description={q ? undefined : 'Save a request or import a collection to get started.'}
          />
        ) : (
          <ActionsContext.Provider value={actions}>
            {groups.map((group) => (
              <div key={group.key} className="mb-3">
                <div
                  className={cn(
                    'group/ws mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
                    group.isTeam ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {group.isTeam ? (
                    <Users className="h-3 w-3 shrink-0" />
                  ) : (
                    <User className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{group.label}</span>
                  {group.role && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium normal-case',
                        group.role === 'member'
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
                      )}
                    >
                      {group.role}
                    </span>
                  )}
                  {!group.isTeam && (
                    <button
                      onClick={() => setPersonalRenameOpen(true)}
                      title="Rename workspace"
                      aria-label="Rename workspace"
                      className="ml-auto shrink-0 rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-600 group-hover/ws:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    group.isTeam &&
                      'rounded-md border-l-2 border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/10',
                  )}
                >
                  {group.collections.map((c) => (
                    <ContainerNode
                      key={c.id}
                      container={c}
                      depth={0}
                      collapsed={q ? {} : collapsed}
                      toggle={toggle}
                      role={group.role}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </ActionsContext.Provider>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />

      <PromptDialog
        open={createOpen}
        title="New Collection"
        label="Collection name"
        placeholder="My Collection"
        confirmLabel="Create"
        onConfirm={(v) => createCollection(v)}
        onClose={() => setCreateOpen(false)}
      />
      <PromptDialog
        open={folderParent !== null}
        title="New Folder"
        label="Folder name"
        placeholder="My Folder"
        confirmLabel="Create"
        onConfirm={(v) => folderParent && createFolder(folderParent, v)}
        onClose={() => setFolderParent(null)}
      />
      <PromptDialog
        open={!!renameTarget}
        title="Rename"
        label="Name"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onConfirm={(v) => renameTarget && renameContainer(renameTarget.id, v)}
        onClose={() => setRenameTarget(null)}
      />
      <PromptDialog
        open={personalRenameOpen}
        title="Rename Workspace"
        label="Workspace name"
        initialValue={personalWorkspaceName}
        confirmLabel="Rename"
        onConfirm={(v) => setPersonalWorkspaceName(v)}
        onClose={() => setPersonalRenameOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.kind === 'request' ? 'Delete Request' : 'Delete'}
        message={
          <>
            Delete <b>{deleteTarget?.name || 'this item'}</b>
            {deleteTarget?.kind === 'container' ? ' and everything inside it' : ''}? This cannot be
            undone.
          </>
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'request') deleteRequest(deleteTarget.id);
          else deleteContainer(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
      <ShareToTeamDialog />
    </div>
  );
}
