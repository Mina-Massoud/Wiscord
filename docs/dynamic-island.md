# Wiscord Dynamic Island

A single persistent pill at the top center of the app shell that morphs between contexts. The home for every async signal — timers, calendar, voice, activity, reminders. No new routes, no separate widgets. One shape that becomes whatever's most relevant right now.

Animation behavior is modeled on [`jhaemin/dynamic-island`](https://github.com/jhaemin/dynamic-island) — same physics, same morph feel, but rendered in **Wiscord glass** instead of Apple's black notch (no camera, no bezel — translucent surface, hairline border, wallpaper shows through).

---

## The core insight

Apple's Dynamic Island works because it's a **priority queue rendered as one shape**. At any moment there's one "primary" state visible — but the system underneath has a stack of competing contexts (music + AirPods + timer + nav). The visual shows the most urgent one; other contexts park on the side as tiny chips.

For Wiscord, the priority stack:

```
1. Live alerts        (incoming call, urgent reminder, "lesson starts NOW")
2. Active timers      (Pomodoro running, focus session, cool-down)
3. Calendar imminent  (event in <15 min)
4. Ambient context    (current channel, current activity)
5. Idle               (user status / channel name)
```

The pill always shows the top of the stack. When multiple contexts are active, the lower one shows as a small chip beside the pill (the **sidecar** — like Apple shows the timer dot next to music).

---

## Visual states

| State | Collapsed shape | Expanded (on click) |
|---|---|---|
| **Idle** | `· Voice · 111111` | — (no expand) |
| **Voice live** | pulsing dot + `Voice · 111111 · 3` | mini participants list |
| **Pomodoro** | 🍅 `22:34` + thin progress ring | controls: pause / +5 / end / mode toggle |
| **Calendar imminent** | 📅 `Calc study · in 5m` | join button + event details + snooze |
| **Activity context** | 🎨 `Whiteboard · Mina is drawing` | tiny activity preview + join button |
| **Reminder** | 🔔 `Stretch break` | dismiss / snooze |
| **Calendar full** (click date) | 📅 `Today · Wed 14` | drops a full week-view sheet down |
| **AI thinking** (future) | ✨ shimmer + `Thinking…` | streaming response inline |

---

## Anatomy

```
                            ┌─────────────────────────────┐
                            │  🍅  22:34  ●●●●●○○○○○      │  ← collapsed (always visible)
                            └─────────────────────────────┘
                                     ↓ click
                            ┌─────────────────────────────┐
                            │  Focus · 22:34              │
                            │  ─────────────────          │  ← expanded sheet
                            │  Round 2 of 4               │
                            │  [Pause] [Skip] [End]       │
                            └─────────────────────────────┘
```

Two layers:

- **Pill** — always rendered, morphs width/content (~100–440px wide). The persistent UI element across every route.
- **Sheet** — drops out of the pill on click, lives until ESC / outside click.

The pill never goes away. The sheet is transient.

---

## Animation budget — learned from jhaemin/dynamic-island

The reference implementation ([jhaemin/dynamic-island](https://github.com/jhaemin/dynamic-island)) tells us exactly how Apple's morph feels real. Three lessons we adopt verbatim:

### 1. `react-spring`, not duration-based transitions

The reference uses **`useSpring`** for every dimension that changes. CSS `transition: width 200ms ease-out` will *not* land the right feel — spring physics has natural overshoot/settle behavior that duration curves can't fake.

Wiscord already permits Framer Motion. Framer's spring API is the equivalent and gets the same result. Either library works; the key is **spring, not duration**.

### 2. Different physics per transition direction

The reference picks a *different* spring config depending on which mode you're going to or coming from:

| Transition shape | tension | mass | Vibe |
|---|---|---|---|
| Flat move (sibling state, same height) | `300` | `0.1` | snappy, gliding |
| → Large (expanding wide & tall) | `250` | `1.5` | deliberate, slightly weighty |
| → Split (expanding into two zones) | `250` | `2.0` | heavy, controlled |

In Framer terms that's roughly:
- Flat: `{ type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }`
- Large: `{ type: 'spring', stiffness: 250, damping: 22, mass: 1.2 }`
- Split: `{ type: 'spring', stiffness: 250, damping: 26, mass: 1.6 }`

We'll keep a small **transition matrix** keyed by `(prevMode, nextMode)` and pick the config when the primary context changes.

### 3. Cascading delays — size finishes before content settles

The reference staggers content fade behind the size morph by **50–200ms** so the pill stops growing *before* the inner content snaps in. Without it, the morph looks "wobbly" — your eye is reading two animations at once.

Practical rule:
- Width / height / radius: animate immediately
- Inner content opacity + blur: `delay: 80ms`
- Inner content position (slide-in): `delay: 120ms`

### 4. Compositor hints

The reference uses `will-change: width, height`. We do the same on the pill wrapper — tells the browser to promote the element to its own compositor layer ahead of the morph.

We're explicitly violating the "animate only transform/opacity/filter" rule from `web/performance.md` for the pill, because:
- The pill is ≤ 440px wide — small repaint surface
- It's not in a hot-path render tree (no list, no scroll context underneath)
- The magic only works with real width animation; `transform: scale` distorts inner text

Mitigation: `will-change` opt-in, `contain: layout style paint` on the pill, no other animations running simultaneously on the same layer.

### 5. The five canonical modes (from the reference, mapped to Wiscord)

The reference exposes five `IslandMode` values. We map them to our use cases:

| Reference mode | Shape | Wiscord uses it for |
|---|---|---|
| **DEFAULT** | tiny pill (~112 × 32) | idle — channel name only |
| **STRETCHED** | wide pill, single row | timer running, calendar in 5m, voice live with name |
| **SPLIT** | two zones, gap between | primary context + sidecar chip (e.g. timer + calendar imminent) |
| **LARGE** | tall pill with multi-row content | expanded sheet on click |
| **SQUARE** | balanced ratio (~120 × 120) | media-rich expand (e.g. activity preview thumbnail) |

Adding new modes later is cheap — they're just new entries in the transition matrix.

### 6. Visual style — Wiscord glass, not Apple black

The user is explicit: **don't copy the black notch look**. We keep the morph behavior but render with Wiscord's existing glass system:

- Pill background: `bg-glass-surface-2` (already used by popovers + dropdowns)
- Border: `border-glass-border` (1px hairline, not the heavy iPhone bezel)
- Backdrop: `backdrop-blur-glass-sm` so the wallpaper shows through
- Shadow: `shadow-glass` for the floating feel
- Border-radius: `rounded-pill` at small widths, `rounded-2xl` when the height grows past ~64px (matches the radius-scales-with-height behavior the reference uses)

The shape morphs identically to Apple's; the *aesthetic* stays Wiscord.

---

## Architecture

Three pieces, in this order:

### 1. `useDynamicIsland` — priority store

A Zustand store with a list of registered contexts. Feature modules push/pop their context; the store sorts by priority and exposes `primary` (highest) + `sidecars` (next 1–2).

```ts
type IslandMode = 'DEFAULT' | 'STRETCHED' | 'LARGE' | 'SPLIT' | 'SQUARE';

interface IslandContext {
  id: string;                 // 'pomodoro' / 'calendar:next' / etc
  priority: 'alert' | 'timer' | 'calendar' | 'ambient' | 'idle';
  mode: IslandMode;           // drives the transition spring config
  collapsed: IslandView;      // what shows on the pill
  expanded?: IslandView;      // what shows on click; mode auto-becomes LARGE
  sidecar?: IslandView;       // mini chip when not primary (SPLIT layout)
}

const { push, pop, contexts, primary } = useDynamicIsland();
```

### 2. `<DynamicIsland />` — the shell

Mounted once in `AppShellLayout`'s top-bar slot, centered. Three internal sub-pieces:

- **`<IslandPill />`** — the morphing shape. One `motion.div` with `layout` and a `springTransition(prevMode, nextMode)` resolver. Reads from `primary.mode` and renders `primary.collapsed`.
- **`<IslandSheet />`** — the LARGE-mode expansion. Conditionally rendered when `isOpen && primary.expanded`. Drops out of the pill with its own spring (heavier).
- **`<IslandSidecar />`** — chip rendered beside the pill when a second context is registered (`contexts[1]`). Click → swap primary.

Transition resolver:

```ts
const TRANSITIONS: Record<`${IslandMode}->${IslandMode}`, SpringConfig> = {
  'DEFAULT->STRETCHED': SPRING.flat,
  'STRETCHED->LARGE':   SPRING.large,
  'LARGE->STRETCHED':   SPRING.large,        // same on return
  'STRETCHED->SPLIT':   SPRING.split,
  // ... fill the matrix; default falls back to SPRING.flat
};
function pickSpring(prev: IslandMode, next: IslandMode): SpringConfig {
  return TRANSITIONS[`${prev}->${next}`] ?? SPRING.flat;
}
```

Mode classification (derived from the context's collapsed view dimensions):

```ts
function classifyMode(width: number, height: number): IslandMode {
  if (width === 112 && height === 32) return 'DEFAULT';
  if (height === 32 && width > 112)   return 'STRETCHED';
  if (height > 32 && height < 100)    return 'LARGE';
  if (width / height > 0.85 && width / height < 1.15) return 'SQUARE';
  if (/* two zones with a gap */)     return 'SPLIT';
  return 'STRETCHED';
}
```

Or simpler: each context declares its own `mode` field and we trust it.

### 3. Context publishers — feature-local hooks

Each feature publishes a context when relevant:

```ts
// inside the pomodoro hook
useEffect(() => {
  if (!isRunning) return;
  return pushIsland({
    id: 'pomodoro',
    priority: 'timer',
    collapsed: <TimerPill remaining={remaining} />,
    expanded: <TimerControls ... />,
  });
}, [isRunning, remaining]);
```

Calendar publishes when the next event is < 15 min away. Voice publishes when connected. Activity publishes when something is happening in the user's current channel.

**No new routes. No new "calendar tab."** The calendar's content surfaces inside the island when relevant, hides when not.

---

## Animation spec (concrete, ready to implement)

```ts
// frontend/src/components/island/spring.ts

import type { Transition } from 'framer-motion';

export const SPRING = {
  // Snappy, gliding — same-height state changes
  flat:  { type: 'spring', stiffness: 380, damping: 22, mass: 0.6 } as const,
  // Deliberate, weighty — growing into LARGE
  large: { type: 'spring', stiffness: 250, damping: 22, mass: 1.2 } as const,
  // Heavy, controlled — splitting into two zones
  split: { type: 'spring', stiffness: 250, damping: 26, mass: 1.6 } as const,
} satisfies Record<string, Transition>;

// Inner-content stagger so size finishes *before* content re-settles.
export const CONTENT_DELAY = {
  opacity:  0.08,   // 80ms
  position: 0.12,   // 120ms
};

// Style hint for the pill wrapper.
export const PILL_LAYER_HINTS = {
  willChange: 'width, height, border-radius',
  contain: 'layout style paint',
} as const;
```

```tsx
// Inside <IslandPill /> — simplified
const prevModeRef = useRef<IslandMode>(primary.mode);
const spring = pickSpring(prevModeRef.current, primary.mode);
useEffect(() => { prevModeRef.current = primary.mode; }, [primary.mode]);

return (
  <motion.div
    layout
    transition={spring}
    style={PILL_LAYER_HINTS}
    className="bg-glass-surface-2 border-glass-border shadow-glass backdrop-blur-glass-sm rounded-pill flex items-center overflow-hidden border"
    onClick={() => setOpen((o) => !o)}
  >
    <motion.div
      key={primary.id}                                          // remount per context
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0, transition: { delay: CONTENT_DELAY.opacity } }}
      exit={{ opacity: 0, y: -4 }}
      transition={SPRING.flat}
    >
      {primary.collapsed}
    </motion.div>
  </motion.div>
);
```

The `layout` prop on `motion.div` is what auto-measures the new size and animates the diff using the chosen spring. The keyed inner `motion.div` is what cascades content fade behind the size morph.

## Phased rollout

### Phase 1 — Island shell + idle state · ~1 day

- `<DynamicIsland />` mounted in `AppShellLayout` top center, replacing the static `AppTitleBar` title text
- Default state shows current channel name + a small dot (existing voice presence)
- Click does nothing yet — get the pill rendering and morphing on width changes
- Pinned to top center across all routes

### Phase 2 — Store + priority queue · ~½ day

- `useDynamicIsland` Zustand store
- `pushIsland(ctx)` / `popIsland(id)` API
- Priority sort + sidecar slot for the next-most-urgent context
- Dev-only test panel that pushes fake contexts to verify morph behavior

### Phase 3 — Calendar context · ~1 day

- New hook `useCalendarIsland(channelId)` watching the existing calendar query
- < 15 min away → publishes a `calendar` priority context
- Pill shows `📅 Calc study · in 12m`
- Click → expanded sheet shows: title, time, **Join now** (drops into the right voice channel), **Remind in 1m** / **Snooze**
- When event time arrives → priority bumps to `alert` and the pill pulses

### Phase 4 — Timer/Pomodoro context · ~1 day

- Pomodoro hook publishes `timer` priority
- Pill shows 🍅 + remaining time + a thin SVG progress ring
- Click → controls: pause, +5, end, switch focus/break
- Timer ends → bumps to `alert`, soft chime, pill shakes once

### Phase 5 — Activity / voice ambient · ~½ day

- In voice + active activity → pill shows activity glyph + verb (reuses the verb table from `ActiveActivitiesOverlay`)
- In voice + no activity → pill shows channel slug + dot
- Click on activity context → mini participants preview + "view activity"

### Phase 6 — Calendar full view · ~1.5 days

- Click the "Today · Wed 14" badge (when no event is imminent) → drops a full week/day view as the expanded sheet
- Click an event → preview + jump-to-channel
- This becomes the **only** way to access the full calendar. The standalone route retires (or redirects to opening the island).

### Phase 7 — Reminders + alerts · ~1 day

- Generic `pushAlert({ icon, text, action })` API
- Alerts override everything for ~6 seconds, then drop to sidecar or dismiss
- Sound opt-in per type
- Snooze inserts a delayed re-push

### Phase 8 — Polish · ~1 day

- Reduced-motion fallback (no morph, simple swap)
- Keyboard nav (ESC closes sheet, Enter triggers primary action)
- Accessibility — `aria-live` for the pill, `aria-expanded` for the sheet
- Mobile responsive — pill shrinks to icon-only under 640px

**Total ~7–8 days for the full system. Phases 1–4 alone (3 days) replace the broken calendar feel and unlock everything else.**

---

## Design decisions to lock before coding

1. **Always-on vs route-conditional?**
   *Lean: always-on.* The island is a persistent product surface like the macOS menu bar. Hides only in full-screen activity modes (whiteboard focus mode).

2. **Hover preview or click-only?**
   Apple does hover preview on Mac, long-press on iPhone. Wiscord is desktop-first.
   *Lean: click-only for v1.* Hover-peek is a later polish.

3. **One sheet at a time or stack?**
   When a timer is running AND a calendar alert fires:
   - **Replace**: alert takes over the pill, the timer becomes a sidecar chip
   - **Stack**: alert appears as a small floating chip below the island

   *Lean: replace + sidecar.* Matches Apple, instinctively right.

4. **Where in the layout?**
   - **Inside the existing titlebar** (replacing title text) — no extra vertical space
   - **Above the titlebar** as its own row — more breathing room

   *Lean: inside the titlebar.*

5. **Width budget**:
   - Minimum ~100px (icon + 2 chars)
   - Maximum ~440px (full collapsed status)
   - Sheet expansion goes to ~520px wide × variable height with a `max-h-[60vh]` scroll cap

6. **Persistence across reloads**:
   Timers + upcoming calendar events come back on refresh because they're already persisted. **No state lives in the island itself** — it's a pure projection of feature state.

7. **Show on standalone lab pages** (`/app/labs/notes/:id`)?
   *Lean: yes.* Same shell, same island, same priorities. Consistency wins.

---

## Risks

- **MEDIUM — Animation jank on the width morph.** The whole reason Apple's island feels magic is the springy size change. If we land it stiff or with content reflow flashes, the vibe dies. Budget time for tuning, not just implementation.
- **MEDIUM — Priority collision UX.** What does it look like when 3 contexts want to be primary at once? Need clear rules and probably a dev-only visualization tool to debug.
- **LOW — Mobile layout.** The pill needs to gracefully shrink on narrow viewports without breaking the titlebar.
- **LOW — Accessibility of the morph.** Screen readers need a stable label even as content changes. `aria-live` on the inner text container, not the wrapper.

---

## Open questions

1. Should the island **replace the `AppTitleBar` entirely** (top row = just island + avatar), or **sit inside it** (title text on the left, island center, controls right)?
2. Do you want the **week-view calendar drop** in Phase 6, or stop at the next-event widget? Week-view is the bigger lift but kills the calendar route entirely.
3. **Sounds**: timer end, alert, calendar 5-min warning — opt-in per event, or default-on with a global mute? *Lean: default-on with one mute toggle.*
4. **Sidecar limit** — show 1 sidecar chip, or up to 2? Two starts to look busy. *Lean: 1.*
5. **Reduced motion** — degrade to instant swap, or a quick crossfade? Crossfade is fine and still readable. *Lean: crossfade.*

---

## What the island kills

Once it ships, the following can disappear or shrink:

- **Calendar standalone route** — surfaces in-place; route redirects to opening the island sheet
- **"Up next" idle card** (proposed in `in-place-features.md`) — superseded; calendar info lives in the island now
- **Activity in-progress overlay** on the voice grid — still useful for *joining*, but the "you have a timer running" awareness now lives in the island
- **Pomodoro mini-widget** wherever it's currently surfaced — collapses into the island
- **Generic notification banners / toasts** for time-based reminders — alerts go through the island; toasts stay for transactional errors

The product gets simpler as the island matures.

---

## One-line framing

> The island is the **one place** in the app where async time-aware UI lives. Everything else is content.

---

## Picking next

When ready, reply with one of:

- **`proceed with all phases`** — ship Phase 1–4 as a cohesive first PR, then 5–8 as a follow-up
- **`proceed but: …`** — answer the open questions, adjust phases
- **`narrow it: just calendar context`** — skip the priority queue, ship a tiny calendar-only island first, learn from it
