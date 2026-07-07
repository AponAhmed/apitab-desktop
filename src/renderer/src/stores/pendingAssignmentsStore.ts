import { create } from 'zustand';
import type { PendingAssignment } from '@/types';

interface PendingAssignmentsState {
  assignments: PendingAssignment[];
  setAll: (assignments: PendingAssignment[]) => void;
  remove: (id: string) => void;
}

/**
 * The current user's pending collection-share offers. Not persisted —
 * always freshly repopulated from the server on each sync tick (see
 * syncService.ts), matching toastStore's ephemeral style.
 */
export const usePendingAssignmentsStore = create<PendingAssignmentsState>((set) => ({
  assignments: [],
  setAll: (assignments) => set({ assignments }),
  remove: (id) => set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),
}));
