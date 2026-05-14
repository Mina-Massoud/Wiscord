import { describe, expect, it } from 'vitest';

import { buildOverrideCss } from './theme-css-emitter';

describe('buildOverrideCss', () => {
  it('returns an empty string when no overrides are set', () => {
    expect(buildOverrideCss({})).toBe('');
  });

  it('emits bg/text/border rules for an opaque hex token', () => {
    const css = buildOverrideCss({ canvas: '#ff00ff' });
    expect(css).toContain('.bg-canvas { background-color: #ff00ff !important; }');
    expect(css).toContain('.text-canvas { color: #ff00ff !important; }');
    expect(css).toContain('.border-canvas { border-color: #ff00ff !important; }');
  });

  it('emits a :root CSS variable rule for shadcn HSL tokens', () => {
    const css = buildOverrideCss({ 'shadcn-primary': '120 80% 50%' });
    expect(css).toContain(':root { --primary: 120 80% 50%; }');
    // HSL tokens must not also emit bg/text/border class selectors.
    expect(css).not.toContain('.bg-shadcn-primary');
  });

  it('emits rgba values verbatim for glass tokens', () => {
    const css = buildOverrideCss({ 'glass-shell': 'rgba(20, 20, 25, 0.5)' });
    expect(css).toContain(
      '.bg-glass-shell { background-color: rgba(20, 20, 25, 0.5) !important; }',
    );
  });

  it('skips tokens whose value is empty string', () => {
    expect(buildOverrideCss({ canvas: '' })).toBe('');
  });

  it('groups multiple overrides under a single header', () => {
    const css = buildOverrideCss({ canvas: '#111111', ink: '#eeeeee' });
    expect(css).toContain('/* canvas */');
    expect(css).toContain('/* ink */');
    expect(css).toContain('/* ── Wiscord theme overrides (dev only) ── */');
  });

  it('ignores unknown token ids silently', () => {
    expect(buildOverrideCss({ nonexistent: '#fff' })).toBe('');
  });
});
