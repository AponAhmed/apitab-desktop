import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { AuthSession, AuthUser } from '@/types';

interface AccountState {
  /** Bearer-token session; stored locally, sent as `Authorization: Bearer <token>`. */
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  /** Patches the current session's user (e.g. emailVerified flipping true) without touching the token. */
  updateUser: (user: AuthUser) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      updateUser: (user) => set((s) => (s.session ? { session: { ...s.session, user } } : s)),
    }),
    {
      name: 'apitab:account',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ session }) => ({ session }),
    },
  ),
);
