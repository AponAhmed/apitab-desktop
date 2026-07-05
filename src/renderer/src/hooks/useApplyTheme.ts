import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

/** Applies the active theme by toggling `.dark` on the document root. */
export function useApplyTheme(): void {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mql.matches);
      root.classList.toggle('dark', dark);
    };

    apply();
    if (theme === 'system') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [theme]);
}
