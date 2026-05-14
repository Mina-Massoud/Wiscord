// Dev-only manifest of editable theme tokens.
// Mirrors the values in `tailwind.config.ts` (hex / rgba) and `globals.css` (HSL triplets).
// Each token lists the CSS selectors whose properties the live override should rewrite.

export type TokenFormat = 'hex' | 'rgba' | 'hsl-triplet';

export type TokenGroupId =
  | 'surfaces'
  | 'ink'
  | 'borders'
  | 'accent'
  | 'glass'
  | 'presence'
  | 'shadcn';

export interface CssTarget {
  selector: string;
  property: string;
  // For hsl-triplet tokens emitted as `--name: H S% L%;` instead of `prop: value`.
  variable?: string;
}

export interface ThemeToken {
  id: string;
  label: string;
  group: TokenGroupId;
  format: TokenFormat;
  defaultValue: string;
  targets: CssTarget[];
  // True for tokens that also need to update an HSL CSS var (shadcn bridge tokens
  // like `--background`) when the user edits the opaque counterpart. v1: tokens
  // declare their own targets explicitly, so this stays implicit.
}

export interface TokenGroup {
  id: TokenGroupId;
  label: string;
  description: string;
}

export const TOKEN_GROUPS: TokenGroup[] = [
  { id: 'surfaces', label: 'Surfaces', description: 'Four-depth canvas stack + chrome' },
  { id: 'ink', label: 'Text', description: 'Foreground ink scale' },
  { id: 'borders', label: 'Borders', description: 'Hairlines and structural dividers' },
  { id: 'accent', label: 'Accent & semantic', description: 'CTAs, success, warning, destructive' },
  { id: 'glass', label: 'Glass', description: 'Translucent surfaces over the wallpaper' },
  { id: 'presence', label: 'Presence', description: 'Online / idle / dnd / offline dots' },
  { id: 'shadcn', label: 'shadcn HSL bridge', description: 'Primitives that read CSS vars' },
];

// Helper to build the common "color: applies to bg, text, border" target list.
function colorTargets(name: string): CssTarget[] {
  return [
    { selector: `.bg-${name}`, property: 'background-color' },
    { selector: `.text-${name}`, property: 'color' },
    { selector: `.border-${name}`, property: 'border-color' },
    { selector: `.fill-${name}`, property: 'fill' },
    { selector: `.stroke-${name}`, property: 'stroke' },
    { selector: `.ring-${name}`, property: '--tw-ring-color' },
    { selector: `.from-${name}`, property: '--tw-gradient-from' },
    { selector: `.to-${name}`, property: '--tw-gradient-to' },
    { selector: `.via-${name}`, property: '--tw-gradient-via' },
    { selector: `.outline-${name}`, property: 'outline-color' },
    { selector: `.divide-${name} > * + *`, property: 'border-color' },
    { selector: `.placeholder-${name}::placeholder`, property: 'color' },
    { selector: `.accent-${name}`, property: 'accent-color' },
    { selector: `.caret-${name}`, property: 'caret-color' },
    { selector: `.shadow-${name}`, property: '--tw-shadow-color' },
  ];
}

function hslVar(varName: string): CssTarget[] {
  return [{ selector: ':root', property: `--${varName}`, variable: varName }];
}

export const THEME_TOKENS: ThemeToken[] = [
  // ── Surfaces ──
  {
    id: 'canvas',
    label: 'canvas',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#1A1A1E',
    targets: colorTargets('canvas'),
  },
  {
    id: 'surface-1',
    label: 'surface-1',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#232428',
    targets: colorTargets('surface-1'),
  },
  {
    id: 'surface-2',
    label: 'surface-2',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#26262b',
    targets: colorTargets('surface-2'),
  },
  {
    id: 'surface-3',
    label: 'surface-3',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#0A0A0C',
    targets: colorTargets('surface-3'),
  },
  {
    id: 'surface-callout',
    label: 'surface-callout',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#202024',
    targets: colorTargets('surface-callout'),
  },
  {
    id: 'surface-chrome',
    label: 'surface-chrome',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#121214',
    targets: colorTargets('surface-chrome'),
  },
  {
    id: 'surface-hover',
    label: 'surface-hover',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#2E2F34',
    targets: colorTargets('surface-hover'),
  },
  {
    id: 'surface-active',
    label: 'surface-active',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#393B41',
    targets: colorTargets('surface-active'),
  },
  {
    id: 'surface-composer',
    label: 'surface-composer',
    group: 'surfaces',
    format: 'hex',
    defaultValue: '#1F1F23',
    targets: colorTargets('surface-composer'),
  },

  // ── Ink ──
  {
    id: 'ink',
    label: 'ink',
    group: 'ink',
    format: 'hex',
    defaultValue: '#DBDEE1',
    targets: colorTargets('ink'),
  },
  {
    id: 'ink-muted',
    label: 'ink-muted',
    group: 'ink',
    format: 'hex',
    defaultValue: '#949BA4',
    targets: colorTargets('ink-muted'),
  },
  {
    id: 'ink-subtle',
    label: 'ink-subtle',
    group: 'ink',
    format: 'hex',
    defaultValue: '#6D6F78',
    targets: colorTargets('ink-subtle'),
  },

  // ── Borders ──
  {
    id: 'border',
    label: 'border',
    group: 'borders',
    format: 'hex',
    defaultValue: '#1F1F23',
    targets: colorTargets('border'),
  },
  {
    id: 'border-strong',
    label: 'border-strong',
    group: 'borders',
    format: 'hex',
    defaultValue: '#17171B',
    targets: colorTargets('border-strong'),
  },

  // ── Accent / semantic ──
  {
    id: 'blurple',
    label: 'blurple',
    group: 'accent',
    format: 'hex',
    defaultValue: '#5865F2',
    targets: colorTargets('blurple'),
  },
  {
    id: 'blurple-hover',
    label: 'blurple-hover',
    group: 'accent',
    format: 'hex',
    defaultValue: '#4752C4',
    targets: colorTargets('blurple-hover'),
  },
  {
    id: 'success',
    label: 'success',
    group: 'accent',
    format: 'hex',
    defaultValue: '#57F287',
    targets: colorTargets('success'),
  },
  {
    id: 'warning',
    label: 'warning',
    group: 'accent',
    format: 'hex',
    defaultValue: '#FEE75C',
    targets: colorTargets('warning'),
  },
  {
    id: 'destructive',
    label: 'destructive',
    group: 'accent',
    format: 'hex',
    defaultValue: '#ED4245',
    targets: colorTargets('destructive'),
  },

  // ── Glass (rgba) ──
  {
    id: 'glass-shell',
    label: 'glass-shell',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(18, 18, 22, 0.62)',
    targets: colorTargets('glass-shell'),
  },
  {
    id: 'glass-canvas',
    label: 'glass-canvas',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(26, 26, 30, 0.55)',
    targets: colorTargets('glass-canvas'),
  },
  {
    id: 'glass-chrome',
    label: 'glass-chrome',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(14, 14, 17, 0.55)',
    targets: colorTargets('glass-chrome'),
  },
  {
    id: 'glass-surface-1',
    label: 'glass-surface-1',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(35, 36, 40, 0.55)',
    targets: colorTargets('glass-surface-1'),
  },
  {
    id: 'glass-surface-2',
    label: 'glass-surface-2',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(19, 19, 22, 0.6)',
    targets: colorTargets('glass-surface-2'),
  },
  {
    id: 'glass-callout',
    label: 'glass-callout',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(32, 32, 36, 0.55)',
    targets: colorTargets('glass-callout'),
  },
  {
    id: 'glass-veil',
    label: 'glass-veil',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(10, 10, 13, 0.45)',
    targets: colorTargets('glass-veil'),
  },
  {
    id: 'glass-border',
    label: 'glass-border',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(255, 255, 255, 0.08)',
    targets: colorTargets('glass-border'),
  },
  {
    id: 'glass-border-strong',
    label: 'glass-border-strong',
    group: 'glass',
    format: 'rgba',
    defaultValue: 'rgba(255, 255, 255, 0.14)',
    targets: colorTargets('glass-border-strong'),
  },

  // ── Presence ──
  {
    id: 'presence-online',
    label: 'presence-online',
    group: 'presence',
    format: 'hex',
    defaultValue: '#23A55A',
    targets: colorTargets('presence-online'),
  },
  {
    id: 'presence-idle',
    label: 'presence-idle',
    group: 'presence',
    format: 'hex',
    defaultValue: '#F0B232',
    targets: colorTargets('presence-idle'),
  },
  {
    id: 'presence-dnd',
    label: 'presence-dnd',
    group: 'presence',
    format: 'hex',
    defaultValue: '#F23F43',
    targets: colorTargets('presence-dnd'),
  },
  {
    id: 'presence-offline',
    label: 'presence-offline',
    group: 'presence',
    format: 'hex',
    defaultValue: '#80848E',
    targets: colorTargets('presence-offline'),
  },

  // ── shadcn HSL bridge ──
  // These rewrite `--name` on `:root` directly. shadcn consumers wrap them in `hsl(var(--name))`.
  {
    id: 'shadcn-background',
    label: '--background',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '220 6% 20%',
    targets: hslVar('background'),
  },
  {
    id: 'shadcn-foreground',
    label: '--foreground',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '220 7% 87%',
    targets: hslVar('foreground'),
  },
  {
    id: 'shadcn-primary',
    label: '--primary',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '235 86% 65%',
    targets: hslVar('primary'),
  },
  {
    id: 'shadcn-destructive',
    label: '--destructive',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '359 83% 60%',
    targets: hslVar('destructive'),
  },
  {
    id: 'shadcn-border',
    label: '--border',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '240 6% 13%',
    targets: hslVar('border'),
  },
  {
    id: 'shadcn-ring',
    label: '--ring',
    group: 'shadcn',
    format: 'hsl-triplet',
    defaultValue: '235 86% 65%',
    targets: hslVar('ring'),
  },
];

export function findToken(id: string): ThemeToken | undefined {
  return THEME_TOKENS.find((t) => t.id === id);
}

export function tokensByGroup(groupId: TokenGroupId): ThemeToken[] {
  return THEME_TOKENS.filter((t) => t.group === groupId);
}
