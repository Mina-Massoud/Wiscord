# Voice Presence — How It Works

Realtime "who's in this voice channel" without burning a LiveKit
connection per viewer.

## The problem

A naive Discord-style sidebar wants to show, on every screen, who's
currently in each voice channel. The tempting paths are all wrong:

| Approach | Why it dies |
|---|---|
| Each viewer connects to LiveKit as a "hidden observer" | 100 users × 40 channels = 4,000 LiveKit sessions per server. LiveKit bills per participant-minute. Bankrupting. |
| Poll `/participants` from every client every 2 s | Hammers the backend and still feels laggy. |
| Push state into Zustand from the joining client | The *joining* client is the only one who knows it joined. Everyone else is blind. |

What Discord actually does: **one WebSocket per user**, server pushes
voice-state deltas through it. We do the same thing.

## The architecture

```
   LiveKit room state
        │
        ├── webhooks (push, sub-second)        ──┐
        └── poller listRooms() every 2s (pull) ──┤
                                                 ▼
                              ┌─────────────────────────────┐
                              │  voicePresence (in-memory)  │
                              │  channelId → participants[] │
                              │  emits "state_changed"      │
                              └────────────┬────────────────┘
                                           │
                              ┌────────────▼────────────────┐
                              │  Socket.IO gateway          │
                              │  io.to("authenticated")     │
                              │    .emit("voice:state_…")   │
                              └────────────┬────────────────┘
                                           │ one socket per user
                              ┌────────────▼────────────────┐
                              │  Frontend: useVoiceChannel… │
                              │  setQueryData on event      │
                              │  REST snapshot on (re)load  │
                              └─────────────────────────────┘
```

LiveKit is the **source of truth** (it already tracks who's in each
room). The backend mirrors that into a tiny in-memory map. Socket.IO
fans state out to every signed-in tab.

## Key pieces

**Backend** (`backend/src/modules/`)

- `voice/presence-store.ts` — typed `EventEmitter` holding the
  `channelId → participants[]` map. Single source of truth in-process.
- `voice/livekit-presence-poller.ts` — `setInterval` 2 s, calls
  `RoomServiceClient.listRooms()` + `listParticipants()`, diffs into
  the store. Slow but bulletproof.
- `voice/webhook.ts` + `POST /voice/webhook` — LiveKit pushes
  `participant_joined` / `participant_left` here, signature verified by
  `WebhookReceiver`. Fast path.
- `realtime/gateway.ts` — Socket.IO server. Authenticates the handshake
  using the existing `wiscord_session` cookie. Bridges
  `voicePresence.on('state_changed') → io.emit('voice:state_changed')`.

**Frontend** (`frontend/src/queries/`)

- `client.ts` — `getSocket()` singleton: one
  `io(API_URL, { path: '/realtime', withCredentials: true })` per tab.
- `voice-presence.ts` — `useVoiceChannelParticipants(channelId)`:
  - REST `GET /voice/:id/participants` for the initial snapshot.
  - `useEffect` subscribes to `voice:state_changed` and calls
    `queryClient.setQueryData(...)` — no refetch.
  - On socket `connect`, refetch the snapshot in case we missed deltas
    while offline.
  - `staleTime: Infinity` so React Query doesn't race the socket.

## The flow

**On page load (Alice opens the channel page):**

1. Sidebar mounts → `useVoiceChannelParticipants` fires.
2. REST `GET /voice/:id/participants` → returns current state from the
   in-memory store.
3. Sidebar subscribes to `voice:state_changed` on the shared socket.

**On join (Bob clicks "Join lounge"):**

1. Frontend mints a LiveKit token, `<LiveKitRoom>` connects.
2. LiveKit sends a `participant_joined` webhook to backend
   (or the 2 s poll catches it — whichever wins).
3. Backend updates `voicePresence` → emits `state_changed`.
4. Gateway broadcasts `voice:state_changed` to every authenticated
   socket — including Alice's.
5. Alice's `useEffect` handler writes the new array into the React
   Query cache via `setQueryData`. Sidebar re-renders.

Latency: a few ms via webhook, ≤ 2 s via poller fallback.

## Why this scales

- **LiveKit cost**: one connection per *active call participant*, never
  per viewer. 100 users × 40 channels with only a handful joined = ~5
  LiveKit sessions, not 4,000.
- **Socket cost**: one WebSocket per signed-in tab regardless of how
  many channels exist. Same connection later carries chat, presence,
  typing, focus events.
- **Backend cost**: one `setInterval` per process, plus webhook POSTs.
  The presence store is a couple of nested `Map`s — nothing to tune.

## What we deliberately didn't do (yet)

- **Per-server / per-channel Socket.IO rooms.** Today every authed
  socket gets every event. Fine at 100 users. Switch to
  `server:<id>` rooms when servers ship.
- **Redis adapter.** Single Node process for v1; the in-memory store is
  the whole API. Adding a second process → add `@socket.io/redis-adapter`
  and back the store with Redis pub/sub.
- **Sidebar speaking/mute when not connected.** Speaking and mic state
  come from the LiveKit hooks, which only work inside the active
  `<LiveKitRoom>`. We layer them on rows only when the local user is
  connected; remote rows just show name + avatar. Discord parity.

## Mental model

Treat LiveKit as **media infrastructure**, not state infrastructure.
Anything you'd put in a sidebar — names, counts, status dots — flows
through your own realtime gateway. LiveKit gets called only when audio
needs to move.
