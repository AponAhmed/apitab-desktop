import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { useStressTestStore } from '@/stores/stressTestStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const DEFAULT_COUNT = 10;
const DEFAULT_INTERVAL_MS = 100;

export function StressTestConfigModal() {
  const configTarget = useStressTestStore((s) => s.configTarget);
  const closeConfig = useStressTestStore((s) => s.closeConfig);
  const startRun = useStressTestStore((s) => s.startRun);
  const expandRun = useStressTestStore((s) => s.expandRun);

  const [count, setCount] = useState(DEFAULT_COUNT);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [storeResponse, setStoreResponse] = useState(false);

  // Reset the form whenever a different request is targeted, so reopening
  // for a new request never carries over a prior request's values.
  useEffect(() => {
    if (configTarget) {
      setCount(DEFAULT_COUNT);
      setIntervalMs(DEFAULT_INTERVAL_MS);
      setStoreResponse(false);
    }
  }, [configTarget]);

  const valid = Number.isFinite(count) && count >= 1 && Number.isFinite(intervalMs) && intervalMs >= 1;

  const onStart = () => {
    if (!configTarget || !valid) return;
    const id = startRun(configTarget, { count, intervalMs, storeResponse });
    closeConfig();
    expandRun(id);
  };

  return (
    <Modal
      open={configTarget !== null}
      onClose={closeConfig}
      title={`Concurrent Test — ${configTarget?.name || configTarget?.url || 'Untitled'}`}
      className="max-w-sm"
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Number of requests
          </span>
          <Input
            type="number"
            min={1}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.valueAsNumber)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Interval (ms)
          </span>
          <Input
            type="number"
            min={1}
            step={1}
            value={intervalMs}
            onChange={(e) => setIntervalMs(e.target.valueAsNumber)}
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={storeResponse}
            onChange={(e) => setStoreResponse(e.target.checked)}
          />
          Store response body
        </label>
        <p className="text-[11px] text-slate-400">
          Off by default — keeps memory use low for large request counts.
        </p>

        <div className="flex justify-end pt-1">
          <Button variant="primary" size="sm" onClick={onStart} disabled={!valid}>
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        </div>
      </div>
    </Modal>
  );
}
