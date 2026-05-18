import { describe, expect, it } from 'vitest';

import {
  buildPresetCss,
  hexToHslTriplet,
  findPreset,
  THEME_PRESETS,
  type ThemePresetId,
} from './theme-presets';

describe('hexToHslTriplet', () => {
  it('converts pure red to 0° hue', () => {
    expect(hexToHslTriplet('#FF0000')).toBe('0 100% 50%');
  });

  it('returns a safe fallback for malformed input', () => {
    expect(hexToHslTriplet('not-a-hex')).toBe('0 0% 0%');
  });
});

describe('THEME_PRESETS', () => {
  it('exposes exactly 5 presets with stable ids', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['orchid', 'classic', 'bubblegum', 'coral', 'eclipse']);
  });

  it('every preset has five surface tones and a complete radius scale', () => {
    for (const preset of THEME_PRESETS) {
      expect(Object.keys(preset.surfaces).sort()).toEqual([
        'callout',
        'canvas',
        'chrome',
        'surface1',
        'surface2',
      ]);
      expect(preset.radius.sm).toBeGreaterThanOrEqual(0);
      expect(preset.radius.md).toBeGreaterThanOrEqual(preset.radius.sm);
      expect(preset.radius.lg).toBeGreaterThanOrEqual(preset.radius.md);
      expect(preset.radius.xl).toBeGreaterThanOrEqual(preset.radius.lg);
    }
  });
});

describe('findPreset', () => {
  it('returns the matching preset by id', () => {
    expect(findPreset('orchid').name).toBe('Orchid');
  });

  it('falls back to the first preset for unknown ids', () => {
    // Cast through unknown to bypass the TS string-literal union for the
    // negative case — at runtime any id is possible (localStorage drift).
    const unknown = 'mystery' as unknown as ThemePresetId;
    expect(findPreset(unknown)).toBe(THEME_PRESETS[0]);
  });
});

describe('buildPresetCss', () => {
  const bubblegum = findPreset('bubblegum');
  const css = buildPresetCss(bubblegum);

  it('paints the surface tokens with the preset palette', () => {
    expect(css).toContain('.bg-canvas');
    expect(css).toContain(bubblegum.surfaces.canvas);
    expect(css).toContain(bubblegum.surfaces.chrome);
  });

  it('emits accent overrides covering hover and focus-visible variants', () => {
    expect(css).toContain('.bg-blurple');
    expect(css).toContain('.hover\\:bg-blurple:hover');
    expect(css).toContain('.focus-visible\\:bg-blurple:focus-visible');
    expect(css).toContain(bubblegum.accent);
    expect(css).toContain(bubblegum.accentHover);
  });

  it('rewrites the Tailwind radius utility scale', () => {
    expect(css).toContain(`.rounded-sm { border-radius: ${bubblegum.radius.sm}px !important; }`);
    expect(css).toContain(`.rounded-md { border-radius: ${bubblegum.radius.md}px !important; }`);
    expect(css).toContain(`.rounded-lg { border-radius: ${bubblegum.radius.lg}px !important; }`);
    expect(css).toContain(`.rounded-xl { border-radius: ${bubblegum.radius.xl}px !important; }`);
  });

  it('updates the shadcn HSL bridge to the new accent + canvas', () => {
    expect(css).toContain(`--radius: ${bubblegum.radius.root};`);
    expect(css).toContain(`--primary: ${hexToHslTriplet(bubblegum.accent)};`);
    expect(css).toContain(`--background: ${hexToHslTriplet(bubblegum.surfaces.canvas)};`);
  });

  it('repaints the keyboard focus ring to match the accent', () => {
    expect(css).toContain(`:focus-visible { outline-color: ${bubblegum.accent} !important; }`);
  });
});
