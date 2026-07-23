import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { Team, TeamMember } from '@/types';

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  members: Record<string, TeamMember[]>;
  /** Per-team polling cursor (server-issued ms timestamp, not the client clock). */
  lastSyncedAt: Record<string, number>;
  lastSyncError: string | null;
  isSyncing: boolean;

  setTeams: (teams: Team[]) => void;
  setActiveTeam: (id: string | null) => void;
  removeTeamFromStore: (teamId: string) => void;
  renameTeamInStore: (teamId: string, name: string) => void;
  setMembers: (teamId: string, members: TeamMember[]) => void;
  addMemberToStore: (teamId: string, member: TeamMember) => void;
  removeMemberFromStore: (teamId: string, userId: string) => void;
  recordSync: (teamId: string, serverTime: number) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  reset: () => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      teams: [],
      activeTeamId: null,
      members: {},
      lastSyncedAt: {},
      lastSyncError: null,
      isSyncing: false,

      setTeams: (teams) =>
        set((s) => ({
          teams,
          // Preserve whatever workspace was active (including "Personal",
          // i.e. null) if it's still valid; otherwise fall back to Personal
          // rather than an arbitrary first team — the active workspace also
          // drives which collections the sidebar shows, so jumping to
          // teams[0] here used to hijack the user's own selection on every
          // team-list refresh.
          activeTeamId: s.activeTeamId && teams.some((t) => t.id === s.activeTeamId) ? s.activeTeamId : null,
        })),
      setActiveTeam: (activeTeamId) => set({ activeTeamId }),
      removeTeamFromStore: (teamId) =>
        set((s) => {
          const { [teamId]: _members, ...members } = s.members;
          const { [teamId]: _lastSyncedAt, ...lastSyncedAt } = s.lastSyncedAt;
          return {
            teams: s.teams.filter((t) => t.id !== teamId),
            activeTeamId: s.activeTeamId === teamId ? null : s.activeTeamId,
            members,
            lastSyncedAt,
          };
        }),
      renameTeamInStore: (teamId, name) =>
        set((s) => ({ teams: s.teams.map((t) => (t.id === teamId ? { ...t, name } : t)) })),
      setMembers: (teamId, teamMembers) =>
        set((s) => ({ members: { ...s.members, [teamId]: teamMembers } })),
      addMemberToStore: (teamId, member) =>
        set((s) => ({
          members: {
            ...s.members,
            [teamId]: [...(s.members[teamId] || []), member],
          },
        })),
      removeMemberFromStore: (teamId, userId) =>
        set((s) => ({
          members: {
            ...s.members,
            [teamId]: (s.members[teamId] || []).filter((m) => m.userId !== userId),
          },
        })),
      recordSync: (teamId, serverTime) =>
        set((s) => ({ lastSyncedAt: { ...s.lastSyncedAt, [teamId]: serverTime } })),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setSyncError: (lastSyncError) => set({ lastSyncError }),
      reset: () =>
        set({
          teams: [],
          activeTeamId: null,
          members: {},
          lastSyncedAt: {},
          lastSyncError: null,
          isSyncing: false,
        }),
    }),
    {
      name: 'apitab:teams',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ teams, activeTeamId, members, lastSyncedAt }) => ({
        teams,
        activeTeamId,
        members,
        lastSyncedAt,
      }),
    },
  ),
);
