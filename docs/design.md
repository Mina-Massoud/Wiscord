# Wiscord — Visual Design (alpha)

Discord-inspired alpha design system. Dark-native, no light mode in v1. This **supersedes** any earlier "Linear with a heartbeat" direction.

> Wiscord *is* a Discord-style app. Borrowing Discord's surface stack, blurple accent, and chat density gives users instant pattern recognition for "this is where I chat with my study group."

## Color tokens

### Brand & semantic

| Token | Hex | Use |
|---|---|---|
| `primary` | `#5865F2` (blurple) | CTAs, active channel indicator, role colors, brand |
| `on-primary` | `#ffffff` | Text on primary |
| `primary-hover` | `#4752C4` | Primary hover state |
| `secondary` | `#57F287` | Success / join |
| `accent-yellow` | `#FEE75C` | Warning |
| `accent-red` | `#ED4245` | Destructive / error |
| `ink` | `#DBDEE1` | Primary text |
| `ink-muted` | `#949BA4` | Secondary text |

### Four-depth surface stack

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#313338` | Base chat / channel surface |
| `surface-1` | `#2B2D31` | Sidebar, elevated panels |
| `surface-2` | `#1E1F22` | Modals, context menus, overlays |
| `surface-3` | `#111214` | Deepest depth |
| `border` | `#3F4147` | Dividers, card borders |

### Presence (four-way)

| Token | Hex |
|---|---|
| `online` | `#23A55A` |
| `idle` | `#F0B232` |
| `dnd` | `#F23F43` |
| `offline` | `#80848E` |

Map Wiscord's session states onto presence: `Focusing` → online, `On break` → idle, `Idle` → offline.

## Typography

- **Family:** `GGSans, Inter, -apple-system, sans-serif`
- **Display:** 40px / weight 800 / line-height 1.1 / tracking -0.02em
- **Body:** 16px / weight 400 / line-height 1.375 / tracking 0

GGSans is Discord's custom typeface — rounded terminals, high x-height, built for chat density. Inter is the production fallback when GGSans isn't licensable.

## Spacing

Base 8px. Scale: `[4, 8, 12, 16, 24, 32, 48, 64]`.

## Radius

| Token | Value |
|---|---|
| `sm` | 4px |
| `md` | 8px |
| `lg` | 16px |
| `xl` | 24px |
| `pill` | 9999px |

## Shadows

| Token | Value |
|---|---|
| `card` | `0 1px 2px rgba(0,0,0,0.3)` |
| `elevated` | `0 8px 16px rgba(0,0,0,0.24)` |
| `modal` | `0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.5)` |

## Motion

| Token | Value |
|---|---|
| `duration-fast` | 100ms |
| `duration-base` | 200ms |
| `easing` | `cubic-bezier(0.4, 0, 0.2, 1)` |

## Layout

Three-column shell:

- Server list: **72px**
- Channel list: **240px**
- Content: fluid
- Member panel (optional, right): **240px**

Message padding: 16px horizontal, 2px between same-author messages, 16px between different authors. Category headers small-caps. Channel rows prefixed by type icon (text / voice / thread / forum).

## Component patterns

- **Server list** — circular icons, notification badge top-right, left bar as unread indicator
- **Channel list** — in `surface-1`, category headers small-caps, channel type icon prefix
- **Message** — avatar + username + timestamp header, then body, reactions row below
- **Voice channel** — participant tile grid, control bar at bottom
- **Role badges** — pill-shaped, role color background, username inherits role color
- **Slash commands** — autocomplete popup above message input

## Implementation notes (shadcn/ui)

Wire the tokens above into the shadcn/ui CSS-variable surface in `globals.css` so every component picks them up automatically:

```css
:root {
  --background: 220 6% 20%;        /* canvas #313338 */
  --foreground: 220 7% 87%;        /* ink #DBDEE1 */

  --card: 225 7% 18%;              /* surface-1 #2B2D31 */
  --card-foreground: 220 7% 87%;

  --popover: 225 9% 13%;           /* surface-2 #1E1F22 */
  --popover-foreground: 220 7% 87%;

  --primary: 235 86% 65%;          /* #5865F2 */
  --primary-foreground: 0 0% 100%;

  --secondary: 139 81% 64%;        /* #57F287 */
  --secondary-foreground: 225 9% 13%;

  --muted: 225 7% 18%;
  --muted-foreground: 218 9% 62%;  /* ink-muted #949BA4 */

  --destructive: 359 83% 60%;      /* #ED4245 */
  --destructive-foreground: 0 0% 100%;

  --border: 220 5% 27%;            /* #3F4147 */
  --input: 220 5% 27%;
  --ring: 235 86% 65%;             /* primary */

  --radius: 0.5rem;                /* md */
}
```

(HSL values are approximate — verify against the hex when wiring up.)

## Banned

- Glassmorphism
- Neon
- Glow effects

**Exception:** subtle blurple border on the AI input is allowed — it's the one accent flourish.

## How to apply

- Use these exact hex values as the canonical tokens. Theme Tailwind and shadcn/ui through CSS variables so components inherit them.
- Don't reach for the old indigo `#818CF8` — the brand color is blurple `#5865F2`.
- Use surfaces hierarchically: `canvas` for the main pane, `surface-1` for sidebars and cards, `surface-2` for modals and popovers, `surface-3` only for the deepest layer.
- Keep semantic colors (green/yellow/red) consistent with Discord's meaning so they don't compete with presence.
