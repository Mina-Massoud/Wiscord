# Wiscord — Stack

## Frontend

- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui (Radix primitives + Tailwind), themed to the tokens in [design.md](./design.md)
- React Router (routing)
- Zustand (client state)
- TanStack Query (server state)

## Backend

- Supabase
  - Auth
  - Postgres
  - Row Level Security
  - Realtime subscriptions
  - Storage
  - Edge Functions

## Voice

- LiveKit Cloud
- Tokens minted in a Supabase Edge Function (never in the client)

## AI

- Anthropic API
- Called from an Edge Function (key never exposed to the browser)

## Hosting

- Vercel

## Hard security rule

**No API keys in the React app.** All `VITE_` env vars are public — assume anything prefixed with `VITE_` is exposed to users. Anything secret (LiveKit token minting, Anthropic API calls) must run inside a Supabase Edge Function.

## Why

Supabase covers auth + DB + realtime + serverless in one tightly integrated surface, which keeps the one-month timeline realistic. LiveKit Cloud removes the need to run a media server. Pulling AI into an Edge Function is the only way to keep the Anthropic key server-side while still letting the React client trigger it.

## How to apply

When adding any feature touching secrets (API keys, signing tokens, third-party auth), route it through an Edge Function — never embed in client code. When picking a library, prefer ones that fit Supabase's realtime/RLS model rather than introducing a parallel data layer. For UI, reach for shadcn/ui first — drop the components into the repo and theme them via the CSS variables that map to the tokens in [design.md](./design.md) rather than restyling per-component.
