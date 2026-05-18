// Five hand-tuned theme presets the user can flip between live from
// Settings → Appearance. Each preset varies the accent color, surface
// stack, and corner-radius scale; the apply hook in `theme-preset-store.ts`
// emits an override <style> tag so the whole UI re-skins instantly.
//
// Presets are grounded in real product references (pulled from Mobbin):
//   Bubblegum → Dialpad's hot-pink-on-graphite identity
//   Orchid    → Mixpanel's violet + YNAB-style soft pillow radius
//   Coral     → MasterClass / Posh editorial coral on near-true black
//   Eclipse   → Suno / Lovable inky black + fuchsia w/ sharp radius
//   Classic   → the existing Discord-style blurple default (safe revert)

export type ThemePresetId = 'classic' | 'bubblegum' | 'orchid' | 'coral' | 'eclipse';

export interface ThemeSurfaces {
  canvas: string;
  chrome: string;
  surface1: string;
  surface2: string;
  callout: string;
}

export interface ThemeRadiusScale {
  // Tailwind utility overrides — `rounded-sm/md/lg/xl`. Values in px.
  sm: number;
  md: number;
  lg: number;
  xl: number;
  // CSS `--radius` for shadcn primitives that read `var(--radius)`. Use a
  // rem string so it inherits font-size scaling like the original token.
  root: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  // Short marketing-style line shown under the swatch in the picker.
  tagline: string;
  accent: string;
  accentHover: string;
  surfaces: ThemeSurfaces;
  radius: ThemeRadiusScale;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'orchid',
    name: 'Orchid',
    tagline: 'Vivid violet on charcoal, pillowy — the default',
    accent: '#7C5CFF',
    accentHover: '#6843E8',
    surfaces: {
      canvas: '#15131C',
      chrome: '#0C0B12',
      surface1: '#1E1B28',
      surface2: '#221E2D',
      callout: '#1D1A27',
    },
    radius: { sm: 10, md: 18, lg: 28, xl: 40, root: '1.125rem' },
  },
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Discord blurple, default rounding',
    accent: '#5865F2',
    accentHover: '#4752C4',
    surfaces: {
      canvas: '#1A1A1E',
      chrome: '#121214',
      surface1: '#232428',
      surface2: '#26262b',
      callout: '#202024',
    },
    radius: { sm: 4, md: 8, lg: 16, xl: 24, root: '0.5rem' },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    tagline: 'Hot pink on warm graphite, soft round',
    accent: '#FF3F8E',
    accentHover: '#DB2777',
    surfaces: {
      canvas: '#1B1B1F',
      chrome: '#131316',
      surface1: '#232328',
      surface2: '#26262c',
      callout: '#22222a',
    },
    radius: { sm: 6, md: 12, lg: 20, xl: 28, root: '0.75rem' },
  },
  {
    id: 'coral',
    name: 'Coral',
    tagline: 'Coral rose on inky black, editorial',
    accent: '#E91E47',
    accentHover: '#C7173A',
    surfaces: {
      canvas: '#0B0B0C',
      chrome: '#050505',
      surface1: '#131315',
      surface2: '#18181A',
      callout: '#141416',
    },
    radius: { sm: 4, md: 10, lg: 16, xl: 22, root: '0.625rem' },
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    tagline: 'Fuchsia on near-black, sharp + minimal',
    accent: '#FF2EC4',
    accentHover: '#D925A6',
    surfaces: {
      canvas: '#0A0A0C',
      chrome: '#050507',
      surface1: '#131316',
      surface2: '#17171A',
      callout: '#131317',
    },
    radius: { sm: 2, md: 4, lg: 8, xl: 12, root: '0.25rem' },
  },
];

export const DEFAULT_PRESET_ID: ThemePresetId = 'orchid';

export function findPreset(id: ThemePresetId): ThemePreset {
  const found = THEME_PRESETS.find((p) => p.id === id);
  return found ?? THEME_PRESETS[0];
}

// ── Hex → HSL triplet ────────────────────────────────────────────────────
// shadcn primitives read CSS vars in the `H S% L%` shape (see globals.css).
// Inlined here so this file stays self-contained (lib/ must not import from
// components/, and this is the only consumer of the conversion).
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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
  return { h: h / 6, s, l };
}

export function hexToHslTriplet(hex: string): string {
  const m = HEX_RE.exec(hex);
  if (m === null) return '0 0% 0%';
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ── CSS emitter ──────────────────────────────────────────────────────────
// Tailwind compiles `bg-canvas`, `bg-surface-1`, etc. as static utility
// classes with the hex baked in. To re-skin at runtime, we re-declare the
// same utility classes with `!important` so they win the cascade. Accent
// tokens also need variant selectors (hover/focus/data-state) because
// `hover:bg-blurple` compiles to `.hover\:bg-blurple:hover`, a different
// selector that our static `.bg-blurple` rule wouldn't reach.

interface PropMap {
  prefix: string;
  property: string;
  pseudo?: string;
}

const COLOR_PROPS: PropMap[] = [
  { prefix: 'bg', property: 'background-color' },
  { prefix: 'text', property: 'color' },
  { prefix: 'border', property: 'border-color' },
  { prefix: 'ring', property: '--tw-ring-color' },
  { prefix: 'fill', property: 'fill' },
  { prefix: 'stroke', property: 'stroke' },
  { prefix: 'from', property: '--tw-gradient-from' },
  { prefix: 'to', property: '--tw-gradient-to' },
  { prefix: 'outline', property: 'outline-color' },
  { prefix: 'accent', property: 'accent-color' },
  { prefix: 'placeholder', property: 'color', pseudo: '::placeholder' },
];

function variantSelectors(name: string, prefix: string, pseudo = ''): string {
  const base = `${prefix}-${name}`;
  return [
    `.${base}${pseudo}`,
    `.hover\\:${base}:hover${pseudo}`,
    `.focus\\:${base}:focus${pseudo}`,
    `.focus-visible\\:${base}:focus-visible${pseudo}`,
    `.active\\:${base}:active${pseudo}`,
    `.group:hover .group-hover\\:${base}${pseudo}`,
    `[data-state="open"].data-\\[state\\=open\\]\\:${base}${pseudo}`,
    `[data-state="active"].data-\\[state\\=active\\]\\:${base}${pseudo}`,
    `[data-state="checked"].data-\\[state\\=checked\\]\\:${base}${pseudo}`,
  ].join(',\n');
}

function tokenRules(name: string, value: string, withVariants: boolean): string {
  return COLOR_PROPS.map(({ prefix, property, pseudo = '' }) => {
    const selectors = withVariants
      ? variantSelectors(name, prefix, pseudo)
      : `.${prefix}-${name}${pseudo}`;
    return `${selectors} { ${property}: ${value} !important; }`;
  }).join('\n');
}

export function buildPresetCss(preset: ThemePreset): string {
  const { accent, accentHover, surfaces, radius } = preset;
  const accentHsl = hexToHslTriplet(accent);
  const canvasHsl = hexToHslTriplet(surfaces.canvas);
  const surface1Hsl = hexToHslTriplet(surfaces.surface1);
  const surface2Hsl = hexToHslTriplet(surfaces.surface2);

  return [
    `/* ── Wiscord theme preset · ${preset.id} ── */`,
    // Surface tokens — static state only (panels/cards aren't hovered).
    tokenRules('canvas', surfaces.canvas, false),
    tokenRules('surface-chrome', surfaces.chrome, false),
    tokenRules('surface-1', surfaces.surface1, false),
    tokenRules('surface-2', surfaces.surface2, false),
    tokenRules('surface-callout', surfaces.callout, false),
    // Accent tokens — variants matter (buttons, focus rings, active rows).
    tokenRules('blurple', accent, true),
    tokenRules('blurple-hover', accentHover, true),
    // shadcn CSS-var bridge.
    `:root {
  --radius: ${radius.root};
  --background: ${canvasHsl};
  --primary: ${accentHsl};
  --accent: ${accentHsl};
  --ring: ${accentHsl};
  --card: ${surface1Hsl};
  --popover: ${surface2Hsl};
  --muted: ${surface1Hsl};
}`,
    // Tailwind radius utility overrides — re-declare with the preset scale.
    `.rounded-sm { border-radius: ${radius.sm}px !important; }`,
    `.rounded-md { border-radius: ${radius.md}px !important; }`,
    `.rounded-lg { border-radius: ${radius.lg}px !important; }`,
    `.rounded-xl { border-radius: ${radius.xl}px !important; }`,
    // Default keyboard focus ring (hardcoded in globals.css).
    `:focus-visible { outline-color: ${accent} !important; }`,
  ].join('\n');
}
