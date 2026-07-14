import { useEffect, useState } from 'react';

/** Backs the custom title-bar controls in WindowControls.tsx (the window is `frame: false` — see main/index.ts). */
export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    void window.api.window.isMaximized().then(setIsMaximized);
    return window.api.window.onMaximizedChange(setIsMaximized);
  }, []);

  return {
    isMaximized,
    minimize: () => void window.api.window.minimize(),
    toggleMaximize: () => void window.api.window.toggleMaximize(),
    close: () => void window.api.window.close(),
  };
}
