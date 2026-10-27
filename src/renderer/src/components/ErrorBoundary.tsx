import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the tree below it (a React error
 * boundary can't be written as a function component — componentDidCatch has
 * no hook equivalent) and reports them to the main process's log instead of
 * leaving the window on a blank/frozen screen with no trace of what
 * happened. Deliberately the only thing wrapping <App/> in main.tsx, so a
 * crash anywhere still leaves the window controls/reload path intact.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void window.api.log.error({
      message: error.message,
      stack: error.stack,
      context: `React render error${info.componentStack ? `:${info.componentStack}` : ''}`,
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center dark:bg-slate-950">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Something went wrong</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            This has been written to the app's log file. Reloading usually clears it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
