import { Globe } from 'lucide-react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { Select } from '@/components/ui/Select';

export function EnvironmentSelector() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActive = useEnvironmentStore((s) => s.setActiveEnvironment);

  return (
    <div className="flex items-center gap-1.5" title="Active environment">
      <Globe className="h-4 w-4 shrink-0 text-slate-400" />
      <Select
        value={activeId ?? ''}
        onChange={(e) => setActive(e.target.value || null)}
        className="h-8 w-36 text-xs border-transparent bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 shadow-none focus:ring-0"
        aria-label="Active environment"
      >
        <option value="">No Environment</option>
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
