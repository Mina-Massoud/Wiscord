# Live Whiteboard — Load Test Demo

Walks 50 fake users through a live whiteboard session — each connects
over the real `/sync/whiteboard/:channelId` WebSocket, sends valid
tldraw shape records (geo shapes, sticky notes, text), and moves a
cursor around — while the host (you) watches the canvas fill in live.

Same channel id as the quiz loadtest demo, so one bookmark covers
both. Same 50 seeded participant accounts too.

## Prerequisites

- MongoDB running locally (`npm run db:up` from `backend/`).
- Backend dev server running (`npm run dev` from `backend/`).
- Frontend dev server running (`npm run dev` from `frontend/`).
- You've signed in once as `minamelad232@gmail.com` in the frontend so
  the host `User` row exists. The seeder upserts it too, so signing in
  after the seed runs also works — but the host won't see the dashboard
  until they're authed.

## Recipe

```bash
# Terminal A — backend
cd backend
npm run dev

# Terminal B — frontend
cd frontend
npm run dev

# Terminal C — seed once, then run the swarm whenever you want a demo
cd backend
npm run db:seed:whiteboard-loadtest
# add --reset to wipe the persisted snapshot before re-running:
# npm run db:seed:whiteboard-loadtest -- --reset
```

The seeder prints the dashboard URL and the channel id. Open the URL
in your browser as `minamelad232@gmail.com`, then back in terminal C:

```bash
npm run whiteboard:loadtest
```

You'll watch the canvas wake up: cursors with `Participant 01..50`
labels gliding around, geo shapes and sticky notes landing in random
spots, text snippets popping in. The canvas keeps filling for the
duration window then everyone leaves cleanly.

## Tunables

```bash
npm run whiteboard:loadtest -- --concurrency=20 --duration=60 --rate=3
```

| Flag           | Default                   | What it does                                                          |
| -------------- | ------------------------- | --------------------------------------------------------------------- |
| `--concurrency`| `50`                      | Fake users in flight at once. Capped at the number of seeded accounts.|
| `--ramp`       | `10`                      | Spreads connect times across N seconds for a smoother join curve.     |
| `--duration`   | `120`                     | How many seconds each client stays drawing before disconnecting.      |
| `--rate`       | `2`                       | Shapes per second per client.                                         |
| `--cursor-hz`  | `8`                       | Cursor presence updates per second per client.                        |
| `--api`        | `http://localhost:3001`   | Backend base URL — the runner upgrades `http` → `ws` internally.      |
| `--origin`     | `http://localhost:5173`   | `Origin` header sent on WS upgrade. **Must match** `FRONTEND_ORIGIN`. |

## What gets created in the DB

- The host user: `minamelad232@gmail.com` (upsert — no clobbering).
- Fifty users: `load-participant-01@wiscord.local` …
  `load-participant-50@wiscord.local` (upserts — shared with quiz demo).
- The persisted snapshot under `ChannelWhiteboard.channelId =
  00000000-0000-4000-8000-000000000042` accumulates shapes from each
  run; pass `--reset` to wipe it before re-running.

## How the runner cheats responsibly

It does **not** spin up 50 browser tabs. Instead each fake user opens
a Node `ws.WebSocket` directly at the same endpoint the real frontend
uses (`/sync/whiteboard/:channelId`), with two manually-set headers:

- `Cookie: wiscord_session=<jwt minted for the participant>` —
  identical to what the browser sends.
- `Origin: http://localhost:5173` — must match `FRONTEND_ORIGIN` or the
  sync gateway 403s the upgrade.

Once the WS opens, the runner sends a tldraw `connect` request with the
v5 schema serialized from `@tldraw/tlschema`, then on a timer pushes
`push` messages carrying valid `instance_presence` + shape records.
The server's `TLSocketRoom` accepts everything the way it would from
a real client — no special "demo" code path.

## Troubleshooting

- **`Couldn't find .whiteboard-loadtest.json`** — run the seeder first.
- **`Backend not reachable at http://localhost:3001`** — start
  `npm run dev` in the backend.
- **`upgrade rejected: HTTP 403`** — your `--origin` does not match
  `FRONTEND_ORIGIN`. Default is `http://localhost:5173`; if you run
  Vite on a different port, pass `--origin=http://localhost:NNNN`.
- **`upgrade rejected: HTTP 401`** — the session JWT failed to verify.
  Usually means `JWT_SECRET` changed since the runner last minted
  tokens. Just re-run the loadtest — tokens are minted fresh per run.
- **`server rejected schema: clientTooOld`** — the tldraw version
  in the backend got bumped past v5.0.0 since this loader was written.
  Update `@tldraw/tlschema` in `backend/package.json` to match.
- **Host sees no cursors or shapes** — confirm you're signed in as
  `minamelad232@gmail.com` and on the URL printed by the seeder.
  Refresh the page; the host's `useSync` will reconnect and pick up
  everything in the room.
