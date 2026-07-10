import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { UpdateStatusPanel } from './UpdateStatusPanel';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';

const WIDTH = 320;

/** Bell + popover for an available/downloading/downloaded self-update — the passive alternative to digging into About. */
export function UpdateAvailableBell() {
  const { status } = useAutoUpdate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Only surface a bell once there's something to act on — "checking" and
  // "not-available" stay silent (About's manual check already covers those),
  // matching PendingAssignmentsBell's "nothing to show, render nothing" rule.
  const actionable =
    status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded';
  if (!actionable && !open) return null;

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
          title={status.state === 'downloaded' ? 'Update ready to install' : 'Update available'}
          aria-label="Update available"
          onClick={toggle}
        >
          <Download className="h-4 w-4" />
        </IconButton>
        {actionable && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-[#0f111a]" />
        )}
      </div>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{ position: 'fixed', left: pos.x, top: pos.y, width: WIDTH }}
              onClick={(e) => e.stopPropagation()}
              className="z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              <UpdateStatusPanel />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
