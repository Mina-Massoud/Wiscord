import { setupServer } from 'msw/node';

// Handlers will be added here in later phases as features are implemented.
// Example:
// import { http, HttpResponse } from 'msw';
// const handlers = [
//   http.get('/api/example', () => HttpResponse.json({ ok: true })),
// ];

export const server = setupServer();
