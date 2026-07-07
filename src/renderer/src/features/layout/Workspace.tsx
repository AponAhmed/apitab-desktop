import { useUiStore } from '@/stores/uiStore';
import { useApplyTheme } from '@/hooks/useApplyTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRequestActions } from '@/hooks/useRequestActions';
import { usePanelResize, useHorizontalResize } from '@/hooks/usePanelResize';
import { useTeamSync } from '@/hooks/useTeamSync';
import { TopBar } from './TopBar';
import { Sidebar, SidebarRail } from './Sidebar';
import { RequestToolbar } from '@/features/requests/RequestToolbar';
import { UrlBar } from '@/features/requests/UrlBar';
import { RequestEditor } from '@/features/requests/RequestEditor';
import { ResponsePanel } from '@/features/requests/ResponsePanel';
import { RecentRequestsBar } from './RecentRequestsBar';
import { AppDialogs } from '@/components/AppDialogs';
import { Toaster } from '@/components/Toaster';

export function Workspace() {
  useApplyTheme();
  useTeamSync();

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const responseHeight = useUiStore((s) => s.responseHeight);
  const setResponseHeight = useUiStore((s) => s.setResponseHeight);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);

  const { save, copyCurl, send, newRequest } = useRequestActions();
  useKeyboardShortcuts({ onSend: send, onSave: save, onCopyCurl: copyCurl, onNew: newRequest });

  const onResizeStart = usePanelResize(responseHeight, setResponseHeight);
  const onSidebarResizeStart = useHorizontalResize(sidebarWidth, setSidebarWidth);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        {collapsed ? (
          <SidebarRail />
        ) : (
          <>
            <Sidebar />
            <div
              onPointerDown={onSidebarResizeStart}
              className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center border-x border-slate-200 bg-slate-100 hover:bg-brand-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-brand-950"
              title="Drag to resize"
            >
              <div className="h-8 w-0.5 rounded-full bg-slate-300 group-hover:bg-brand-400 dark:bg-slate-600" />
            </div>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-1.5 border-b border-slate-200 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900">
            <RequestToolbar />
            <UrlBar />
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <RequestEditor />
          </div>

          <div
            onPointerDown={onResizeStart}
            className="group flex h-1.5 shrink-0 cursor-row-resize items-center justify-center border-y border-slate-200 bg-slate-100 hover:bg-brand-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-brand-950"
            title="Drag to resize"
          >
            <div className="h-0.5 w-8 rounded-full bg-slate-300 group-hover:bg-brand-400 dark:bg-slate-600" />
          </div>

          <div style={{ height: responseHeight }} className="min-h-0 shrink-0">
            <ResponsePanel />
          </div>

          <RecentRequestsBar />
        </main>
      </div>

      <Toaster />
      <AppDialogs />
    </div>
  );
}
