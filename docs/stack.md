# Wiscord — Stack

## Frontend

- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui (Radix primitives + Tailwind), themed to the tokens in [design.md](./design.md)
- React Router (routing)
- Zustand (client state)
- TanStack Query (server state, talks to the Express API)

## Backend

- Node ≥20 + Express 4 + TypeScript (ESM)
- Mongoose 9 against MongoDB 8
- Self-issued JWT in an HttpOnly cookie (`jose`) for sessions
- Magic-link sign-in via Resend (logs the URL to stdout in dev so no quota is burned)
- Zod for env + request validation at every boundary
- Pino + pino-http for structured logging
- Single response envelope: `{ success, data?, error? }`

The previous Supabase-based backend (Postgres + RLS + Edge Functions) is archived under [`../backend/.legacy-supabase/`](../backend/.legacy-supabase) and is the reference for porting the rest of the surface (channels, messages, realtime, AI, voice, storage) back into Express + Mongoose.

## Realtime (planned)

- Socket.IO gateway mounted on the same Express HTTP server
- Same JWT cookie authenticates the WS upgrade
- Event-based fan-out replaces Supabase Realtime CDC for chat, presence, typing, focus-session ticks, and notes sync

## Voice

- LiveKit Cloud
- Tokens minted by an Express endpoint, never in the client (`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` stay server-side)

## AI

- Google Gemini API, using a **Gemma 4** open model (`gemma-4-26b-a4b-it` by default) via the official `@google/genai` Node SDK
- Called from an Express endpoint that streams tokens back over SSE; the API key never reaches the browser
- Lean RAG: server-side context builder pulls the caller's notes / calendar / recent activity by id (no embeddings yet)

## Storage (planned)

- `multer` + local disk in dev
- Cloudflare R2 (or equivalent S3) for production uploads

## Hosting

- Frontend: Vercel
- Backend: containerized Node service (Fly / Railway / Render — TBD); MongoDB via Atlas in production

## Hard security rule

**No secrets in the React app.** All `VITE_` env vars are public — assume anything prefixed with `VITE_` is exposed to users. Anything secret (LiveKit token minting, Gemini API calls, Resend keys, the JWT signing secret) lives in the backend `.env` (gitignored) and is only ever touched by the Express server.

## Why

A small, opinionated Express + Mongoose stack gives us full control over the auth, realtime, and AI surfaces without coupling to a single managed platform. MongoDB matches the document-shaped nature of chat / notes / focus sessions without a heavy migration toolchain. LiveKit Cloud removes the need to run a media server. Gemma 4 on the Gemini API has a generous free tier for the MoE 26B-A4B model that fits Wiscord's per-user ask volume during the v1 build, and the Gemini SDK ships a clean async-iterator streaming API. Streaming from a server endpoint is the only way to keep the Google API key off the client while still letting the React app trigger it.

## How to apply

When adding any feature touching secrets (API keys, signing tokens, third-party auth), route it through an Express endpoint — never embed in client code. When picking a frontend library, prefer ones that compose cleanly with TanStack Query + Socket.IO rather than introducing a parallel data layer. For UI, reach for shadcn/ui first — drop the components into the repo and theme them via the CSS variables that map to the tokens in [design.md](./design.md) rather than restyling per-component.
