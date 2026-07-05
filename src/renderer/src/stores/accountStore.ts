import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { AuthSession } from '@/types';

interface AccountState {
  /** Bearer-token session; stored locally, sent as `Authorization: Bearer <token>`. */
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: 'apitab:account',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ session }) => ({ session }),
    },
  ),
);
