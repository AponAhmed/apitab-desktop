import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { HistoryEntry } from '@/types';

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry, limit: number) => void;
  deleteEntry: (id: string) => void;
  clearAll: () => void;
  replaceAll: (entries: HistoryEntry[]) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry, limit) =>
        set((s) => ({ entries: [entry, ...s.entries].slice(0, Math.max(1, limit)) })),

      deleteEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      clearAll: () => set({ entries: [] }),

      replaceAll: (entries) => set({ entries }),
    }),
    {
      name: 'apitab:history',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ entries }) => ({ entries }),
    },
  ),
);
