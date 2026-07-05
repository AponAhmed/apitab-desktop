import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uuid } from '@/utils/id';
import { browserLocalStorage } from './persist';
import { useTeamStore } from './teamStore';
import { useTeamVariablesStore } from './teamVariablesStore';
import type { Environment, EnvVariable } from '@/types';
import type { VariableMap } from '@/utils/variables';

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  createEnvironment: (name: string) => Environment;
  renameEnvironment: (id: string, name: string) => void;
  deleteEnvironment: (id: string) => void;
  duplicateEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  addVariable: (envId: string) => void;
  updateVariable: (envId: string, varId: string, patch: Partial<EnvVariable>) => void;
  removeVariable: (envId: string, varId: string) => void;
  /** Sets a variable by key (updating it if present, otherwise adding it). */
  upsertVariable: (envId: string, key: string, value: string) => void;
  getActiveVariables: () => VariableMap;
  replaceAll: (environments: Environment[]) => void;
  mergeImported: (environments: Environment[]) => void;
}

function emptyVariable(): EnvVariable {
  return { id: uuid(), key: '', value: '', enabled: true };
}

/** Coerces possibly-corrupted (e.g. null from legacy/synced data) fields to safe strings. */
function sanitizeVariable(v: EnvVariable): EnvVariable {
  return { ...v, key: v.key ?? '', value: v.value ?? '', enabled: v.enabled ?? true };
}

function sanitizeEnvironment(env: Environment): Environment {
  return { ...env, variables: (env.variables ?? []).map(sanitizeVariable) };
}

function touch(env: Environment): Environment {
  return { ...env, updatedAt: Date.now() };
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environments: [],
      activeEnvironmentId: null,

      createEnvironment: (name) => {
        const now = Date.now();
        const env: Environment = {
          id: uuid(),
          name: name.trim() || 'New Environment',
          variables: [emptyVariable()],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          environments: [...s.environments, env],
          activeEnvironmentId: s.activeEnvironmentId ?? env.id,
        }));
        return env;
      },

      renameEnvironment: (id, name) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === id ? touch({ ...e, name: name.trim() || e.name }) : e,
          ),
        })),

      deleteEnvironment: (id) =>
        set((s) => ({
          environments: s.environments.filter((e) => e.id !== id),
          activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
        })),

      duplicateEnvironment: (id) =>
        set((s) => {
          const original = s.environments.find((e) => e.id === id);
          if (!original) return s;
          const now = Date.now();
          const copy: Environment = {
            id: uuid(),
            name: `${original.name} Copy`,
            variables: original.variables.map((v) => sanitizeVariable({ ...v, id: uuid() })),
            createdAt: now,
            updatedAt: now,
          };
          const index = s.environments.findIndex((e) => e.id === id);
          const next = [...s.environments];
          next.splice(index + 1, 0, copy);
          return { environments: next };
        }),

      setActiveEnvironment: (activeEnvironmentId) => set({ activeEnvironmentId }),

      addVariable: (envId) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === envId ? touch({ ...e, variables: [...e.variables, emptyVariable()] }) : e,
          ),
        })),

      updateVariable: (envId, varId, patch) =>
        set((s) => ({
          environments: s.environments.map((e) => {
            if (e.id !== envId) return e;
            const variables = e.variables
              .map((v) => (v.id === varId ? { ...v, ...patch } : v))
              .map(sanitizeVariable);
            // Keep a trailing empty row available for quick entry.
            const last = variables[variables.length - 1];
            if (!last || last.key.trim() !== '' || last.value.trim() !== '') {
              variables.push(emptyVariable());
            }
            return touch({ ...e, variables });
          }),
        })),

      removeVariable: (envId, varId) =>
        set((s) => ({
          environments: s.environments.map((e) =>
            e.id === envId
              ? touch({ ...e, variables: e.variables.filter((v) => v.id !== varId) })
              : e,
          ),
        })),

      upsertVariable: (envId, key, value) =>
        set((s) => ({
          environments: s.environments.map((e) => {
            if (e.id !== envId) return e;
            const trimmed = key.trim();
            const variables = e.variables.map(sanitizeVariable);
            const idx = variables.findIndex((v) => v.key.trim() === trimmed);
            if (idx >= 0) {
              variables[idx] = { ...variables[idx], value, enabled: true };
            } else {
              const row: EnvVariable = { id: uuid(), key: trimmed, value, enabled: true };
              const lastIdx = variables.length - 1;
              const last = variables[lastIdx];
              if (last && last.key.trim() === '' && last.value.trim() === '') {
                variables.splice(lastIdx, 0, row);
              } else {
                variables.push(row);
              }
            }
            return touch({ ...e, variables });
          }),
        })),

      getActiveVariables: () => {
        const { environments, activeEnvironmentId } = get();
        const map: VariableMap = {};

        // Team shared-variable pool is a lower-priority base layer — the
        // active environment's own values win on a key collision.
        const activeTeamId = useTeamStore.getState().activeTeamId;
        if (activeTeamId) {
          for (const v of useTeamVariablesStore.getState().variablesByTeam[activeTeamId] ?? []) {
            map[v.key] = v.value;
          }
        }

        const env = environments.find((e) => e.id === activeEnvironmentId);
        if (env) {
          for (const v of env.variables.map(sanitizeVariable)) {
            if (v.enabled && v.key.trim() !== '') map[v.key.trim()] = v.value;
          }
        }
        return map;
      },

      replaceAll: (environments) => set({ environments: environments.map(sanitizeEnvironment) }),

      mergeImported: (incoming) =>
        set((s) => {
          const byId = new Map(s.environments.map((e) => [e.id, e]));
          for (const e of incoming) byId.set(e.id, sanitizeEnvironment(e));
          return { environments: [...byId.values()] };
        }),
    }),
    {
      name: 'apitab:environments',
      storage: createJSONStorage(() => browserLocalStorage),
      partialize: ({ environments, activeEnvironmentId }) => ({
        environments,
        activeEnvironmentId,
      }),
      // Sanitize on rehydration so already-persisted corrupted data (e.g. a
      // null key from a historical bug) can't crash the app on next launch.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { environments?: Environment[]; activeEnvironmentId?: string | null };
        return {
          ...current,
          environments: (p.environments ?? []).map(sanitizeEnvironment),
          activeEnvironmentId: p.activeEnvironmentId ?? current.activeEnvironmentId,
        };
      },
    },
  ),
);
