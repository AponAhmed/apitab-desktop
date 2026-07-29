import { Copy, Minus, Square, X } from 'lucide-react';
import { useWindowControls } from '@/hooks/useWindowControls';
import { cn } from '@/utils/cn';

const BASE =
  'inline-grid h-11 w-11 place-items-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200';

/**
 * Custom minimize/maximize/close controls for Windows/Linux, where the
 * window is frameless (main/index.ts) with no native title bar to supply
 * these. macOS keeps its own real traffic-light buttons instead (set up via
 * `titleBarStyle: 'hidden'` in main/index.ts) — rendering nothing here
 * avoids a second, redundant set of controls.
 */
export function WindowControls() {
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls();

  if (window.api.platform === 'darwin') return null;

  return (
    // Stops a double-click on these buttons from also bubbling up to the
    // TopBar header's onDoubleClick (toggleMaximize) — no-drag only exempts
    // this region from the OS-level drag/maximize hit-testing, not from a
    // plain JS event bubbling through it. Most visible on the maximize
    // button itself: without this, a double-click would toggle twice
    // (once via this button's own onClick firing twice, once via the
    // bubbled header handler) instead of once.
    <div className="flex h-full items-stretch [-webkit-app-region:no-drag]" onDoubleClick={(e) => e.stopPropagation()}>
      <button type="button" className={BASE} title="Minimize" aria-label="Minimize" onClick={minimize}>
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={BASE}
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={toggleMaximize}
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        className={cn(BASE, 'hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white')}
        title="Close"
        aria-label="Close"
        onClick={close}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
