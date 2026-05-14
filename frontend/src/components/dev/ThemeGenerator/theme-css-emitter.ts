import { THEME_TOKENS, type ThemeToken } from './theme-tokens';

export type ThemeOverrides = Record<string, string>;

function emitTokenRules(token: ThemeToken, value: string): string {
  const hslVariableTarget = token.targets.find((t) => t.variable !== undefined);

  if (hslVariableTarget !== undefined) {
    return `:root { --${hslVariableTarget.variable}: ${value}; }`;
  }

  return token.targets
    .map((target) => `${target.selector} { ${target.property}: ${value} !important; }`)
    .join('\n');
}

// Build the live override CSS for the current overrides map.
// Tokens with no override are skipped entirely — they keep their static Tailwind values.
export function buildOverrideCss(overrides: ThemeOverrides): string {
  const rules: string[] = [];

  for (const token of THEME_TOKENS) {
    const value = overrides[token.id];
    if (value === undefined || value === '') continue;
    rules.push(`/* ${token.id} */`);
    rules.push(emitTokenRules(token, value));
  }

  if (rules.length === 0) return '';

  return `/* ── Wiscord theme overrides (dev only) ── */\n${rules.join('\n')}\n`;
}
