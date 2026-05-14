# Wiscord — Backend

Node + Express + TypeScript + Mongoose backend for [Wiscord](../docs/overview.md), a Discord-style collaborative study app.

This folder holds the HTTP API, Mongoose models, auth (magic-link + JWT cookie), and feature modules. The frontend lives in the sibling [`../frontend/`](../frontend) folder.

> The previous Supabase implementation is archived at [`./.legacy-supabase/`](./.legacy-supabase) for reference until the rest of the surface (channels, messages, realtime, AI, voice, storage) is re-implemented here.

## Current scope

**Auth + profile only.** Server / channel / message CRUD, realtime, AI streaming, LiveKit, and storage are deliberately not built yet — they'll come back behind their own modules under `src/modules/`.

Live endpoints:

- `POST /auth/magic-link` — request a sign-in email (always returns `{ sent: true }`, anti-enumeration)
- `GET /auth/callback?token=…` — verify token, set cookie, redirect to frontend
- `POST /auth/signout` — clear cookie
- `GET /auth/me` — current user (auth-gated)
- `PATCH /auth/me` — update username / display name / avatar / `onboarded_at` (auth-gated)
- `GET /auth/check-username?username=…` — availability probe

See [`CLAUDE.md`](./CLAUDE.md) for the rules and conventions.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node ≥20, ESM (`"type": "module"`) |
| HTTP | Express 4 |
| DB | MongoDB 8 via Mongoose 9 |
| Auth | Self-issued JWT (`jose`) in HttpOnly cookie |
| Email | Resend (logs URL in dev when key is unset) |
| Validation | Zod at every boundary |
| Logging | Pino + pino-http |

## Prerequisites

1. **Node.js ≥20**
2. **Docker Desktop** (for local MongoDB) — or a MongoDB Atlas free-tier connection string if you'd rather not run Docker
3. **A Resend account** — optional in dev; required to actually send magic-link emails in prod
4. **An Anthropic API key** — only needed once the AI module is wired back in
5. **A LiveKit Cloud account** — only needed once the voice module is wired back in

## Local setup

```bash
cd backend
npm install
cp .env.example .env
# Generate a real JWT secret (32 bytes minimum):
node -e "require('fs').appendFileSync('.env','JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex') + '\n')"
# Boot MongoDB on :27017
npm run db:up
# (optional) seed a dev user (dev@wiscord.local)
npm run db:seed
# Start the API on http://localhost:3001
npm run dev
```

`docker info` must succeed before `db:up`. If you'd rather use Atlas, point `MONGODB_URI` at the cluster connection string and skip `db:up`.

In dev, leave `RESEND_API_KEY` empty — magic-link URLs print to the server log so you can paste them straight into the browser without sending real email.

## Daily commands

| Command | Description |
|---|---|
| `npm run dev` | Start the API in watch mode (tsx) |
| `npm run build` | Type-check + emit to `dist/` |
| `npm run start` | Run the built server |
| `npm run typecheck` | Type-check only |
| `npm run lint` / `lint:fix` | ESLint (zero warnings allowed) |
| `npm test` / `test:watch` | Vitest |
| `npm run db:up` | Boot MongoDB via `docker compose up -d` |
| `npm run db:down` | Stop the Mongo container |
| `npm run db:logs` | Tail Mongo logs |
| `npm run db:seed` | Run `src/db/seed.ts` |

## Folder layout

```
backend/
├── README.md                # this file
├── CLAUDE.md                # backend rules
├── docker-compose.yml       # wiscord-mongo on :27017
├── package.json
├── tsconfig.json / tsconfig.build.json
├── .env / .env.example
├── src/
│   ├── server.ts            # boots HTTP server, connects Mongo
│   ├── app.ts               # createApp() — middleware + routers
│   ├── db/
│   │   ├── connect.ts       # mongoose.connect()
│   │   ├── seed.ts
│   │   ├── serialize.ts     # applySerialize(): _id → id in JSON output
│   │   └── models/          # one Mongoose model per file
│   ├── lib/                 # env, jwt, cookies, errors, logger
│   ├── middleware/          # requireAuth, errorHandler
│   └── modules/
│       └── auth/
│           ├── routes.ts    # HTTP shape only
│           ├── service.ts   # business logic
│           └── schemas.ts   # Zod schemas
├── tests/
└── .legacy-supabase/        # archived Supabase setup, reference only
```

## Schema overview (current)

| Model | Purpose |
|---|---|
| `User` | Account + profile (email, username, display name, avatar, `onboardedAt`) |
| `MagicLinkToken` | Hashed one-time sign-in tokens with 15-minute TTL and `usedAt` lock |

The legacy Supabase schema (servers, channels, messages, focus sessions, goals, notes, invites) is the porting target for the next slices and lives in [`./.legacy-supabase/migrations/`](./.legacy-supabase/migrations).

## Reset the local database

```bash
# Wipe volume + reseed (fresh start)
npm run db:down
docker volume rm wiscord-mongodata
npm run db:up
npm run db:seed

# Or: drop just the wiscord database, keep the container running
docker exec -it wiscord-mongo mongosh -u wiscord -p wiscord --authenticationDatabase admin \
  --eval 'db.getSiblingDB("wiscord").dropDatabase()'
npm run db:seed
```

## What's coming next

When we re-add the rest of the surface, each gets its own module under `src/modules/`:

- `servers`, `channels`, `messages`, `members`, `invites` — REST CRUD with authz checks (replacing RLS)
- `focus`, `notes` — same shape
- `realtime` — Socket.IO gateway mounted on the same HTTP server
- `ai` — SSE port of the legacy `ai-ask` Edge Function
- `voice` — LiveKit JWT mint (legacy `livekit-token`)
- `storage` — `multer` + local disk in dev, R2 in prod

The archived legacy implementations under `.legacy-supabase/` are the reference for what to port.
