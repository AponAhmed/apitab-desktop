/**
 * Generates a Tailwind-style 50–950 tonal scale from a single base hex
 * color, so a user can pick "one color" (their favorite) and have it
 * propagate to every `brand-*` utility used across the UI (buttons, links,
 * focus rings, badges, etc.) via the `--color-brand-*` CSS custom
 * properties defined in `tailwind.css`.
 *
 * Rather than trying to preserve the exact lightness the user picked at
 * every stop (which produces washed-out or muddy results for saturated
 * hues), each stop targets a fixed lightness/saturation curve modeled on
 * Tailwind's own palettes — only hue is taken verbatim from the input
 * color, with the input's saturation used as a ceiling.
 */

export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type BrandShade = (typeof BRAND_SHADES)[number];
export type ColorScale = Record<BrandShade, string>;

const LIGHTNESS: Record<BrandShade, number> = {
  50: 0.97,
  100: 0.93,
  200: 0.86,
  300: 0.76,
  400: 0.64,
  500: 0.52,
  600: 0.44,
  700: 0.37,
  800: 0.3,
  900: 0.24,
  950: 0.15,
};

// Relative to the input color's own saturation — light tints are desaturated
// toward white, very dark shades pull back slightly so they don't look muddy.
const SATURATION_MULT: Record<BrandShade, number> = {
  50: 0.3,
  100: 0.4,
  200: 0.55,
  300: 0.75,
  400: 0.9,
  500: 1,
  600: 1,
  700: 0.95,
  800: 0.9,
  900: 0.85,
  950: 0.75,
};

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;

  let raw = match[1];
  if (raw.length === 3) {
    raw = raw
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h /= 6;

  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    const hex = v.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const hueToRgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const r = Math.round(hueToRgb(h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(h) * 255);
  const b = Math.round(hueToRgb(h - 1 / 3) * 255);

  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Normalizes any valid 3- or 6-digit hex string to a canonical lowercase
 * `#rrggbb` form. Native `<input type="color">` elements silently reset to
 * black if fed anything outside that exact shape (3-digit shorthand,
 * uppercase, missing `#`), so every stored/displayed accent color is passed
 * through this before use. Returns `null` for invalid input.
 */
export function normalizeHex(hex: string): string | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;

  let raw = match[1].toLowerCase();
  if (raw.length === 3) {
    raw = raw
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${raw}`;
}

/**
 * Builds the full 50–950 scale from a single base hex color. Returns `null`
 * if the input isn't a valid hex color.
 */
export function generateColorScale(baseHex: string): ColorScale | null {
  const base = hexToHsl(baseHex);
  if (!base) return null;

  const scale = {} as ColorScale;
  for (const shade of BRAND_SHADES) {
    scale[shade] = hslToHex({
      h: base.h,
      s: Math.min(1, base.s * SATURATION_MULT[shade]),
      l: LIGHTNESS[shade],
    });
  }
  return scale;
}
