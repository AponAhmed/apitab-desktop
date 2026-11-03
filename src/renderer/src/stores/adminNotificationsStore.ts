import { create } from 'zustand';
import type { AdminNotification } from '@/types';

interface AdminNotificationsState {
  notifications: AdminNotification[];
  setAll: (notifications: AdminNotification[]) => void;
  remove: (id: string) => void;
}

/**
 * In-app messages pushed from the admin panel, not yet dismissed. Not
 * persisted — always freshly repopulated from the server on each sync tick
 * (see syncService.ts), matching pendingAssignmentsStore's ephemeral style.
 */
export const useAdminNotificationsStore = create<AdminNotificationsState>((set) => ({
  notifications: [],
  setAll: (notifications) => set({ notifications }),
  remove: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));
