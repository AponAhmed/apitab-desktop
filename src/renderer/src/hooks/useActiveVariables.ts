import { useMemo } from 'react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import type { VariableMap } from '@/utils/variables';

/** Reactively resolves the active environment's enabled variables to a map. */
export function useActiveVariables(): VariableMap {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeId = useEnvironmentStore((s) => s.activeEnvironmentId);

  return useMemo(() => {
    const env = environments.find((e) => e.id === activeId);
    const map: VariableMap = {};
    if (env) {
      for (const v of env.variables) {
        if (v.enabled && v.key.trim() !== '') map[v.key.trim()] = v.value;
      }
    }
    return map;
  }, [environments, activeId]);
}
