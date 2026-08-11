import { Zap } from 'lucide-react';
import { useStressTestStore } from '@/stores/stressTestStore';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { StressTestRunRow } from './StressTestRunRow';
import { StressTestRunDetail } from './StressTestRunDetail';

/**
 * Floating, draggable panel listing every active/recent stress-test run —
 * one shared panel (download-manager style), not one indicator per run.
 * Mounted at the top level (Workspace.tsx), not inside CollectionsPanel, so
 * it survives switching sidebar tabs. Renders nothing when there are no
 * runs at all (active or finished-but-not-dismissed).
 */
export function StressTestPanel() {
  const order = useStressTestStore((s) => s.order);
  const expandedRunId = useStressTestStore((s) => s.expandedRunId);
  const { panelRef, position, onDragHandlePointerDown } = useDraggablePanel();

  if (order.length === 0) return null;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 left-4 z-40 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {expandedRunId === null && (
        <>
          <div
            onPointerDown={onDragHandlePointerDown}
            className="flex cursor-move items-center gap-1.5 border-b border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Stress Tests
            </span>
            <span className="ml-auto text-[11px] text-slate-400">{order.length}</span>
          </div>
          <div className="max-h-[50vh] w-72 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
            {order.map((id) => (
              <StressTestRunRow key={id} runId={id} />
            ))}
          </div>
        </>
      )}

      {expandedRunId !== null && (
        <StressTestRunDetail runId={expandedRunId} onHeaderPointerDown={onDragHandlePointerDown} />
      )}
    </div>
  );
}
