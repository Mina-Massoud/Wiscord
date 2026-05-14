# Live Notes — Load Test Demo

Walks 50 fake users through a live notes-doc session — each connects
over the real `/sync/notes/:channelId` Hocuspocus WebSocket, appends
TipTap-shaped paragraphs into the shared `Y.Doc`, and pulses awareness
so the host (you) sees text + named cursors stream into the TipTap
editor in real time.

Reuses the same 50 seeded `load-participant-NN` accounts the quiz and
whiteboard demos share — one user-table footprint for every lab.

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
npm run db:seed:notes-loadtest
# add --reset to wipe the persisted Yjs doc before re-running:
# npm run db:seed:notes-loadtest -- --reset
```

The seeder prints the dashboard URL and the channel id. Open the URL
in your browser as `minamelad232@gmail.com`, then back in terminal C:

```bash
npm run notes:loadtest
```

You'll watch the doc wake up: cursors with `Participant 01..50` flags
glide through the editor, paragraphs land one after another, and the
"Last edited by …" pill in the footer flips through the swarm.
Everyone leaves cleanly after the duration window.

## Tunables

```bash
npm run notes:loadtest -- --concurrency=20 --duration=60 --rate=1
```

| Flag            | Default                   | What it does                                                           |
| --------------- | ------------------------- | ---------------------------------------------------------------------- |
| `--concurrency` | `50`                      | Fake users in flight at once. Capped at the number of seeded accounts. |
| `--ramp`        | `10`                      | Spreads connect times across N seconds for a smoother join curve.      |
| `--duration`    | `120`                     | How many seconds each client stays typing before disconnecting.        |
| `--rate`        | `0.5`                     | Paragraphs appended per second per client.                             |
| `--cursor-hz`   | `4`                       | Awareness pulses per second per client.                                |
| `--api`         | `http://localhost:3001`   | Backend base URL — the runner upgrades `http` → `ws` internally.       |
| `--origin`      | `http://localhost:5173`   | `Origin` header sent on WS upgrade. **Must match** `FRONTEND_ORIGIN`.  |

## What gets created in the DB

- The host user: `minamelad232@gmail.com` (upsert — no clobbering).
- Fifty users: `load-participant-01@wiscord.local` …
  `load-participant-50@wiscord.local` (upserts — shared with quiz +
  whiteboard demos).
- The persisted Yjs doc under `ChannelNotes.channelId =
  00000000-0000-4000-8000-000000000043` accumulates paragraphs from each
  run; pass `--reset` to wipe it before re-running.

## How the runner cheats responsibly

It does **not** spin up 50 browser tabs. Each fake user opens a
`@hocuspocus/provider` connection in Node — same wire protocol the
browser uses — backed by a tiny `ws.WebSocket` subclass that pre-bakes
two headers:

- `Cookie: wiscord_session=<jwt minted for the participant>` —
  identical to what the browser sends.
- `Origin: http://localhost:5173` — must match `FRONTEND_ORIGIN` or the
  sync gateway 403s the upgrade.

Once the provider is authenticated, the runner appends
ProseMirror-shaped paragraphs (`Y.XmlElement('paragraph')` containing a
`Y.XmlText`) into the doc's `default` XmlFragment. TipTap on the host's
browser renders them as real paragraphs — the editor doesn't know it's
talking to bots.

## Troubleshooting

- **`Couldn't find .notes-loadtest.json`** — run the seeder first.
- **`Backend not reachable at http://localhost:3001`** — start
  `npm run dev` in the backend.
- **`closed before connect (403)`** — your `--origin` does not match
  `FRONTEND_ORIGIN`. Default is `http://localhost:5173`; if you run
  Vite on a different port, pass `--origin=http://localhost:NNNN`.
- **`closed before connect (401)`** — the session JWT failed to verify.
  Usually means `JWT_SECRET` changed since the runner last minted
  tokens. Just re-run the loadtest — tokens are minted fresh per run.
- **Host sees cursors but no paragraphs** — confirm the host is on
  `/app/labs/notes/<channelId>` (not whiteboard or quiz). The seeder
  prints the exact URL.
- **Host sees nothing at all** — refresh the page; the host's
  `HocuspocusProvider` reconnects and pulls the latest doc state.
