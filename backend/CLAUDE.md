# Wiscord — Backend Rules

This is the **backend** folder (Node + Express + TypeScript + Mongoose + MongoDB). Frontend rules live in [`../frontend/CLAUDE.md`](../frontend/CLAUDE.md). Product context lives in [`../docs/`](../docs).

The previous Supabase implementation is archived at [`./.legacy-supabase/`](./.legacy-supabase) for reference until the rest of the surface (channels, messages, realtime, AI, voice, storage) is re-implemented.

---

## Current scope

This backend implements **auth and profile only**. CRUD for servers / channels / messages, realtime, AI streaming, LiveKit, and storage are deliberately not built yet — they'll come back behind their own endpoints when the time comes.

Endpoints currently live:
- `POST /auth/sign-up` — create an account (email + password), set cookie, return profile
- `POST /auth/sign-in` — verify email + password, set cookie, return profile
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
| Auth | Email + password → self-issued JWT in HttpOnly cookie | `jose` for sign/verify; passwords hashed at rest with scrypt (`lib/password.ts`). |
| Validation | Zod | At every system boundary — env, request body, request query. |
| Logging | Pino + pino-http | Pretty in dev; JSON in prod. Request-id correlation header. |
| Errors | `AppError` + Express error middleware | All responses ride a `{ success, data?, error? }` envelope. |

---

## Conventions

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

### Password hashing

- scrypt via `node:crypto` (no native dependency) — see `lib/password.ts`.
- Cost N=2^15 (OWASP floor), 16-byte random salt per password, 64-byte key.
- Stored as a single self-describing column: `scrypt$<N>$<salt>$<hash>`. The cost is baked into each hash, so raising it later only affects new passwords.
- `passwordHash` is `select: false` on the `User` schema — only the sign-in path `.select('+passwordHash')`s it back in, so it can't leak into a profile DTO or a log line.
- Wrong-email and wrong-password sign-ins fail identically (`401 invalid_credentials`), and an unknown email still runs a dummy verify so response timing doesn't reveal which emails are registered.

### No `console.log`

`console.error` / `console.warn` are reserved for genuine error reporting (and the seed script). Everywhere else use `logger.info` / `logger.warn` / `logger.error` from `src/lib/logger.js`. ESLint will fail any `console.log`.

### Tests

Test files live in `tests/`. Use Vitest + Supertest. Every meaningful unit of behavior gets a test:
- Auth: sign-up creates a user + sets the cookie, duplicate email is rejected, sign-in verifies the password, wrong password fails, signout clears cookie. Password hashing has its own unit test (`tests/auth/password.test.ts`).
- Profile: username conflict, validation failures, partial PATCH.
- Health: `/health` returns 200 even when the DB is unreachable (smoke).

### Anti-enumeration

`POST /auth/sign-in` returns the same `401 invalid_credentials` whether the email is unregistered or the password is wrong, and runs a dummy scrypt verify on the unknown-email branch so timing doesn't betray membership. `POST /auth/sign-up` is the one surface that *must* leak existence — it returns `409 email_taken` for a duplicate, because silently swallowing a signup would be worse than confirming the address is in use.

### Commit hygiene

- Conventional commits: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `ci`.
- Branch naming: `feat/<slug>`, `fix/<slug>`, etc.
- No `--no-verify`, ever.
- No secrets in code or `.env.example`. Real values live in `.env` (gitignored) locally and in the deployment platform's secret store (Fly/Railway/Render config, never committed) in production.

---

## Local dev setup

```bash
cd backend
npm install
cp .env.example .env
# generate a real JWT secret:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
# bring up MongoDB:
npm run db:up
# (optional) seed a dev user:
npm run db:seed
# start the API on http://localhost:3001
npm run dev
```

`docker info` must succeed before `db:up`. If you don't want Docker, point `MONGODB_URI` at a MongoDB Atlas free-tier cluster instead.

`npm run db:seed` creates `dev@wiscord.local`, `alice@wiscord.local`, and `bob@wiscord.local`, all with the password `password123` — sign in at `/sign-in` with any of those.

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
