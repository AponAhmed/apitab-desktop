/**
 * Catches whatever a React error boundary can't (an error thrown outside
 * render — an event handler, a store action, an unhandled promise rejection)
 * and reports it to the main process's day-rotated log (main/logger.ts) via
 * the preload bridge. Call once, as early as possible (main.tsx), before
 * rendering the app.
 */
export function installRuntimeLogging(): void {
  window.addEventListener('error', (e) => {
    void window.api.log.error({
      message: e.message,
      stack: e.error instanceof Error ? e.error.stack : undefined,
      context: 'window.onerror',
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as unknown;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    void window.api.log.error({ message, stack, context: 'unhandledrejection' });
  });
}
