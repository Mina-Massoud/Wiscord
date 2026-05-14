# Wiscord Frontend

Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui

The app talks to the Node + Express + Mongoose backend in [`../backend/`](../backend). See [`CLAUDE.md`](./CLAUDE.md) for the rules and [`../docs/`](../docs) for product context.

## Required environment variables

Copy `.env.example` to `.env` and fill in your value:

```
VITE_API_URL=http://localhost:3001
```

Boot the backend first (`cd ../backend && npm run db:up && npm run dev`) so the API is live before you start the dev server. Magic-link URLs print to the backend log in dev — paste the link into the browser to complete sign-in without sending real email.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on `localhost:5173` |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Vitest with coverage |
| `npm run e2e` | Playwright E2E tests |
| `npm run e2e:ui` | Playwright UI mode |
| `npm run size` | Check bundle size budget |
