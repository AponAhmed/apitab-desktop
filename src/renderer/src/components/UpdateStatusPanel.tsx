import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';

/** Update state + actions, shared by AboutDialog and UpdateAvailableBell. */
export function UpdateStatusPanel() {
  const { status, check, download, install } = useAutoUpdate();
  // downloadUpdate() resolves the update metadata and opens the request
  // before the first 'download-progress' event fires, so status stays
  // 'available' for a beat after the click with nothing on screen to show
  // for it. This tracks just that gap so the button can show its own
  // spinner immediately instead of appearing to do nothing.
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    if (status.state !== 'available') setStarting(false);
  }, [status.state]);

  if (status.state === 'unsupported') return null;

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      {status.state === 'checking' ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking for updates…
        </p>
      ) : status.state === 'available' ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Update available: <span className="font-medium">v{status.version}</span>
          </p>
          {status.downloadUrl ? (
            // macOS: no in-app install — see the comment on UpdateStatus in
            // shared/types.ts for why. Opens the .dmg in the browser instead.
            <Button size="sm" onClick={() => void download()}>
              <Download className="h-3.5 w-3.5" />
              Download Update
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={starting}
              onClick={() => {
                setStarting(true);
                void download();
              }}
            >
              <Download className="h-3.5 w-3.5" />
              {starting ? 'Updating…' : 'Update Now'}
            </Button>
          )}
        </div>
      ) : status.state === 'downloading' ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Downloading update… {status.percent}%
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        </div>
      ) : status.state === 'downloaded' ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> v{status.version} ready to install
          </p>
          <Button size="sm" variant="primary" onClick={() => void install()}>
            Restart &amp; Install
          </Button>
        </div>
      ) : status.state === 'error' ? (
        <div className="flex items-center justify-between gap-2">
          <p
            className="flex min-w-0 items-center gap-1.5 truncate text-xs text-red-600 dark:text-red-400"
            title={status.message}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Update check failed
          </p>
          <Button size="sm" variant="outline" onClick={() => void check()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {status.state === 'not-available' ? "You're up to date." : 'Check for the latest version.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => void check()}>
            <RefreshCw className="h-3.5 w-3.5" /> Check for Updates
          </Button>
        </div>
      )}
    </div>
  );
}
