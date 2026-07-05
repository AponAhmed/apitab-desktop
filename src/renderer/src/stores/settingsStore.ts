import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type Settings, type ThemeMode } from '@/types';
import { browserLocalStorage } from './persist';

interface SettingsState extends Settings {
  setTheme: (theme: ThemeMode) => void;
  setRequestTimeout: (ms: number) => void;
  setHistoryLimit: (limit: number) => void;
  importSettings: (settings: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setRequestTimeout: (requestTimeoutMs) => set({ requestTimeoutMs }),
      setHistoryLimit: (historyLimit) => set({ historyLimit }),
      importSettings: (settings) => set((s) => ({ ...s, ...settings })),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'apitab:settings',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ theme, requestTimeoutMs, historyLimit }) => ({
        theme,
        requestTimeoutMs,
        historyLimit,
      }),
    },
  ),
);
