import { describe, expect, it } from 'vitest';

import { formatExport } from './theme-export-format';

describe('formatExport', () => {
  it('returns placeholder text when nothing is overridden', () => {
    const out = formatExport({});
    expect(out.changedCount).toBe(0);
    expect(out.tailwindBlock).toContain('no tailwind.config.ts tokens changed');
    expect(out.cssVarsBlock).toContain('no shadcn HSL vars changed');
  });

  it('emits tailwind lines for hex overrides', () => {
    const out = formatExport({ canvas: '#222831', blurple: '#9D6BFF' });
    expect(out.tailwindBlock).toContain("canvas: '#222831',");
    expect(out.tailwindBlock).toContain("blurple: '#9D6BFF',");
    expect(out.changedCount).toBe(2);
  });

  it('emits css var lines for shadcn overrides', () => {
    const out = formatExport({ 'shadcn-primary': '280 80% 60%' });
    expect(out.cssVarsBlock).toContain('--primary: 280 80% 60%;');
    expect(out.tailwindBlock).toContain('no tailwind.config.ts tokens changed');
  });

  it('produces a combined handoff document with both sections', () => {
    const out = formatExport({ canvas: '#111111', 'shadcn-primary': '200 80% 60%' });
    expect(out.combinedHandoff).toContain('## tailwind.config.ts');
    expect(out.combinedHandoff).toContain('## globals.css');
    expect(out.combinedHandoff).toContain("canvas: '#111111',");
    expect(out.combinedHandoff).toContain('--primary: 200 80% 60%;');
  });
});
