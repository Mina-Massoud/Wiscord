# Wiscord — Project Context

Reference docs for the Wiscord build. Read these before starting any work in this repo.

- [overview.md](./overview.md) — product concept, target users, v1 scope, explicit out-of-scope list
- [stack.md](./stack.md) — frontend, backend, voice, AI, hosting; secrets-stay-server-side rule
- [design.md](./design.md) — dark mode palette, four-tone layering, indigo accent, banned visual treatments
- [principles.md](./principles.md) — single product test, scope discipline, feel target

## TL;DR

A Discord-style collaborative study app. Topic-specific servers, channels with chat + voice + shared notes, synchronized Pomodoros, and a scoped AI assistant that answers questions from the caller's own data (and, later, the current channel / server / voice room) with citations. Built on React + Vite + Tailwind + shadcn/ui on the frontend and Node + Express + Mongoose (MongoDB) on the backend, with LiveKit Cloud for voice and Gemma 4 on the Gemini API for AI. Frontend deploys to Vercel; backend ships as a containerized Node service. Discord-inspired alpha design system — dark-native, blurple `#5865F2` accent, four-depth surface stack. v1 in roughly one month.
