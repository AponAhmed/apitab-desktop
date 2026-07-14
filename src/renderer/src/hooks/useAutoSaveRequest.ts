import { useEffect } from 'react';
import { useRequestStore } from '@/stores/requestStore';

/** How long to wait after the last edit before persisting. */
const AUTOSAVE_DELAY_MS = 1200;

/**
 * Debounced auto-save for the currently open request, only once it already
 * lives in a collection (`savedRef !== null`) — a scratch/unsaved draft only
 * ever saves via an explicit action (the Save button/Ctrl+S), so it isn't
 * silently turned into a collection entry here.
 */
export function useAutoSaveRequest() {
  const savedRef = useRequestStore((s) => s.savedRef);
  const isDirty = useRequestStore((s) => s.isDirty);
  // `updatedAt` changes on every single edit (patch() stamps it fresh each
  // time), unlike `isDirty` which flips true once and then stays true for
  // the whole burst — depending on it is what makes this a real debounce
  // (timer resets per keystroke) instead of a one-shot delay after the
  // first edit in a burst.
  const updatedAt = useRequestStore((s) => s.request.updatedAt);

  useEffect(() => {
    if (!savedRef || !isDirty) return;
    const timer = setTimeout(() => {
      useRequestStore.getState().updateSaved();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [savedRef, isDirty, updatedAt]);
}
