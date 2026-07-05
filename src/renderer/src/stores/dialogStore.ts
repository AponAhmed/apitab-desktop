import { create } from 'zustand';

interface DialogState {
  saveRequestOpen: boolean;
  importCurlOpen: boolean;
  loginOpen: boolean;
  shareToTeamCollectionId: string | null;
  /**
   * Desktop has no separate options-page surface (unlike the extension's
   * `browser.runtime.openOptionsPage()`) — Settings renders as an in-window
   * overlay instead, toggled by this flag.
   */
  settingsOpen: boolean;
  openSaveRequest: () => void;
  closeSaveRequest: () => void;
  openImportCurl: () => void;
  closeImportCurl: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  openShareToTeam: (collectionId: string) => void;
  closeShareToTeam: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

/** Ephemeral (non-persisted) coordination of app-level dialogs. */
export const useDialogStore = create<DialogState>((set) => ({
  saveRequestOpen: false,
  importCurlOpen: false,
  loginOpen: false,
  shareToTeamCollectionId: null,
  settingsOpen: false,
  openSaveRequest: () => set({ saveRequestOpen: true }),
  closeSaveRequest: () => set({ saveRequestOpen: false }),
  openImportCurl: () => set({ importCurlOpen: true }),
  closeImportCurl: () => set({ importCurlOpen: false }),
  openLogin: () => set({ loginOpen: true }),
  closeLogin: () => set({ loginOpen: false }),
  openShareToTeam: (collectionId) => set({ shareToTeamCollectionId: collectionId }),
  closeShareToTeam: () => set({ shareToTeamCollectionId: null }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
