import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from './persist';
import type { TeamVariable } from '@/types';

interface TeamVariablesState {
  /** Flat shared-variable pool per team — independent of any environment. */
  variablesByTeam: Record<string, TeamVariable[]>;

  setTeamVariables: (teamId: string, variables: TeamVariable[]) => void;
  upsertLocal: (teamId: string, variable: TeamVariable) => void;
  removeLocal: (teamId: string, id: string) => void;
  /** Merges a sync poll's result: upserts incoming, drops any listed as deleted. */
  mergeSync: (teamId: string, incoming: TeamVariable[], deletedIds: string[]) => void;
  reset: () => void;
}

export const useTeamVariablesStore = create<TeamVariablesState>()(
  persist(
    (set) => ({
      variablesByTeam: {},

      setTeamVariables: (teamId, variables) =>
        set((s) => ({ variablesByTeam: { ...s.variablesByTeam, [teamId]: variables } })),

      upsertLocal: (teamId, variable) =>
        set((s) => {
          const existing = s.variablesByTeam[teamId] ?? [];
          const idx = existing.findIndex((v) => v.id === variable.id);
          const next =
            idx >= 0
              ? existing.map((v) => (v.id === variable.id ? variable : v))
              : [...existing, variable];
          return { variablesByTeam: { ...s.variablesByTeam, [teamId]: next } };
        }),

      removeLocal: (teamId, id) =>
        set((s) => ({
          variablesByTeam: {
            ...s.variablesByTeam,
            [teamId]: (s.variablesByTeam[teamId] ?? []).filter((v) => v.id !== id),
          },
        })),

      mergeSync: (teamId, incoming, deletedIds) =>
        set((s) => {
          const byId = new Map((s.variablesByTeam[teamId] ?? []).map((v) => [v.id, v]));
          for (const v of incoming) byId.set(v.id, v);
          for (const id of deletedIds) byId.delete(id);
          return { variablesByTeam: { ...s.variablesByTeam, [teamId]: [...byId.values()] } };
        }),

      reset: () => set({ variablesByTeam: {} }),
    }),
    {
      name: 'apitab:teamVariables',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ variablesByTeam }) => ({ variablesByTeam }),
    },
  ),
);
