import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { BRAND_SHADES, generateColorScale } from '@/utils/colorScale';

/**
 * Applies the user's chosen accent color by overriding the `--color-brand-*`
 * custom properties (defined in `tailwind.css`) on the document root.
 * Every `brand-*` Tailwind utility (buttons, links, focus rings, badges,
 * active tab underlines, etc.) resolves through these variables, so setting
 * them here re-themes the whole app without touching component code.
 *
 * `accentColor === null` means "use the app's default amber palette" — we
 * simply remove the inline overrides so the stylesheet's own values apply.
 */
export function useApplyAccentColor(): void {
  const accentColor = useSettingsStore((s) => s.accentColor);

  useEffect(() => {
    const root = document.documentElement;

    if (!accentColor) {
      for (const shade of BRAND_SHADES) root.style.removeProperty(`--color-brand-${shade}`);
      return;
    }

    const scale = generateColorScale(accentColor);
    if (!scale) return;

    for (const shade of BRAND_SHADES) {
      root.style.setProperty(`--color-brand-${shade}`, scale[shade]);
    }
  }, [accentColor]);
}
