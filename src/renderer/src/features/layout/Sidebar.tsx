import { Folder, Globe, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUiStore, type SidebarTab } from '@/stores/uiStore';
import { IconButton } from '@/components/ui/IconButton';
import { CollectionsPanel } from '@/features/collections/CollectionsPanel';
import { HistoryPanel } from '@/features/history/HistoryPanel';
import { EnvironmentsPanel } from '@/features/environments/EnvironmentsPanel';
import { cn } from '@/utils/cn';

const TABS: { id: SidebarTab; icon: LucideIcon; label: string }[] = [
  { id: 'collections', icon: Folder, label: 'Collections' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'environments', icon: Globe, label: 'Environments' },
];

export function Sidebar() {
  const tab = useUiStore((s) => s.sidebarTab);
  const setTab = useUiStore((s) => s.setSidebarTab);
  const width = useUiStore((s) => s.sidebarWidth);

  return (
    <aside
      style={{ width }}
      className="flex shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="flex items-center gap-0.5 border-b border-slate-200 p-1.5 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-1 py-1.5 text-xs font-medium transition-colors',
              tab === t.id
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <t.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'collections' && <CollectionsPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'environments' && <EnvironmentsPanel />}
      </div>
    </aside>
  );
}

/** Thin rail shown when the sidebar is collapsed. */
export function SidebarRail() {
  const setTab = useUiStore((s) => s.setSidebarTab);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const open = (id: SidebarTab) => {
    setTab(id);
    setCollapsed(false);
  };

  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-slate-50/70 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      {TABS.map((t) => (
        <IconButton key={t.id} title={t.label} onClick={() => open(t.id)}>
          <t.icon className="h-4 w-4" />
        </IconButton>
      ))}
    </div>
  );
}
