import { useMemo } from 'react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useTeamStore } from '@/stores/teamStore';
import { useTeamVariablesStore } from '@/stores/teamVariablesStore';
import type { VariableMap } from '@/utils/variables';

/**
 * Reactively resolves the active environment's enabled variables to a map,
 * with the active team's shared-variable pool as a lower-priority base layer
 * (environment values win on a key collision — see EnvVariable.shared).
 */
export function useActiveVariables(): VariableMap {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamVariables = useTeamVariablesStore((s) =>
    activeTeamId ? s.variablesByTeam[activeTeamId] : undefined,
  );

  return useMemo(() => {
    const map: VariableMap = {};
    for (const v of teamVariables ?? []) map[v.key] = v.value;
    const env = environments.find((e) => e.id === activeId);
    if (env) {
      for (const v of env.variables) {
        if (v.enabled && v.key.trim() !== '') map[v.key.trim()] = v.value;
      }
    }
    return map;
  }, [environments, activeId, teamVariables]);
}
