import { useCallback, useEffect, useState } from 'react';
import type { UpdateStatus } from '@shared/types';

/** Desktop-only self-update flow, backed by electron-updater (main/autoUpdate.ts). */
export function useAutoUpdate() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    void window.api.update.getStatus().then(setStatus);
    return window.api.update.onStatus(setStatus);
  }, []);

  return {
    status,
    check: useCallback(() => window.api.update.check(), []),
    download: useCallback(() => window.api.update.download(), []),
    install: useCallback(() => window.api.update.install(), []),
  };
}
