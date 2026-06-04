# Wiscord — Project Rules

This file contains the unified rules for the **Wiscord** monorepo. It mirrors the content of `backend/CLAUDE.md` and `frontend/CLAUDE.md` so that every AI agent (Claude, Gemini, Antigravity, Windsurf) operates under the same constraints.

Product context lives in [`docs/`](docs). Read [`docs/overview.md`](docs/overview.md), [`docs/stack.md`](docs/stack.md), [`docs/design.md`](docs/design.md), and [`docs/principles.md`](docs/principles.md) before making changes.

The previous Supabase implementation is archived at [`backend/.legacy-supabase/`](backend/.legacy-supabase) for reference until the rest of the surface (channels, messages, realtime, AI, voice, storage) is re-implemented.

---

# Backend Rules (Node + Express + TypeScript + Mongoose + MongoDB)

Detailed backend rules live in [`backend/CLAUDE.md`](backend/CLAUDE.md).

## Current scope

This backend implements **auth and profile only**. CRUD for servers / channels / messages, realtime, AI streaming, LiveKit, and storage are deliberately not built yet — they'll come back behind their own endpoints when the time comes.

Endpoints currently live:
- `POST /auth/magic-link` — request a sign-in email
- `GET /auth/callback?token=…` — verify token, set cookie, redirect to frontend
- `POST /auth/signout` — clear cookie
- `GET /auth/me` — current user (auth-gated)
- `PATCH /auth/me` — update username / display name / avatar / onboarded_at (auth-gated)
- `GET /auth/check-username?username=…` — availability probe

---

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Runtime | Node ≥20, ESM | `"type": "module"`. Imports use `.js` extensions even for `.ts` files. |
| HTTP | Express 4 | Single `createApp()` factory in `src/app.ts`; `server.ts` boots and binds. |
| DB | MongoDB 8 via Mongoose 9 | Local via `docker compose up -d mongo` on port 27017. |
| Auth | Self-issued JWT in HttpOnly cookie | `jose` for sign/verify; magic-link tokens hashed at rest. |
| Email | Resend REST API | Falls back to logging the URL when `RESEND_API_KEY` is unset (so dev sign-ins work without burning quota). |
| Validation | Zod | At every system boundary — env, request body, request query. |
| Logging | Pino + pino-http | Pretty in dev; JSON in prod. Request-id correlation header. |
| Errors | `AppError` + Express error middleware | All responses ride a `{ success, data?, error? }` envelope. |

---

## Backend Conventions

### Imports use `.js`, not `.ts`

ESM + TS in Node requires explicit extensions in the *built* output. `tsx` resolves `.js` → `.ts` in dev; `tsc` emits files with the same names. Source code reads `import { foo } from './bar.js'` even when `bar.ts` is the source.

### One thing per file

- 200 lines is the soft limit, 500 is the hard limit.
- No `utils.ts` / `helpers.ts` / `service.ts` (generic names) — be specific. The auth module's service file is `modules/auth/service.ts` and that's fine because it's scoped to the module.

### Module structure

Every feature module lives under `src/modules/<feature>/` with three files:
```
src/modules/auth/
├── routes.ts     # Express.Router — HTTP shape only, calls service
├── service.ts    # Pure business logic, talks to models
└── schemas.ts    # Zod schemas for inputs/outputs
```
Routers attach in `src/app.ts`. Services never touch `req` / `res`.

### Database access goes through Mongoose models, never raw

- Models live in `src/db/models/<Name>.ts`, one per file.
- Every schema runs `applySerialize(schema)` so `_id` → `id` in JSON output.
- Indexes are declared in the schema, not in shell.
- Each new model is re-exported from `src/db/models/index.ts`.

### Validation at every boundary

- Env: `src/lib/env.ts` — Zod schema, fails fast on bad config.
- Request bodies & query strings: Zod schema in the module's `schemas.ts`, parsed inside the route handler. ZodErrors are caught by `errorHandler` middleware and rendered as `400 invalid_input` with field-level details.
- DB writes: Mongoose schema validators (min/max/length/enum) plus app-level uniqueness checks for friendly error codes.

### Error handling

- Throw an `AppError` from `lib/errors.ts` for any expected failure (`badRequest('username_taken', ...)`, `forbidden()`, `notFound('server')`, etc.). The middleware maps it to the right HTTP status + envelope automatically.
- Never `res.status(500).json(...)` directly. Either throw an `AppError` or let the error bubble — the middleware will render the right shape.
- Never swallow errors. `try { ... } catch { /* ignore */ }` is forbidden. If you genuinely don't care about the error, log it at `warn` and continue.

### Auth-gated routes use `requireAuth`

```ts
authRouter.get('/me', requireAuth, async (req, res, next) => {
  const me = await getCurrentUser(req.userId!);
  res.json(ok(me));
});
```
`req.userId` is non-null inside `requireAuth`-protected handlers. The `!` is acceptable — TS can't follow middleware boundaries.

### Cookies + JWT

- Session JWT signed with HS256; secret from `JWT_SECRET` (32-byte minimum, validated by env loader).
- Cookie name `wiscord_session`. HttpOnly + SameSite=Lax always; Secure in production only.
- Default TTL 30 days, configurable via `SESSION_TTL_SECONDS`.
- Signing/verifying lives in `src/lib/jwt.ts`; cookie helpers in `src/lib/cookies.ts`. Don't reach into `res.cookie` directly from feature code.

### Magic-link tokens

- 32 random bytes, url-safe base64. Raw token goes in the email **only**.
- Stored as SHA-256 hex in `magic_link_tokens.tokenHash`. DB leak ≠ login compromise.
- 15-minute TTL. Single-use — the consume step is an atomic `findOneAndUpdate({ usedAt: null }, { $set: { usedAt: now } })`. Replays fail because `usedAt != null` after the first hit.
- 24-hour TTL index sweeps expired-but-unused rows automatically.

### No `console.log`

`console.error` / `console.warn` are reserved for genuine error reporting (and the seed script). Everywhere else use `logger.info` / `logger.warn` / `logger.error` from `src/lib/logger.js`. ESLint will fail any `console.log`.

### Tests

Test files live in `tests/`. Use Vitest + Supertest. Every meaningful unit of behavior gets a test:
- Auth: full magic-link round-trip, expired token, replay protection, signout clears cookie.
- Profile: username conflict, validation failures, partial PATCH.
- Health: `/health` returns 200 even when the DB is unreachable (smoke).

### Anti-enumeration

`POST /auth/magic-link` always returns `200 { sent: true }`, even when the email isn't registered. The address gets a brand-new user row instead — which is fine because users are essentially defined by their email, and we don't want anonymous probes to confirm membership.

### Commit hygiene

- Conventional commits: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `ci`.
- Branch naming: `feat/<slug>`, `fix/<slug>`, etc.
- No `--no-verify`, ever.
- No secrets in code or `.env.example`. Real values live in `.env` (gitignored) locally and in the deployment platform's secret store (Fly/Railway/Render config, never committed) in production.

---

## What's coming next (not in this scope)

When we re-add the rest of the surface, each gets its own module under `src/modules/`:
- `servers`, `channels`, `messages`, `members`, `invites` — REST CRUD with authz checks replacing RLS.
- `focus`, `notes` — same shape.
- `realtime` — Socket.IO gateway mounted on the same HTTP server.
- `ai` — SSE port of the legacy `ai-ask` Edge Function.
- `voice` — LiveKit JWT mint (legacy `livekit-token`).
- `storage` — `multer` + local disk in dev, R2 later.

The archived legacy implementations under `.legacy-supabase/` are the reference for what to port.

---

# Frontend Rules (Vite + React + TS + Tailwind + shadcn/ui)

Detailed frontend rules live in [`frontend/CLAUDE.md`](frontend/CLAUDE.md).

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

- Honor the v1 boundary in [`docs/overview.md`](docs/overview.md) and the single product test in [`docs/principles.md`](docs/principles.md)
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

### One React component per file

- **Hard rule: one top-level React component per `.tsx` file** (ESLint `react/no-multi-comp` with `ignoreStateless: false`)
- Applies to function components AND arrow components
- The filename must match the component's identifier (PascalCase)

### Design first — use the `frontend-design` skill

Before building or restyling any user-facing surface, invoke the **`frontend-design`** skill and let it shape the visual direction.

### Human, not API — UI voice rules

We are building a product for students, not a developer console. Every screen should feel like a person made it for another person.

- **Copy first, fields second.** Lead with a warm question or invitation, not a noun-labeled form.
- **Drop redundant labels.** If the heading + placeholder already explain the field, do not also stack a `<FormLabel>` on top.
- **Errors talk like a friend.** `Couldn't join. Double-check the code?` beats `Invalid invite_code: redemption failed`.
- **Buttons commit to verbs, not nouns.** `Create room` / `Join room` / `Send magic link` — not `Submit`, `OK`, `Continue`.
- **One accent per surface.** The blurple is the focal CTA. Don't paint every action blurple.
- **Never expose raw IDs to the user.** Use `funnyTitle(seed)` from `@/lib/funny-title` for untitled resources.

### UI matches `docs/design.md`

- All colors, radii, spacing, motion durations come from Tailwind tokens defined in `tailwind.config.ts`
- **No hex literals outside `tailwind.config.ts` and `globals.css`**
- **No arbitrary value classes in components.** No `text-[15px]`, `bg-[#1f1f23]`, etc.
- **Typography uses the named UI scale.** `text-badge`, `text-caption`, `text-control`, `text-tab`, `text-subhead`, `text-body`, `text-display`

#### Glassmorphism — the shell sits on a wallpaper, so panels must pass light through

The app shell is a single rounded glass slab floating over a body-level wallpaper. Every panel, rail, card, and tile *inside* that shell must use the **glass-prefixed** tokens.

| Opaque (don't use inside shell) | Glass equivalent (use this) | Where it goes |
|---|---|---|
| `bg-canvas` | *(omit — already painted)* | The main pane's scroll area |
| `bg-surface-chrome` | `bg-glass-chrome` | Chrome rails (sidebar, top bar, right rail) |
| `bg-surface-1` | `bg-glass-surface-1` | Cards / panels stacked on the canvas |
| `bg-surface-callout` | `bg-glass-callout` | Raised callouts sitting on the canvas |
| `bg-surface-2` | `bg-glass-surface-2` | Popovers, dropdown content |
| `border-border` | `border-glass-border` | Hairline border on a glass surface |
| `border-border-strong` | `border-glass-border-strong` | Stronger glass-edge highlight |

### shadcn/ui — use primitives as designed

When you need a UI primitive, **reach for the shadcn/ui component first**. Don't roll a hand-built replacement.

### State management

- **Server state** → TanStack Query
- **Shared client state** → Zustand (one store per concern, never one mega-store)
- **Form state** → React Hook Form
- **URL state** → React Router params + search
- **Local-only ephemeral** → `useState`
- **No Redux.** No Context for app state

#### Zustand selectors that return new objects must use `useShallow`

### React Query best practices

1. **Hierarchical query keys** in `src/queries/keys.ts`
2. **`staleTime` set per query** based on volatility
3. **`enabled` for conditional queries** — never fetch with a falsy id
4. **Optimistic updates** for chat send, message edit — with rollback in `onError`
5. **Invalidate on mutation `onSettled`** — never call `refetch()` manually
6. **Realtime subscriptions feed the query cache** — Socket.IO event handlers call `queryClient.setQueryData` or `invalidateQueries`, never dispatch into Zustand
7. **Pagination by default** — every list query has a `limit()`. Messages: 50, channels: 100, members: 100.

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
└── ...
```

### `useEffect` discipline

Default answer: **don't use `useEffect`**. Question every one you write.

Acceptable reasons:
1. Subscribing to an external system (Socket.IO event, LiveKit room, browser event)
2. Syncing with a non-React API (DOM focus, `document.title`, IntersectionObserver)
3. Imperative DOM work (scroll-to-bottom on new message)
4. Debounced or throttled commit of derived state (typing indicator emit, autosave)

### Animations

- Default: **`@formkit/auto-animate`** for list animations
- **CSS transitions** for hover, focus, active, and toggle states
- **Framer Motion** only when a sequence needs orchestration
- Respect `prefers-reduced-motion`

### TypeScript discipline

- **`@typescript-eslint/no-explicit-any: error`** — `as any` is banned
- Use `unknown` and narrow with type guards or Zod
- No `React.FC` — type props with a named `interface`

### Forms — Zod + React Hook Form, no exceptions

### Toasts — `lib/toast.ts` (custom)

- Single toast surface: custom store in `src/lib/toast.ts`. Do **not** install `sonner` or any other toast library.

### Dates — `Intl.*` or `lib/date.ts`

- Never `new Date(x).toString()` for user-facing display
- Store and transmit dates as ISO 8601 UTC strings; convert to local only at render time

### Imports & module boundaries

- `components/` may import from `components/`, `hooks/`, `lib/`, `queries/`, and `types/`
- `queries/` may import from `queries/`, `types/`, and `socket.io-client` (only `queries/client.ts`)
- `lib/` is **pure** — no imports of `socket.io-client`, `react`, `fetch`, or anything I/O
- `hooks/` may import from `queries/`, `lib/`, and `react` — never from `components/`

### Three states per async surface

Every component that consumes an async result must render **all three** branches:
- **Loading** — skeleton for layouts, spinner for actions
- **Error** — message + retry action
- **Empty** — designed empty state with an affordance to act

### Accessibility

- Every interactive element is keyboard-reachable and has a visible focus ring
- ARIA labels on icon-only buttons
- Color is never the only signal
- Test with `axe-core/playwright` on critical pages

---

## Reference

- Product scope: [`docs/overview.md`](docs/overview.md)
- Tech stack: [`docs/stack.md`](docs/stack.md)
- Design tokens: [`docs/design.md`](docs/design.md)
- Guiding principles: [`docs/principles.md`](docs/principles.md)
- Backend rules: [`backend/CLAUDE.md`](backend/CLAUDE.md)
- Frontend rules: [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
