import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, ExternalLink } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { useAdminNotificationsStore } from '@/stores/adminNotificationsStore';
import { apiClient } from '@/services/apiClient';
import type { AdminNotification } from '@/types';

const WIDTH = 320;

function NotificationRow({ notification }: { notification: AdminNotification }) {
  const remove = useAdminNotificationsStore((s) => s.remove);
  const [dismissing, setDismissing] = useState(false);

  const dismiss = () => {
    // Optimistic — a failed dismiss just means it reappears next poll, which is safe.
    remove(notification.id);
    setDismissing(true);
    void apiClient.dismissNotification(notification.id).catch(() => {});
  };

  return (
    <li className="p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{notification.title}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
        {notification.message}
      </p>
      {notification.url && (
        <a
          href={notification.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          Learn more <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <div className="mt-2.5 flex justify-end">
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={dismissing}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

/** Bell + popover for admin-pushed in-app messages — polled on the same cadence as team/collection sync, not a push channel. */
export function AdminNotificationBell() {
  const notifications = useAdminNotificationsStore((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  if (notifications.length === 0 && !open) return null;

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
          title="Notifications"
          aria-label="Notifications"
          onClick={toggle}
        >
          <Megaphone className="h-4 w-4" />
        </IconButton>
        {notifications.length > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-0.5 text-[10px] font-semibold text-white">
            {notifications.length}
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
              {notifications.length === 0 ? (
                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No notifications.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {notifications.map((n) => (
                    <NotificationRow key={n.id} notification={n} />
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
