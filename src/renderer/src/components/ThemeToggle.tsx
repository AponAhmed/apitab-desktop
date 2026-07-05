import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { IconButton } from './ui/IconButton';
import type { ThemeMode } from '@/types';

const ORDER: ThemeMode[] = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const Icon = ICONS[theme];

  return (
    <IconButton
      title={`Theme: ${theme} (click to change)`}
      aria-label="Toggle theme"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
    >
      <Icon className="h-4 w-4" />
    </IconButton>
  );
}
