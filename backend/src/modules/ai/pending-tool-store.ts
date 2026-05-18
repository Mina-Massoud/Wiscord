import { randomUUID } from 'node:crypto';

import type { ToolName } from './tool-runner.js';

/**
 * In-memory store for tool calls awaiting user confirmation.
 *
 * Single-process for now (same constraint as other v1 stores).
 * When we shard the backend, swap this for Redis with the same
 * shape — keys are opaque uuids, values are short-lived.
 *
 * Entries expire after 5 minutes so a user who walked away from a
 * confirm prompt can't have an AI-proposed delete fire on them
 * three hours later. A background sweeper runs every 60s so leaked
 * entries are reclaimed even if no `registerPendingCall` traffic
 * arrives to trigger the inline prune.
 *
 * Per-user cap (`MAX_PENDING_PER_USER`) prevents a runaway model or
 * abusive caller from flooding the map — the oldest entry for that
 * user is evicted when the cap is hit.
 */

interface PendingCall {
  userId: string;
  name: ToolName;
  args: unknown;
  /** IANA timezone captured at proposal time. Used by the confirm
   *  path so naive ISO datetimes the model emitted are normalized
   *  against the same zone the user was in when they were
   *  proposed — even if they swap timezones mid-confirmation. */
  timezone?: string;
  /** The model's own `functionCall.id` captured at proposal time.
   *  When the user confirms (or declines) hours later, this is what
   *  we echo back as the `id` on the `functionResponse` part so
   *  Gemini 2.5+ can map the response to the original call. See the
   *  `modelCallId` field comment in `AiConversation.ts` for the
   *  protocol detail. */
  modelCallId?: string;
  createdAt: number;
}

const PENDING = new Map<string, PendingCall>();
const TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_PENDING_PER_USER = 20;

export function registerPendingCall(args: {
  userId: string;
  name: ToolName;
  args: unknown;
  timezone?: string;
  modelCallId?: string;
}): string {
  pruneExpired();
  enforcePerUserCap(args.userId);
  const callId = randomUUID();
  PENDING.set(callId, { ...args, createdAt: Date.now() });
  return callId;
}

export function consumePendingCall(
  callId: string,
  userId: string,
): {
  name: ToolName;
  args: unknown;
  timezone?: string;
  modelCallId?: string;
} | null {
  const entry = PENDING.get(callId);
  if (!entry) return null;
  if (entry.userId !== userId) return null; // can't confirm someone else's call
  if (Date.now() - entry.createdAt > TTL_MS) {
    PENDING.delete(callId);
    return null;
  }
  PENDING.delete(callId);
  return {
    name: entry.name,
    args: entry.args,
    timezone: entry.timezone,
    modelCallId: entry.modelCallId,
  };
}

function pruneExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of PENDING) {
    if (entry.createdAt < cutoff) PENDING.delete(id);
  }
}

/**
 * Cap pending entries per user. Evicts the oldest entries for that
 * user until they're under the cap. Cheap because the map stays
 * small in practice; iterating is O(n) but n is bounded.
 */
function enforcePerUserCap(userId: string): void {
  const entries: Array<[string, PendingCall]> = [];
  for (const [id, entry] of PENDING) {
    if (entry.userId === userId) entries.push([id, entry]);
  }
  if (entries.length < MAX_PENDING_PER_USER) return;
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
  const evictCount = entries.length - MAX_PENDING_PER_USER + 1;
  for (let i = 0; i < evictCount; i += 1) {
    PENDING.delete(entries[i]![0]);
  }
}

/**
 * Background sweep. The handle is tracked on `globalThis` so dev-mode
 * module reloads (tsx watch / vitest) don't stack multiple timers on
 * top of each other. `.unref()` keeps the timer from blocking process
 * shutdown.
 */
interface SweeperGlobal {
  __wiscordPendingToolSweeper?: NodeJS.Timeout;
}
const sweeperHost = globalThis as unknown as SweeperGlobal;
if (sweeperHost.__wiscordPendingToolSweeper) {
  clearInterval(sweeperHost.__wiscordPendingToolSweeper);
}
sweeperHost.__wiscordPendingToolSweeper = setInterval(pruneExpired, SWEEP_INTERVAL_MS);
sweeperHost.__wiscordPendingToolSweeper.unref?.();
