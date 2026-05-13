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

### UI matches `docs/design.md`

- All colors, radii, spacing, motion durations come from Tailwind tokens defined in `tailwind.config.ts`, which mirror the values in `docs/design.md`
- **No hex literals outside `tailwind.config.ts` and `globals.css`** — components use semantic classes (`bg-canvas`, `text-ink-muted`, `border-border`)
- Surfaces follow the four-depth stack: `canvas` for the main pane, `surface-1` for sidebars/cards, `surface-2` for modals/popovers, `surface-3` only for deepest depth
- The accent (`blurple` / `#5865F2`) is reserved for active states, CTAs, the focus timer ring, citation chips, and AI accents — used sparingly

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
6. **Realtime subscriptions feed the query cache** — Supabase Realtime CDC handlers call `queryClient.setQueryData` or `invalidateQueries`, never dispatch into Zustand
7. **Suspense for top-level routes** — paired with `ErrorBoundary` shells
8. **DevTools** enabled in dev only (`import.meta.env.DEV`)
9. **No nested queries inside components** — compose at hook level, render the joined result
10. **Pagination by default** — every list query has a `limit()`. Default page sizes documented per query (messages: 50, channels: 100, members: 100). Infinite-scroll uses `useInfiniteQuery`. No unbounded `select * from <table>`.

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
├── client.ts        # Supabase client + edge-function invoker
├── keys.ts          # Hierarchical query-key factory
├── servers.ts       # useServers, useCreateServer, …
├── channels.ts      # useChannels, useCreateChannel, …
├── messages.ts      # useChannelMessages, useSendMessage, …
├── members.ts       # useServerMembers, useRedeemInvite, …
├── invites.ts
├── profiles.ts
├── focus.ts         # focus sessions + goals
├── notes.ts         # snapshot read/write (Liveblocks is separate)
├── presence.ts      # Supabase Presence
├── typing.ts        # Realtime broadcast
├── ai.ts            # SSE consumer for ai-ask
└── voice.ts         # livekit-token fetch
```

**Hard rules (enforced by ESLint):**

- `@supabase/supabase-js` may be imported **only** in `src/queries/client.ts`
- `fetch()` calls outside `src/queries/` are forbidden (`no-restricted-syntax`)
- No URL strings hardcoded anywhere in components or hooks
- Edge Function calls go through a typed `invokeEdgeFunction(name, body)` helper in `queries/client.ts`

### `useEffect` discipline

Default answer: **don't use `useEffect`**. Question every one you write.

Acceptable reasons to reach for it:

1. Subscribing to an external system (Supabase Realtime channel, LiveKit room, browser event)
2. Syncing with a non-React API (DOM focus, `document.title`, IntersectionObserver)
3. Imperative DOM work that React can't express (scroll-to-bottom on new message)
4. Debounced or throttled commit of derived state (typing indicator emit, autosave)

If none of those fit, you almost certainly want one of:

- **`useMemo`** for derived state
- **TanStack Query** for fetching
- **Event handler** for user actions
- **Render-time computation** for transformations

`react-hooks/exhaustive-deps: error` is enforced — silence it by refactoring, never by adding `// eslint-disable`.

**Subscription cleanup is mandatory.** Every effect that subscribes (Realtime channel, LiveKit room, IntersectionObserver, `addEventListener`, `setInterval`) returns a cleanup function. PR review explicitly checks for this. The pattern is always:

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

### Toasts — `sonner` only

- Single toast library: `sonner` (shadcn's default). No alternatives.
- Patterns:
  - `toast.success("Server created")`
  - `toast.error("Couldn't send message. Try again.")`
  - `toast.loading("Joining channel…")`
  - `toast.promise(promise, { loading, success, error })` for async actions
- Never use `alert()`, `confirm()`, or browser dialogs. Use shadcn `Dialog` / `AlertDialog`

### Dates — `Intl.*` or `lib/date.ts`

- Never `new Date(x).toString()` for user-facing display — it leaks locale and timezone bugs
- Format via `Intl.DateTimeFormat` (absolute) and `Intl.RelativeTimeFormat` (relative)
- Helpers consolidated in `src/lib/date.ts`: `formatMessageTime(d)`, `formatRelative(d)`, `formatDuration(ms)`
- Store and transmit dates as ISO 8601 UTC strings; convert to local only at render time

### Imports & module boundaries

- `components/` may import from `components/`, `hooks/`, `lib/`, `queries/`, and `types/`
- `queries/` may import from `queries/`, `types/`, and `@supabase/supabase-js` (only `queries/client.ts`)
- `lib/` is **pure** — no imports of `@supabase/*`, `react`, or anything I/O
- `hooks/` may import from `queries/`, `lib/`, and `react` — never from `components/`

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
