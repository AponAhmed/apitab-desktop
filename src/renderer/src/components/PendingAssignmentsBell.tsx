import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { MethodBadge } from './ui/Badge';
import { usePendingAssignmentsStore } from '@/stores/pendingAssignmentsStore';
import { apiClient } from '@/services/apiClient';
import { runSyncTick } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import type { HttpMethod, PendingAssignment } from '@/types';

const WIDTH = 320;

/** A single pending-share offer: preview + Accept/Decline. */
function AssignmentRow({ assignment }: { assignment: PendingAssignment }) {
  const remove = usePendingAssignmentsStore((s) => s.remove);
  const [responding, setResponding] = useState(false);

  const accept = async () => {
    setResponding(true);
    try {
      await apiClient.acceptAssignment(assignment.id);
      remove(assignment.id);
      toast.success(`Added "${assignment.collectionName}" to your workspace`);
      void runSyncTick(assignment.teamId);
    } catch {
      toast.error('Could not accept this share');
    } finally {
      setResponding(false);
    }
  };

  const decline = () => {
    // Optimistic — a failed decline just means it reappears next poll, which is safe.
    remove(assignment.id);
    void apiClient.declineAssignment(assignment.id).catch(() => {});
  };

  return (
    <li className="p-3">
      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
        {assignment.collectionName}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {assignment.assignedByName} shared this via <b>{assignment.teamName}</b> ·{' '}
        {assignment.requestCount} request{assignment.requestCount === 1 ? '' : 's'}
      </p>
      {assignment.previewRequests.length > 0 && (
        <ul className="mt-2 space-y-1">
          {assignment.previewRequests.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <MethodBadge method={r.method as HttpMethod} className="w-10 shrink-0 text-right text-[10px]" />
              <span className="truncate">{r.name}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={decline} disabled={responding}>
          Decline
        </Button>
        <Button size="sm" variant="primary" onClick={() => void accept()} disabled={responding}>
          {responding ? 'Accepting…' : 'Accept'}
        </Button>
      </div>
    </li>
  );
}

/** Bell + popover for collections shared with the current user awaiting Accept/Decline. */
export function PendingAssignmentsBell() {
  const assignments = usePendingAssignmentsStore((s) => s.assignments);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  if (assignments.length === 0 && !open) return null;

  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8)), y: r.bottom + 4 });
    setOpen((o) => !o);
  };

  return (
    <>
      <div className="relative">
        <IconButton
          ref={btnRef}
          title="Pending shares"
          aria-label="Pending shares"
          onClick={toggle}
        >
          <Bell className="h-4 w-4" />
        </IconButton>
        {assignments.length > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-0.5 text-[10px] font-semibold text-white">
            {assignments.length}
          </span>
        )}
      </div>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{ position: 'fixed', left: pos.x, top: pos.y, width: WIDTH }}
              onClick={(e) => e.stopPropagation()}
              className="z-50 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              {assignments.length === 0 ? (
                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No pending shares.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {assignments.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </ul>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
