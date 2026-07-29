import { useEffect, useState } from 'react';
import type { WhatsNewInfo } from '@shared/types';

/** Surfaces once, right after an update brought the app to a new version — see main/autoUpdate.ts. */
export function useWhatsNew() {
  const [info, setInfo] = useState<WhatsNewInfo | null>(null);

  useEffect(() => {
    void window.api.update.getWhatsNew().then(setInfo);
  }, []);

  const dismiss = () => {
    setInfo(null);
    void window.api.update.dismissWhatsNew();
  };

  return { info, dismiss };
}
