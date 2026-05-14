import { THEME_TOKENS, type ThemeToken } from './theme-tokens';
import type { ThemeOverrides } from './theme-css-emitter';

export interface ExportPayload {
  tailwindBlock: string;
  cssVarsBlock: string;
  combinedHandoff: string;
  changedCount: number;
}

function groupSection(label: string, lines: string[]): string {
  if (lines.length === 0) return '';
  return `  // ${label}\n${lines.map((l) => `  ${l}`).join('\n')}`;
}

function tailwindLineFor(token: ThemeToken, value: string): string {
  // Hex tokens emit bare; rgba tokens are wrapped in quotes already (they include parens).
  return `${token.id}: '${value}',`;
}

function cssVarLineFor(token: ThemeToken, value: string): string {
  const variable = token.targets[0]?.variable;
  if (variable === undefined) return '';
  return `  --${variable}: ${value};`;
}

export function formatExport(overrides: ThemeOverrides): ExportPayload {
  const changed = THEME_TOKENS.filter(
    (t) => overrides[t.id] !== undefined && overrides[t.id] !== '',
  );

  const tailwindLines = changed
    .filter((t) => t.group !== 'shadcn')
    .map((t) => tailwindLineFor(t, overrides[t.id]));

  const tailwindBlock =
    tailwindLines.length === 0
      ? '// (no tailwind.config.ts tokens changed)'
      : `// Paste into the matching keys under theme.extend.colors in tailwind.config.ts:\n${groupSection('updated tokens', tailwindLines)}`;

  const cssVarLines = changed
    .filter((t) => t.group === 'shadcn')
    .map((t) => cssVarLineFor(t, overrides[t.id]))
    .filter((l) => l !== '');

  const cssVarsBlock =
    cssVarLines.length === 0
      ? '/* (no shadcn HSL vars changed) */'
      : `/* Paste into :root in src/styles/globals.css: */\n:root {\n${cssVarLines.join('\n')}\n}`;

  const combinedHandoff = [
    '# Wiscord theme draft — apply these values',
    '',
    '## tailwind.config.ts (theme.extend.colors)',
    '```ts',
    tailwindBlock,
    '```',
    '',
    '## globals.css (:root)',
    '```css',
    cssVarsBlock,
    '```',
  ].join('\n');

  return {
    tailwindBlock,
    cssVarsBlock,
    combinedHandoff,
    changedCount: changed.length,
  };
}
