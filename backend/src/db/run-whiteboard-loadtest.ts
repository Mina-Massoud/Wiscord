import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

import { createTLSchema } from '@tldraw/tlschema';

import { connectDb, disconnectDb } from './connect.js';
import { User } from './models/index.js';
import { signSessionToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import {
  runHeadlessClient,
  type HeadlessClientResult,
} from './whiteboard-loadtest/headless-client.js';

/**
 * Whiteboard load runner — spawns N headless WebSocket clients that
 * connect to `/sync/whiteboard/:channelId` and continuously push valid
 * tldraw shape records + cursor presence. The host (signed in as
 * `minamelad232@gmail.com`) watches the canvas fill up live.
 *
 *   npm run whiteboard:loadtest                       — default settings
 *   npm run whiteboard:loadtest -- --concurrency=20 --duration=60
 *
 * Flags:
 *   --concurrency=N   number of fake users in flight (default 50, capped
 *                     at the number of seeded participants)
 *   --ramp=N          spread connect times across N seconds (default 10)
 *   --duration=N      how long each client stays drawing in seconds (120)
 *   --rate=F          shapes per second per client (default 2)
 *   --cursor-hz=F     cursor presence updates per second (default 8)
 *   --api=URL         backend HTTP base (default http://localhost:3001)
 *   --origin=URL      Origin header to send on WS upgrade — must match
 *                     backend's FRONTEND_ORIGIN (default http://localhost:5173)
 *
 * Prerequisites:
 *   - `npm run dev` (backend on :3001)
 *   - `npm run db:seed:whiteboard-loadtest` (creates .whiteboard-loadtest.json)
 *   - host signed in at the frontend (so the dashboard URL is viewable)
 */

interface WhiteboardSeedSummary {
  hostId: string;
  hostEmail: string;
  participantCount: number;
  channelId: string;
}

interface RunnerOptions {
  apiUrl: string;
  originUrl: string;
  concurrency: number;
  rampSeconds: number;
  durationSeconds: number;
  shapesPerSecond: number;
  cursorHz: number;
}

function parseArgs(): RunnerOptions {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const match = argv.find((a) => a.startsWith(`${flag}=`));
    return match ? match.slice(flag.length + 1) : fallback;
  };
  return {
    apiUrl: get('--api', 'http://localhost:3001').replace(/\/$/, ''),
    originUrl: get('--origin', 'http://localhost:5173').replace(/\/$/, ''),
    concurrency: Number(get('--concurrency', '50')),
    rampSeconds: Number(get('--ramp', '10')),
    durationSeconds: Number(get('--duration', '120')),
    shapesPerSecond: Number(get('--rate', '2')),
    cursorHz: Number(get('--cursor-hz', '8')),
  };
}

async function readSeedSummary(): Promise<WhiteboardSeedSummary> {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const file = path.join(here, '.whiteboard-loadtest.json');
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(
      `Couldn't find ${file}. Run \`npm run db:seed:whiteboard-loadtest\` first.`,
    );
  }
  return JSON.parse(raw) as WhiteboardSeedSummary;
}

async function ensureBackendUp(apiUrl: string): Promise<void> {
  try {
    const res = await fetch(`${apiUrl}/health`, { method: 'GET' });
    if (!res.ok) throw new Error(`/health responded with ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Backend not reachable at ${apiUrl}: ${msg}\nStart it with \`npm run dev\` first.`,
    );
  }
}

interface Participant {
  userId: string;
  email: string;
  displayName: string;
  cookie: string;
}

async function buildParticipants(limit: number): Promise<Participant[]> {
  const users = await User.find({
    email: { $regex: /^load-participant-\d{2}@wiscord\.local$/ },
  }).sort({ email: 1 });

  if (users.length === 0) {
    throw new Error(
      `Found 0 load-test participants in DB. Run \`npm run db:seed:whiteboard-loadtest\` first.`,
    );
  }

  const trimmed = users.slice(0, limit);
  const result: Participant[] = [];
  for (const u of trimmed) {
    const userId = String(u._id);
    const token = await signSessionToken(userId);
    result.push({
      userId,
      email: u.email,
      displayName: u.displayName ?? u.username ?? 'Anonymous',
      cookie: `${SESSION_COOKIE}=${token}`,
    });
  }
  return result;
}

function buildWsUrl(apiUrl: string, channelId: string): string {
  return `${apiUrl.replace(/^http/, 'ws')}/sync/whiteboard/${channelId}`;
}

async function runWithPool(
  participants: Participant[],
  options: RunnerOptions,
  wsUrl: string,
  serializedSchema: unknown,
): Promise<HeadlessClientResult[]> {
  const queue = participants.map((p, i) => ({ ...p, index: i + 1 }));
  const results: HeadlessClientResult[] = [];
  const rampMsPerStart =
    participants.length > 0 ? (options.rampSeconds * 1000) / participants.length : 0;
  const rampStartAt = Date.now();
  const durationMs = options.durationSeconds * 1000;

  // Each "worker" runs one client to completion; pool size = concurrency.
  // With concurrency==participants.length, every client runs in parallel
  // (the natural shape for a whiteboard demo where everyone draws at once).
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      const targetStartAt = rampStartAt + (next.index - 1) * rampMsPerStart;
      const waitFor = targetStartAt - Date.now();
      if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));

      console.warn(
        `[loadtest] ▶ ${next.email} joining the whiteboard`,
      );
      const r = await runHeadlessClient({
        wsUrl,
        origin: options.originUrl,
        sessionCookie: next.cookie,
        userId: next.userId,
        userName: next.displayName,
        shapesPerSecond: options.shapesPerSecond,
        cursorHz: options.cursorHz,
        durationMs,
        serializedSchema,
      });
      results.push(r);

      if (r.errorMessage) {
        console.warn(
          `[loadtest] ✗ ${next.email} dropped — ${r.errorMessage} (shapes=${r.shapesPushed}, cursors=${r.presenceUpdates})`,
        );
      } else {
        console.warn(
          `[loadtest] ✓ ${next.email} left after ${(r.elapsedMs / 1000).toFixed(1)}s — shapes=${r.shapesPushed}, cursors=${r.presenceUpdates}`,
        );
      }
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(options.concurrency, participants.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const options = parseArgs();
  if (!Number.isFinite(options.concurrency) || options.concurrency <= 0) {
    throw new Error('--concurrency must be a positive number');
  }
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new Error('--duration must be a positive number of seconds');
  }
  if (!Number.isFinite(options.shapesPerSecond) || options.shapesPerSecond <= 0) {
    throw new Error('--rate must be a positive number');
  }

  const summary = await readSeedSummary();

  console.warn('[loadtest] config:', {
    apiUrl: options.apiUrl,
    originUrl: options.originUrl,
    concurrency: options.concurrency,
    rampSeconds: options.rampSeconds,
    durationSeconds: options.durationSeconds,
    shapesPerSecond: options.shapesPerSecond,
    cursorHz: options.cursorHz,
    channelId: summary.channelId,
  });

  await ensureBackendUp(options.apiUrl);

  await connectDb();
  const participants = await buildParticipants(options.concurrency);
  await disconnectDb();

  // Serialize the schema once and share across all clients — every fake
  // user advertises the same tldraw schema version to the server so the
  // server applies zero migrations on connect.
  const schema = createTLSchema();
  const serializedSchema = schema.serialize();
  const wsUrl = buildWsUrl(options.apiUrl, summary.channelId);

  console.warn(
    `[loadtest] minted ${participants.length} session tokens — connecting to ${wsUrl}`,
  );

  // Ctrl-C: close everything cleanly so the room's onSessionRemoved
  // fires and the snapshot flush goes through.
  const onSigint = (): void => {
    console.warn('[loadtest] SIGINT — exiting');
    process.exit(0);
  };
  process.on('SIGINT', onSigint);

  const startedAt = Date.now();
  const results = await runWithPool(participants, options, wsUrl, serializedSchema);
  const elapsed = Date.now() - startedAt;

  const connected = results.filter((r) => r.connected);
  const failed = results.filter((r) => !r.connected);
  const totalShapes = results.reduce((sum, r) => sum + r.shapesPushed, 0);
  const totalCursors = results.reduce((sum, r) => sum + r.presenceUpdates, 0);

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Whiteboard load test done.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Total wall time : ${(elapsed / 1000).toFixed(1)}s`);
  console.warn(`  Connected       : ${connected.length} / ${results.length}`);
  console.warn(`  Failed          : ${failed.length}`);
  console.warn(`  Shapes pushed   : ${totalShapes}`);
  console.warn(`  Cursor updates  : ${totalCursors}`);
  console.warn(
    `  Dashboard       : http://localhost:5173/app/labs/whiteboard/${summary.channelId}`,
  );
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((err) => {
    console.error('[loadtest] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
