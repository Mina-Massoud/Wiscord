# Live Quiz Analytics — Load Test Demo

Walks 50 fake users through a 30-question HR interview quiz over real HTTP
while the host (you) watches the analytics dashboard fill in live.

The full pipeline is exercised: REST routes → Mongo writes → in-memory
analytics store → Socket.IO broadcast → React Query cache → dashboard render.

## Prerequisites

- MongoDB running locally (`npm run db:up` from `backend/`).
- Backend dev server running (`npm run dev` from `backend/`).
- Frontend dev server running (`npm run dev` from `frontend/`).
- You've signed in once as `minamelad232@gmail.com` in the frontend so a
  `User` row exists. (The seeder upserts the user too, so signing in after
  the seed runs also works — but you can't see the dashboard until you're
  signed in.)

## Recipe

```bash
# Terminal A — backend
cd backend
npm run dev

# Terminal B — frontend
cd frontend
npm run dev

# Terminal C — seed once, then run the load whenever you want a demo
cd backend
npm run db:seed:loadtest         # creates host, 50 participants, HR quiz
# add --reset to wipe prior attempts before re-running:
# npm run db:seed:loadtest -- --reset
```

The seeder prints the dashboard URL and the quiz id. Open the URL in your
browser as `minamelad232@gmail.com`, then back in terminal C:

```bash
npm run quiz:loadtest
```

You'll watch the dashboard tick: participants joining, answers landing,
per-question distribution bars filling, the leaderboard reshuffling in real
time.

## Tunables

```bash
npm run quiz:loadtest -- --concurrency=10 --ramp=5 --bias=0.7
```

| Flag             | Default | What it does                                                            |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| `--concurrency`  | `10`    | How many participants are in flight at once.                            |
| `--ramp`         | `5`     | Spreads participant start times across N seconds for a smoother curve.  |
| `--bias`         | `0.7`   | Probability each answer is correct (gives the leaderboard real spread). |
| `--api`          | `http://localhost:3001` | Backend base URL.                                       |

## What gets created in the DB

- One user: `minamelad232@gmail.com` (host).
- Fifty users: `load-participant-01@wiscord.local` … `load-participant-50@wiscord.local`.
- One quiz: `HR Interview Screen — Core Professional Skills`, status `open`, mode `async`.
- Fifty `QuizAttempt` documents after the load runner finishes.

Re-running with `--reset` clears the attempts so the dashboard starts at
zero again; the host, participants, and quiz are upserts and stay put.

## Troubleshooting

- **`Couldn't find .loadtest.json`** — run the seeder first.
- **`Backend not reachable at http://localhost:3001`** — start `npm run dev`
  in the backend.
- **`quiz_unavailable` on every attempt** — the quiz is in draft; re-run the
  seeder with `--reset` to relaunch it.
- **Dashboard stays empty** — confirm you're signed in as
  `minamelad232@gmail.com`; only the host has access to the analytics socket
  room.
