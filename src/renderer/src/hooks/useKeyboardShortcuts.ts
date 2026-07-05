import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onSend?: () => void;
  onSave?: () => void;
  onCopyCurl?: () => void;
  onNew?: () => void;
}

/**
 * Registers the global keyboard shortcuts:
 *  - Ctrl/Cmd + Enter → send
 *  - Ctrl/Cmd + S → save
 *  - Ctrl/Cmd + Shift + K → copy cURL
 *  - Ctrl/Cmd + Alt + N → new request
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === 'enter') {
        e.preventDefault();
        ref.current.onSend?.();
      } else if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        ref.current.onSave?.();
      } else if (key === 'k' && e.shiftKey) {
        e.preventDefault();
        ref.current.onCopyCurl?.();
      } else if (key === 'n' && e.altKey) {
        e.preventDefault();
        ref.current.onNew?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
