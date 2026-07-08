import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';

export type SidebarTab = 'collections' | 'history' | 'environments';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarTab: SidebarTab;
  /** Width of the left sidebar, in pixels. */
  sidebarWidth: number;
  /** Height of the bottom response panel, in pixels. */
  responseHeight: number;
  /** Collapsed/expanded state per collection or folder id, keyed for persistence across restarts. */
  collapsedContainers: Record<string, boolean>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarWidth: (width: number) => void;
  setResponseHeight: (height: number) => void;
  toggleContainerCollapsed: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarTab: 'collections',
      sidebarWidth: 288,
      responseHeight: 320,
      collapsedContainers: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setSidebarWidth: (sidebarWidth) =>
        set({ sidebarWidth: Math.max(200, Math.min(560, sidebarWidth)) }),
      setResponseHeight: (responseHeight) =>
        set({ responseHeight: Math.max(120, Math.min(900, responseHeight)) }),
      toggleContainerCollapsed: (id) =>
        set((s) => ({ collapsedContainers: { ...s.collapsedContainers, [id]: !s.collapsedContainers[id] } })),
    }),
    { name: 'apitab:ui', storage: createJSONStorage(() => browserLocalStorage) },
  ),
);
