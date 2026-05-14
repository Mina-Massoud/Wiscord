import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

import { connectDb, disconnectDb } from './connect.js';
import { User } from './models/index.js';
import { signSessionToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import {
  runHeadlessNotesClient,
  type HeadlessNotesClientResult,
} from './notes-loadtest/headless-client.js';

/**
 * Notes load runner — spawns N headless Yjs clients that connect to
 * `/sync/notes/:channelId` over Hocuspocus, append ProseMirror-shaped
 * paragraphs to the shared doc, and pulse awareness so the host
 * watching the real TipTap editor sees text + cursor names stream in
 * live.
 *
 *   npm run notes:loadtest                       — default settings
 *   npm run notes:loadtest -- --concurrency=20 --duration=60
 *
 * Flags:
 *   --concurrency=N   number of fake users in flight (default 50, capped
 *                     at the number of seeded participants)
 *   --ramp=N          spread connect times across N seconds (default 10)
 *   --duration=N      how long each client stays typing in seconds (120)
 *   --rate=F          paragraphs appended per second per client (0.5)
 *   --cursor-hz=F     awareness pulses per second (default 4)
 *   --api=URL         backend HTTP base (default http://localhost:3001)
 *   --origin=URL      Origin header to send on WS upgrade — must match
 *                     backend's FRONTEND_ORIGIN (default http://localhost:5173)
 *
 * Prerequisites:
 *   - `npm run dev` (backend on :3001)
 *   - `npm run db:seed:notes-loadtest` (creates .notes-loadtest.json)
 *   - host signed in at the frontend (so the dashboard URL is viewable)
 */

interface NotesSeedSummary {
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
  paragraphsPerSecond: number;
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
    paragraphsPerSecond: Number(get('--rate', '0.5')),
    cursorHz: Number(get('--cursor-hz', '4')),
  };
}

async function readSeedSummary(): Promise<NotesSeedSummary> {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const file = path.join(here, '.notes-loadtest.json');
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(
      `Couldn't find ${file}. Run \`npm run db:seed:notes-loadtest\` first.`,
    );
  }
  return JSON.parse(raw) as NotesSeedSummary;
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
      `Found 0 load-test participants in DB. Run \`npm run db:seed:notes-loadtest\` first.`,
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
  return `${apiUrl.replace(/^http/, 'ws')}/sync/notes/${channelId}`;
}

async function runWithPool(
  participants: Participant[],
  options: RunnerOptions,
  wsUrl: string,
  channelId: string,
): Promise<HeadlessNotesClientResult[]> {
  const queue = participants.map((p, i) => ({ ...p, index: i + 1 }));
  const results: HeadlessNotesClientResult[] = [];
  const rampMsPerStart =
    participants.length > 0 ? (options.rampSeconds * 1000) / participants.length : 0;
  const rampStartAt = Date.now();
  const durationMs = options.durationSeconds * 1000;

  // Each "worker" runs one client to completion; pool size = concurrency.
  // With concurrency==participants.length, every client runs in parallel
  // (the natural shape for a notes demo where everyone types at once).
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      const targetStartAt = rampStartAt + (next.index - 1) * rampMsPerStart;
      const waitFor = targetStartAt - Date.now();
      if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));

      console.warn(`[loadtest] ▶ ${next.email} joining the notes doc`);
      const r = await runHeadlessNotesClient({
        wsUrl,
        origin: options.originUrl,
        sessionCookie: next.cookie,
        channelId,
        userId: next.userId,
        userName: next.displayName,
        rate: options.paragraphsPerSecond,
        cursorHz: options.cursorHz,
        durationMs,
      });
      results.push(r);

      if (r.errorMessage) {
        console.warn(
          `[loadtest] ✗ ${next.email} dropped — ${r.errorMessage} (paragraphs=${r.paragraphsAppended}, awareness=${r.awarenessPulses})`,
        );
      } else {
        console.warn(
          `[loadtest] ✓ ${next.email} left after ${(r.elapsedMs / 1000).toFixed(1)}s — paragraphs=${r.paragraphsAppended}, chars=${r.charsAppended}`,
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
  if (!Number.isFinite(options.paragraphsPerSecond) || options.paragraphsPerSecond <= 0) {
    throw new Error('--rate must be a positive number');
  }

  const summary = await readSeedSummary();

  console.warn('[loadtest] config:', {
    apiUrl: options.apiUrl,
    originUrl: options.originUrl,
    concurrency: options.concurrency,
    rampSeconds: options.rampSeconds,
    durationSeconds: options.durationSeconds,
    paragraphsPerSecond: options.paragraphsPerSecond,
    cursorHz: options.cursorHz,
    channelId: summary.channelId,
  });

  await ensureBackendUp(options.apiUrl);

  await connectDb();
  const participants = await buildParticipants(options.concurrency);
  await disconnectDb();

  const wsUrl = buildWsUrl(options.apiUrl, summary.channelId);

  console.warn(
    `[loadtest] minted ${participants.length} session tokens — connecting to ${wsUrl}`,
  );

  // Ctrl-C: close everything cleanly so the Hocuspocus debounced flush
  // catches the in-flight edits before the run tears down.
  const onSigint = (): void => {
    console.warn('[loadtest] SIGINT — exiting');
    process.exit(0);
  };
  process.on('SIGINT', onSigint);

  const startedAt = Date.now();
  const results = await runWithPool(participants, options, wsUrl, summary.channelId);
  const elapsed = Date.now() - startedAt;

  const connected = results.filter((r) => r.connected);
  const failed = results.filter((r) => !r.connected);
  const totalParagraphs = results.reduce((sum, r) => sum + r.paragraphsAppended, 0);
  const totalChars = results.reduce((sum, r) => sum + r.charsAppended, 0);
  const totalAwareness = results.reduce((sum, r) => sum + r.awarenessPulses, 0);

  console.warn('');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('  Notes load test done.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn(`  Total wall time : ${(elapsed / 1000).toFixed(1)}s`);
  console.warn(`  Connected       : ${connected.length} / ${results.length}`);
  console.warn(`  Failed          : ${failed.length}`);
  console.warn(`  Paragraphs sent : ${totalParagraphs}`);
  console.warn(`  Chars typed     : ${totalChars}`);
  console.warn(`  Awareness pulses: ${totalAwareness}`);
  console.warn(
    `  Dashboard       : http://localhost:5173/app/labs/notes/${summary.channelId}`,
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
