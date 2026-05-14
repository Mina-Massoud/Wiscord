# Wiscord — Frontend Rules

This file is the rules for the **frontend** folder only (Vite + React + TS + Tailwind + shadcn/ui). Backend rules live in [`../backend/CLAUDE.md`](../backend/CLAUDE.md).

Project context lives in [`../docs/`](../docs). Read [`../docs/overview.md`](../docs/overview.md), [`../docs/stack.md`](../docs/stack.md), [`../docs/design.md`](../docs/design.md), and [`../docs/principles.md`](../docs/principles.md) before making changes.

---

## Shared rules (apply in both backend/ and frontend/)

### Tests are required

- Vitest + Testing Library for unit and component tests
- Playwright for end-to-end on critical user flows
- A new feature is not done until it has tests
- Coverage gate: 80% on the **critical path** (auth, chat send/receive, Pomodoro lifecycle, AI ask) — not blanket coverage

### Pre-commit must pass

- Husky + lint-staged: on `git commit` run typecheck, ESLint, and Vitest on changed files only
- On `git push` and CI: full Vitest suite + Playwright E2E
- If a hook fails, fix the issue — never `--no-verify`

### Performance

- Bundle budget: **150 KB gzip initial** (`size-limit`, fail CI if exceeded)
- Route-level code splitting via `React.lazy` for everything that isn't the auth shell
- React DevTools Profiler check before merging anything that touches chat or notes (hot paths)
- Animate only `transform`, `opacity`, `filter` — never width / height / padding / top / left
- **Lazy-load below-the-fold images** with `loading="lazy"`. Above-the-fold uses `loading="eager"` + `fetchpriority="high"`

### Scope discipline

- Honor the v1 boundary in [`../docs/overview.md`](../docs/overview.md) and the single product test in [`../docs/principles.md`](../docs/principles.md)
- Don't ship features from the phase-2 list

### Commit hygiene

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `perf:`, `ci:` — enforced by `commitlint` (Husky)
- **Branch naming**: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>` — lowercase, hyphenated
- **No `--no-verify`, ever.** The gate exists for a reason. If a hook is wrong, fix the hook
- **No `console.log` in committed code.** Use `lib/logger.ts` — `logger.info`, `logger.warn`, `logger.error`. Never `console.log` for debug breadcrumbs

---

## Frontend-specific rules

### Component file size

- **Hard limit: 500 lines per `.tsx` file** (ESLint `max-lines: 500`)
- Exception: `src/components/ui/*` (shadcn drops are upstream-owned)
- When a component crosses the line, split it — into subcomponents, hooks, or `*.parts.tsx` files
- Filename should reflect a single responsibility; banned generic names: `utils.ts`, `helpers.ts`, `common.ts`

### Design first — use the `frontend-design` skill

Before building or restyling any user-facing surface, invoke the **`frontend-design`** skill and let it shape the visual direction. The point is to keep the product looking coherent across screens — same rhythm, same hierarchy, same warmth — instead of drifting one component at a time.

The skill is required for:

- A new page or major surface (sign-in, onboarding, app shell, settings, room view)
- Any visual refresh of an existing surface
- Adding a marketing or empty-state illustration
- Anything that the user describes as "the design feels off"

### Human, not API — UI voice rules

We are building a product for students, not a developer console. Every screen should feel like a person made it for another person.

- **Copy first, fields second.** Lead with a warm question or invitation (`Where will you study?`), not a noun-labeled form (`Workspace setup`). The heading does emotional work; the placeholder does the literal labeling.
- **Drop redundant labels.** If the heading + placeholder already explain the field (`Invite code` heading + `abc-xyz-123` placeholder), do not also stack a `<FormLabel>Invite code</FormLabel>` on top. One signal per field.
- **Errors talk like a friend.** `Couldn't join. Double-check the code?` beats `Invalid invite_code: redemption failed`. Never surface backend error strings raw — translate them in the catch block.
- **Buttons commit to verbs, not nouns.** `Create room` / `Join room` / `Send magic link` — not `Submit`, `OK`, `Continue` (unless `Continue` is genuinely the right CTA).
- **Soften the chrome.** Avoid nested bordered boxes ("card-in-a-card") — they read as JSON. Use whitespace, a single divider, or a softly tinted icon chip to separate regions instead.
- **One accent per surface.** The blurple is the focal CTA. Don't paint every action blurple — a secondary action takes `variant="secondary"` or `variant="ghost"`, so the primary stays primary.
- **Animate transitions, not just states.** When a step adds more controls (e.g. onboarding workspace step), the container should expand smoothly — not snap to a new width. Width / size transitions are an allowed exception to the `transform/opacity/filter` rule on auth and onboarding surfaces (not hot paths).
- **Icons must mean something literal — and the icon belongs to the surface, not the subject matter.** Reserve "magic" icons — `Sparkles`, `Wand`, `Wand2`, `WandSparkles`, `Stars`, `Brain`, `Bot`, `Atom`, anything with motion lines or twinkles — exclusively for surfaces where AI is *the active mechanism*: the `ai-ask` composer where the user types the prompt, the streaming-response area where Claude's tokens appear, the citation chip attached to a specific generated answer. A surface that *talks about* AI is not the AI surface. Announcements, marketing banners, tips, tooltips, feature spotlights, empty-state copy, and onboarding cards that mention or promote an AI feature must pick a literal icon for the **surface itself** — `Megaphone` / `Bell` for an announcement, `Lightbulb` for a tip, `MessageCircleQuestion` for an "ask the room" suggestion — not a sparkle just because the subject matter is AI. The test: if the user is not *currently using* the AI on this exact pixel, no magic icon. Using a magic icon on a promo card about the AI makes the product read like an AI demo instead of a study app. For non-AI actions pick the most literal lucide icon available: `Plus` for create, `Users` for join/people, `Hash` for channels, `Pin` for pin, `Search` for search, `Settings` for settings, `Megaphone` for announcements, `Lightbulb` for tips, `MessageCircleQuestion` for "ask" prompts. If unsure, no icon is better than a misleading one.
- **Only offer "back" when the prior step is actually undoable.** A `ChevronLeft + Back` affordance is only honest when the previous step has *not* yet committed to the backend — i.e. it lives entirely in client state until a final submit. Once a step has written to the backend (created a profile, redeemed an invite, sent an email), going "back" would lie to the user because we can't undo the write. In those cases, omit the back button. Don't paper over irreversible state with reversible-looking UI. Same rule applies to server-creation wizards, settings deep-links, anything multi-step.

### UI matches `docs/design.md`

- All colors, radii, spacing, motion durations come from Tailwind tokens defined in `tailwind.config.ts`, which mirror the values in `docs/design.md`
- **No hex literals outside `tailwind.config.ts` and `globals.css`** — components use semantic classes (`bg-canvas`, `text-ink-muted`, `border-border`)
- **No arbitrary value classes in components.** No `text-[15px]`, `leading-[1.45]`, `bg-[#1f1f23]`, `h-[18px]`, `min-w-[20px]`, `w-[260px]`, etc. If a value is missing from the token set, **add a named token in `tailwind.config.ts` first** (font size, spacing, radius, line height) and then use it. Arbitrary `[…]` Tailwind values in components are a token-system bypass and read as design drift — they are banned outside one-off prototypes
- **Typography uses the named UI scale.** App-shell text comes from the semantic font-size tokens (`text-badge`, `text-caption`, `text-control`, `text-tab`, `text-subhead`, `text-body`, `text-display`), not from Tailwind's built-in `text-xs/sm/base/lg` and not from arbitrary `text-[Npx]`. If the scale is missing a step, extend `fontSize` in the config — do not embed pixel literals in JSX
- Surfaces follow the four-depth stack: `canvas` for the main pane, `surface-1` for sidebars/cards, `surface-2` for modals/popovers, `surface-3` only for deepest depth. `surface-callout` is reserved for raised callout cards sitting directly on `canvas` (right-rail empty states, banner cards)
- The accent (`blurple` / `#5865F2`) is reserved for active states, CTAs, the focus timer ring, citation chips, and AI accents — used sparingly

#### Glassmorphism — the shell sits on a wallpaper, so panels must pass light through

The app shell is a single rounded glass slab floating over a body-level wallpaper (`AppShellLayout` paints `bg-glass-shell` + a single `backdrop-blur-glass`). Every panel, rail, card, and tile *inside* that shell must use the **glass-prefixed** tokens so the wallpaper bleeds through the layered translucency. Reaching for the opaque `surface-*` / `canvas` / `border-border` tokens inside the shell breaks the entire visual system — the offending element reads as a hard rectangle floating on top of the glass instead of part of it.

**Translation table (use the right-hand column inside the shell):**

| Opaque (don't use inside shell) | Glass equivalent (use this) | Where it goes |
|---|---|---|
| `bg-canvas` | *(omit — `AppShellLayout` already paints `bg-glass-canvas` on `main`)* | The main pane's scroll area |
| `bg-surface-chrome` | `bg-glass-chrome` | The chrome rails (sidebar, top bar over main when no titleBar, right rail) |
| `bg-surface-1` | `bg-glass-surface-1` | Cards / panels stacked on the canvas |
| `bg-surface-callout` | `bg-glass-callout` | Raised callouts sitting on the canvas |
| `bg-surface-2` | `bg-glass-surface-2` | Popovers, dropdown content (anywhere the wallpaper should still glow through) |
| `border-border` | `border-glass-border` | Hairline border on a glass surface |
| `border-border-strong` | `border-glass-border-strong` | Stronger glass-edge highlight |

**Stays opaque (intentionally):**

- `bg-surface-composer` — input field background. Inputs need a flat readable plate, not glass.
- `bg-surface-hover` / `bg-surface-active` — interactive row states. These overlay on top of the chrome, so the parent already provides the glass.
- Modal `Dialog` content backing — the `<DialogOverlay>` paints a near-opaque scrim over the wallpaper, so glass behind it has nothing to reveal. `bg-surface-2` is correct for `<DialogContent>`.
- Anything that lives outside the shell (full-screen empty states, the auth scene, the sign-in card's outer page) — those have no glass shell to coordinate with.

**The double-blur trap:** never apply `backdrop-blur-*` to a child of the shell. The shell owns the *only* blur — stacking blurs costs frames and reads as muddy. Inner zones layer translucent fills (`bg-glass-*`) only.

**The single-component test:** if a component looks like a "card" floating on a "page" instead of a "layered translucent zone in a glass slab," it's reaching for opaque tokens. Convert to glass and re-check against an existing screen (voice lab, friends shell) to confirm the rhythm matches.

### shadcn/ui — use primitives as designed

When you need a UI primitive (dropdown, dialog, sheet, switch, select, form field, tooltip, button), **reach for the shadcn/ui component first**. Don't roll a hand-built replacement with raw `<div>` + `<button>` to fix an alignment or styling quirk — use the primitive's built-in props. Rolling custom loses Radix's keyboard handling, focus traps, ARIA roles, RTL support, and the project's consistent animation behavior; re-implementing those is invariably slower and worse than the shadcn original.

- **Mixed-item dropdowns.** When a `<DropdownMenuContent>` contains a `DropdownMenuCheckboxItem` or `DropdownMenuRadioItem`, give every sibling `<DropdownMenuItem>` the `inset` prop. That aligns plain items under the indicator slot the checkbox/radio item reserves. Do not swap the checkbox out for a custom item to "fix alignment".
- **Toggles in dropdowns** → `<DropdownMenuCheckboxItem>`. **Inline toggles in forms or panels** → shadcn `<Switch>`. Don't draw a custom "On / Off" pill.
- **Modals / panels / confirmation prompts** → `<Dialog>`, `<Sheet>`, `<AlertDialog>`. No hand-built backdrop + content combos.
- **Forms** → React Hook Form + Zod via shadcn `<Form>` / `<FormField>` / `<FormItem>` / `<FormControl>` / `<FormMessage>`. Don't render `<label>` + `<input>` + error `<span>` triads manually.
- **Buttons** → shadcn `<Button>` with `variant` (`default | secondary | outline | ghost | destructive | link`) and `size` (`default | sm | lg | icon`). Icon-only buttons use `size="icon"`. Styling a raw `<button>` to look like a button is a code smell — the only exception is bespoke surfaces that look nothing like a button (a participant tile, a channel row), where the click target is the surface itself.
- **Tooltips** → wrap the trigger in `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger></Tooltip>`. Don't fall back to the native `title=""` attribute.
- **Selects** → shadcn `<Select>`. Never raw `<select>`.
- **Toasts** → the project's custom `lib/toast.ts` (see the Toasts rule below). Do not introduce `sonner`, browser `alert()` / `confirm()`, or any other surface.

When customization is genuinely needed: extend the component's `className`, pass `asChild` to control the rendered element, or fork the file under `components/ui/` and edit it there (so the rest of the app picks up the change). The wrong answer is to compose primitives from scratch in feature code.

**When custom is OK.** Feature-specific surfaces that aren't shadcn primitives in the first place — voice participant tiles, the connected-card chrome, channel rows, the focus timer ring. The rule above applies to *primitives* (dropdown, dialog, switch, …), not to every component.

### State management

- **Server state** → TanStack Query
- **Shared client state** → Zustand (one store per concern, never one mega-store)
- **Form state** → React Hook Form
- **URL state** (active server, channel, modal open) → React Router params + search
- **Local-only ephemeral** → `useState`
- **No Redux.** No Context for app state (Context only for genuinely tree-scoped concerns like theme, locale, auth user)

### React Query best practices

1. **Hierarchical query keys** in a single `src/queries/keys.ts` factory:
   ```ts
   export const qk = {
     channels: {
       byServer: (serverId: string) => ['channels', serverId] as const,
     },
     messages: {
       byChannel: (channelId: string) => ['messages', channelId] as const,
     },
     // …
   };
   ```
2. **`staleTime` set per query** based on volatility:
   - Chat messages: `0` (always fresh)
   - Channel/server metadata: `5 * 60 * 1000`
   - Profile: `10 * 60 * 1000`
3. **`enabled` for conditional queries** — never fetch with a falsy id
4. **Optimistic updates** for chat send, message edit, goal check — with rollback in `onError`
5. **Invalidate on mutation `onSettled`** — never call `refetch()` manually
6. **Realtime subscriptions feed the query cache** — Socket.IO event handlers call `queryClient.setQueryData` or `invalidateQueries`, never dispatch into Zustand
7. **Suspense for top-level routes** — paired with `ErrorBoundary` shells
8. **DevTools** enabled in dev only (`import.meta.env.DEV`)
9. **No nested queries inside components** — compose at hook level, render the joined result
10. **Pagination by default** — every list query has a `limit()`. Default page sizes documented per query (messages: 50, channels: 100, members: 100). Infinite-scroll uses `useInfiniteQuery`. No unbounded `select * from <table>`.

### Failure modes — think twice before shipping any async surface

I have a habit of writing the happy path and calling it done. The result is screens that *technically* compile but get stuck spinning, lie about state, or strand the user when something drifts. **Before merging any component that reads or writes data, walk this list out loud and either handle each case or explain in a comment why it's impossible here.**

1. **Stale session cookie / deleted user.** The browser has a `wiscord_session` JWT cookie for a user that no longer exists on the server (DB reset, account deleted). The cookie verifies cryptographically but the user row is gone. Anything past the auth gate must either (a) be wrapped by a boot-time `GET /auth/me` validation that signs the user out on failure, or (b) handle a 401/403 from the first server call by clearing local state and routing to sign-in, not by retrying.
2. **Query settled empty vs. query loading.** `data === undefined` and `data === null` mean different things. A "still loading" branch that only checks `!data` will spin forever the moment the server returns a legitimate empty result. Branch on `isLoading` / `isFetching`, not on truthiness of the data.
3. **Retry exhaustion.** Profile-style queries with `retry: 3` will *eventually* settle. After that, "still no data" is signal, not noise — render an actionable error, not the skeleton again.
4. **Orphaned realtime subscription.** A channel subscribed to a row that was just deleted will silently stop emitting. The component must check on mount that the underlying entity still exists, and unsubscribe cleanly on unmount.
5. **Optimistic update with no rollback.** Every `onMutate` that writes to the cache needs an `onError` that puts the previous value back. The "I clicked send but the message vanished" bug always traces back here.
6. **Partial commit across steps.** Multi-step flows that write to the backend mid-flow (onboarding, server creation) must be re-entrant: if the user reloads after step 1's commit, step 1's UI should detect the existing state and skip itself instead of trying to write again.
7. **Realtime + cache drift.** A Socket.IO event handler that writes to `queryClient` must respect the same key shape as the query — otherwise the UI and the cache disagree silently. Always test by mutating from a second tab.
8. **Network offline / 5xx.** The user toggles airplane mode for two seconds. The mutation throws. Does the UI surface a retry, or just stare at the user? `toast.error` + button-reset is the minimum.
9. **First sign-up state.** The backend's magic-link callback creates the `User` row synchronously before issuing the cookie, so the profile is guaranteed to exist by the time the redirect lands. If a `GET /auth/me` ever 404s after a successful callback, that's a bug — log loudly and bail, don't paper over it with retries.
10. **Time zones and clock skew.** Anything that displays "X minutes ago" or expires after N seconds must source time from the server response (or `Date.now()` synchronously, never a stale prop). The user's laptop clock is a lie.

If you can't tick a case off or rule it out, the surface is not done.

### Three states per async surface

Every component that consumes an async result must render **all three** branches — never branch on `data` alone.

- **Loading** — see the loading rule below. Never a blank screen. Never just the word "Loading…"
- **Error** — message + retry action. Never a silent failure
- **Empty** — designed empty state ("No messages yet. Say hi.") with an affordance to act. Not "No items."

`useQuery` exposes `isLoading`, `error`, and `data` for this exact reason. Branch on all three.

### Loading states — skeletons for layouts, spinners for actions

Two distinct cases, two distinct patterns:

**Page / section loading (initial query, route change, large list fetch):**
- Render a **skeleton** that matches the shape of the real content
- Skeleton blocks have the same dimensions, spacing, and rhythm as the final layout — so the page doesn't shift when content arrives
- Use shadcn `Skeleton` (or thin Tailwind wrappers) — `rounded-md bg-surface-1 animate-pulse`
- One skeleton per content shape (e.g. `<MessageSkeleton />`, `<ChannelRowSkeleton />`) colocated with the component it mirrors
- Show at least one skeleton block per visible content slot (avatar circle, name bar, two text lines)
- Never a generic full-screen spinner for page loads — that's a regression

**Action loading (button click, form submit, mutation, AI ask):**
- Inline **spinner** *inside the triggering element* (button, icon button, send arrow)
- The triggering element is **disabled** while pending — no double submits
- Optimistic UI is preferred when the action has a clear local representation (sending a message, checking a goal); the spinner appears only on retry / failure
- Long-running actions (>1s) may add a `toast.loading()` so the user sees progress even after they move on

Rule of thumb: if the user is *waiting* for something they just asked for, it's an action — spinner on the trigger. If the user is *opening* something they haven't seen yet, it's a page load — skeleton in the layout.

### `queries/` folder — single source of server access

All endpoint access lives in `src/queries/`, one file per feature. Components and hooks consume hooks only.

```
src/queries/
├── client.ts        # Typed API client (fetch wrapper, credentials: 'include') + Socket.IO singleton
├── keys.ts          # Hierarchical query-key factory
├── auth.ts          # useMe, useRequestMagicLink, useSignout, useUpdateProfile
├── servers.ts       # useServers, useCreateServer, …
├── channels.ts      # useChannels, useCreateChannel, …
├── messages.ts      # useChannelMessages, useSendMessage, …
├── members.ts       # useServerMembers, useRedeemInvite, …
├── invites.ts
├── profiles.ts
├── focus.ts         # focus sessions + goals
├── notes.ts         # snapshot read/write
├── presence.ts      # Socket.IO presence
├── typing.ts        # Socket.IO typing broadcast
├── ai.ts            # SSE consumer for POST /ai/ask
└── voice.ts         # POST /voice/token fetch
```

**Hard rules (enforced by ESLint):**

- Raw `fetch()` calls outside `src/queries/` are forbidden (`no-restricted-syntax`) — components and hooks consume the typed query hooks only
- No URL strings hardcoded anywhere in components or hooks — every endpoint lives behind a helper in `queries/`
- Every request from `queries/client.ts` sends `credentials: 'include'` so the `wiscord_session` cookie rides along; never read it from `document.cookie`
- The Socket.IO client is a singleton instantiated in `queries/client.ts` — feature files subscribe via small wrapper hooks, never `io()` directly

### `useEffect` discipline

Default answer: **don't use `useEffect`**. Question every one you write.

Acceptable reasons to reach for it:

1. Subscribing to an external system (Socket.IO event, LiveKit room, browser event)
2. Syncing with a non-React API (DOM focus, `document.title`, IntersectionObserver)
3. Imperative DOM work that React can't express (scroll-to-bottom on new message)
4. Debounced or throttled commit of derived state (typing indicator emit, autosave)

If none of those fit, you almost certainly want one of:

- **`useMemo`** for derived state
- **TanStack Query** for fetching
- **Event handler** for user actions
- **Render-time computation** for transformations

`react-hooks/exhaustive-deps: error` is enforced — silence it by refactoring, never by adding `// eslint-disable`.

**Subscription cleanup is mandatory.** Every effect that subscribes (Socket.IO event, LiveKit room, IntersectionObserver, `addEventListener`, `setInterval`) returns a cleanup function. PR review explicitly checks for this. The pattern is always:

```ts
useEffect(() => {
  const sub = subscribe(...);
  return () => sub.unsubscribe();
}, [/* deps */]);
```

### Animations

- Default: **`@formkit/auto-animate`** — drop `const [parent] = useAutoAnimate()` on any list that should animate on reorder / mount / unmount (channel list, member list, message list, reactions)
- **CSS transitions** for hover, focus, active, and toggle states (most state changes)
- **Framer Motion** only when a sequence needs orchestration — modal open/close, AI message reveal token-by-token, Pomodoro completion celebration. Don't reach for it for hover effects
- Motion durations come from the Tailwind tokens: `duration-fast` (100ms) for micro-interactions, `duration-base` (200ms) for transitions
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind `ease-out` default is acceptable)
- Respect `prefers-reduced-motion` — auto-animate honors it natively; for Framer Motion check `useReducedMotion()` and gate any non-essential animation

### TypeScript discipline

- **`@typescript-eslint/no-explicit-any: error`** — `as any` is banned
- For unknown shapes, use `unknown` and narrow with a type guard or Zod schema
- If a third-party type is wrong, fix it via a `.d.ts` augmentation in `src/types/`, not `as any`
- Prefer `type` for unions/intersections, `interface` for object shapes that might be extended
- Public exports (hooks, utils, components) have explicit parameter and return types; let TS infer locals
- No `React.FC` — type props with a named `interface` and accept `children` explicitly when needed

### Forms — Zod + React Hook Form, no exceptions

- Every form has a Zod schema defining shape and validation
- Wire RHF with `zodResolver(schema)` from `@hookform/resolvers/zod`
- TS type comes from `z.infer<typeof schema>` — never declare a separate type
- Submit button is disabled while `formState.isSubmitting`
- Errors render inline next to the field, never as a global toast for validation
- Submission errors (network, server) **do** surface as toasts (see Toasts rule below)

### Toasts — `lib/toast.ts` (custom)

- Single toast surface: the custom store in `src/lib/toast.ts` rendered by `src/components/ui/toaster.tsx`. Do **not** install or re-introduce `sonner` or any other toast library — the custom implementation is the source of truth so toasts always match `docs/design.md` (surface-2 background, four-depth stack, blurple accent, motion tokens)
- Import the singleton: `import { toast } from '@/lib/toast'`
- Patterns:
  - `toast.success("Server created")`
  - `toast.error("Couldn't send message. Try again.")`
  - `toast.info("Joined #general")`
  - `toast.loading("Joining channel…")` — does not auto-dismiss; capture the returned id and call `toast.dismiss(id)` when the work resolves
- Optional second arg: `{ description?: string; duration?: number }`. Default durations: success/info 4s, error 5s, loading none
- Toast variants render an accent stripe matching semantic color: success → success, error → destructive, info → blurple, loading → ink-muted
- Never use `alert()`, `confirm()`, or browser dialogs. Use shadcn `Dialog` / `AlertDialog`

### Dates — `Intl.*` or `lib/date.ts`

- Never `new Date(x).toString()` for user-facing display — it leaks locale and timezone bugs
- Format via `Intl.DateTimeFormat` (absolute) and `Intl.RelativeTimeFormat` (relative)
- Helpers consolidated in `src/lib/date.ts`: `formatMessageTime(d)`, `formatRelative(d)`, `formatDuration(ms)`
- Store and transmit dates as ISO 8601 UTC strings; convert to local only at render time

### Imports & module boundaries

- `components/` may import from `components/`, `hooks/`, `lib/`, `queries/`, and `types/`
- `queries/` may import from `queries/`, `types/`, and `socket.io-client` (only `queries/client.ts`)
- `lib/` is **pure** — no imports of `socket.io-client`, `react`, `fetch`, or anything I/O
- `hooks/` may import from `queries/`, `lib/`, and `react` — never from `components/`

### Static assets (`public/`)

All static assets live under `frontend/public/` organized by **type subfolder** — never loose at the root.

```
public/
├── background/    # full-bleed wallpapers, scene art
├── logo/          # wordmarks, marks, app icon variants
├── icon/          # decorative icons not part of lucide-react
├── illustration/  # empty-state art, onboarding scenes
└── og/            # social share / OpenGraph cards
```

Rules:

- **Every image asset under `public/` and `src/assets/` must be `.webp`.** No `.png` / `.jpg` / `.jpeg` checked in. WebP averages 30–80% smaller than PNG at equivalent visual quality and is supported everywhere we ship.
- **Convert before committing** with the repo script: `scripts/img-to-webp.sh <path> --replace` (recurses into directories; `--replace` deletes the source after a successful conversion).
- **Reference assets by their subfolder path** from components: `<img src="/logo/logo-text.webp" />`, `<img src="/background/auth-bg.webp" />`. Never hot-link external images for assets we control.
- **Always set explicit `width` / `height`** on `<img>` to prevent CLS — values come from the source dimensions, CSS controls the rendered size.
- **Above-the-fold imagery** uses `loading="eager"` + `fetchpriority="high"` (per the perf rule). Everything else is `loading="lazy"`.
- **SVGs** are fine as-is — they're already vector. Logos and icons that ship as raster go through the webp pipeline.

### Accessibility

- Every interactive element is keyboard-reachable and has a visible focus ring
- ARIA labels on icon-only buttons
- Color is never the only signal (presence status pairs color with a label or shape)
- Test with `axe-core/playwright` on critical pages

---

## Reference

- Product scope: [`../docs/overview.md`](../docs/overview.md)
- Tech stack: [`../docs/stack.md`](../docs/stack.md)
- Design tokens: [`../docs/design.md`](../docs/design.md)
- Guiding principles: [`../docs/principles.md`](../docs/principles.md)
- Backend rules: [`../backend/CLAUDE.md`](../backend/CLAUDE.md)
