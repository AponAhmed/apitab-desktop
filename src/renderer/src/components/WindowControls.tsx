import { Copy, Minus, Square, X } from 'lucide-react';
import { useWindowControls } from '@/hooks/useWindowControls';
import { cn } from '@/utils/cn';

const BASE =
  'inline-grid h-11 w-11 place-items-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200';

/** Custom minimize/maximize/close controls — the window is `frame: false` (main/index.ts), so there's no native title bar to supply these. Must sit outside TopBar's drag region. */
export function WindowControls() {
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls();

  return (
    <div className="flex h-full items-stretch [-webkit-app-region:no-drag]">
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
