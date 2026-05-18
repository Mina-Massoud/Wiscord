import { EventEmitter } from 'node:events';

import { VoiceActivity, type VoiceActivityDoc } from '../../db/models/VoiceActivity.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { voicePresence } from '../voice/presence-store.js';
import type {
  ControlBody,
  PinQuizBody,
  PomodoroControlBody,
  SetPresenceBody,
  StartActivityBody,
  VoiceActivityResponse,
} from './schemas.js';

/**
 * Kinds that need a server-side coordination doc (host + playhead / quiz
 * pin / pomodoro phase). Notes/Whiteboard are collaborative-by-doc — anyone
 * can open them locally without server-side session tracking.
 */
const HOST_LED_KINDS = new Set(['youtube', 'screen-share', 'quiz', 'pomodoro']);

/**
 * Pomodoro defaults. Could be made configurable per-channel later; v1 ships
 * the canonical 25-min focus / 5-min break / 4-round cycle.
 */
const POMO_FOCUS_MS = 25 * 60 * 1000;
const POMO_BREAK_MS = 5 * 60 * 1000;
const POMO_DEFAULT_ROUNDS = 4;
const POMO_RESET_REQUEST_TTL_MS = 30_000;

/**
 * Event bus for voice-activity state changes. The realtime gateway forwards
 * every change to subscribers of `channel:<id>:activity`, so participants
 * project their UI off the snapshot — same pattern the old WatchParty used,
 * generalized for all five activity kinds.
 */
class VoiceActivityEvents extends EventEmitter {}
export const voiceActivityEvents = new VoiceActivityEvents();

export interface VoiceActivityChange {
  channelId: string;
  /** null on a stop event — viewers should exit the activity. */
  snapshot: VoiceActivityResponse | null;
}

function toResponse(doc: VoiceActivityDoc): VoiceActivityResponse {
  const isWatch = doc.kind === 'youtube' || doc.kind === 'screen-share';
  const isPomo = doc.kind === 'pomodoro';
  return {
    channelId: doc.channelId,
    kind: doc.kind,
    hostUserId: doc.hostUserId,
    startedAt: doc.startedAt.toISOString(),
    source:
      isWatch && doc.sourceKind && doc.sourceUrl
        ? {
            kind: doc.sourceKind,
            url: doc.sourceUrl,
            title: doc.sourceTitle ?? null,
          }
        : null,
    state: isWatch ? doc.state ?? 'idle' : null,
    currentTimeMs: doc.currentTimeMs ?? 0,
    lastTickAt: isWatch && doc.lastTickAt ? doc.lastTickAt.toISOString() : null,
    quizId: doc.kind === 'quiz' ? doc.quizId ?? null : null,
    pomodoro:
      isPomo && doc.pomoPhase && doc.pomoRound != null && doc.pomoTotalRounds != null
        ? {
            phase: doc.pomoPhase,
            round: doc.pomoRound,
            totalRounds: doc.pomoTotalRounds,
            endsAt: doc.pomoEndsAt ? doc.pomoEndsAt.toISOString() : null,
            pausedRemainingMs: doc.pomoPausedRemainingMs,
            resetRequest:
              doc.pomoResetRequestBy && doc.pomoResetRequestedAt
                ? {
                    byUserId: doc.pomoResetRequestBy,
                    requestedAt: doc.pomoResetRequestedAt.toISOString(),
                  }
                : null,
          }
        : null,
  };
}

/**
 * Clear a stale reset request (>30s old) in-place before reading. Pure
 * mutation on the doc; caller decides whether to save. Returns true if a
 * stale request was cleared so the caller can choose to broadcast.
 */
function clearStaleResetRequest(doc: VoiceActivityDoc, now = Date.now()): boolean {
  if (
    doc.pomoResetRequestBy &&
    doc.pomoResetRequestedAt &&
    now - doc.pomoResetRequestedAt.getTime() > POMO_RESET_REQUEST_TTL_MS
  ) {
    doc.pomoResetRequestBy = null;
    doc.pomoResetRequestedAt = null;
    return true;
  }
  return false;
}

function broadcast(doc: VoiceActivityDoc): VoiceActivityResponse {
  const snapshot = toResponse(doc);
  voiceActivityEvents.emit('state_changed', { channelId: doc.channelId, snapshot });
  return snapshot;
}

/**
 * Read the current activity for a channel, or null if none is active.
 */
export async function getActivity(channelId: string): Promise<VoiceActivityResponse | null> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) return null;
  // Sweep stale reset requests on read so the host never sees an
  // expired "X wants to reset" banner sitting in the snapshot.
  if (clearStaleResetRequest(doc)) {
    await doc.save();
  }
  return toResponse(doc);
}

/**
 * Start (or replace) a *host-led* activity in `channelId` with `userId` as
 * host. Notes/Whiteboard never reach this path — they're per-user opens with
 * a shared channel-keyed doc, no server session needed.
 *
 * Conflict rule: if a different user is already hosting a host-led activity
 * here, we 409 instead of silently replacing. The frontend turns that into
 * a "Mina is already hosting X — join existing?" toast. The same host
 * re-calling start (e.g. switching from YouTube to Screen Share, or
 * swapping source URL mid-watch) is allowed and overwrites in place.
 */
export async function startActivity({
  channelId,
  userId,
  body,
}: {
  channelId: string;
  userId: string;
  body: StartActivityBody;
}): Promise<VoiceActivityResponse> {
  if (!HOST_LED_KINDS.has(body.kind)) {
    throw badRequest(
      'not_host_led',
      'Notes and Whiteboard activities do not need a server-side session — open them locally.',
    );
  }

  const now = new Date();
  let doc = await VoiceActivity.findOne({ channelId });

  if (doc && doc.hostUserId !== userId) {
    throw conflict(
      'activity_conflict',
      `Another user is already hosting ${doc.kind} in this channel — join their session or wait for it to end`,
    );
  }

  if (!doc) {
    doc = new VoiceActivity({ channelId });
  }

  doc.kind = body.kind;
  doc.hostUserId = userId;
  doc.startedAt = now;

  if (body.kind === 'youtube' || body.kind === 'screen-share') {
    doc.sourceKind = body.source.kind;
    doc.sourceUrl = body.source.url;
    doc.sourceTitle = body.source.title ?? null;
    doc.state = 'idle';
    doc.currentTimeMs = 0;
    doc.lastTickAt = now;
    doc.quizId = null;
    clearPomoFields(doc);
  } else if (body.kind === 'quiz') {
    doc.sourceKind = null;
    doc.sourceUrl = null;
    doc.sourceTitle = null;
    doc.state = null;
    doc.currentTimeMs = 0;
    doc.lastTickAt = now;
    doc.quizId = body.quizId ?? null;
    clearPomoFields(doc);
  } else if (body.kind === 'pomodoro') {
    doc.sourceKind = null;
    doc.sourceUrl = null;
    doc.sourceTitle = null;
    doc.state = null;
    doc.currentTimeMs = 0;
    doc.lastTickAt = now;
    doc.quizId = null;
    doc.pomoPhase = 'focus';
    doc.pomoRound = 1;
    doc.pomoTotalRounds = body.totalRounds ?? POMO_DEFAULT_ROUNDS;
    doc.pomoEndsAt = new Date(now.getTime() + POMO_FOCUS_MS);
    doc.pomoPausedRemainingMs = null;
    doc.pomoResetRequestBy = null;
    doc.pomoResetRequestedAt = null;
  }

  await doc.save();
  return broadcast(doc);
}

/** Zero out the pomodoro-specific fields when switching to a non-pomodoro kind. */
function clearPomoFields(doc: VoiceActivityDoc): void {
  doc.pomoPhase = null;
  doc.pomoRound = null;
  doc.pomoTotalRounds = null;
  doc.pomoEndsAt = null;
  doc.pomoPausedRemainingMs = null;
  doc.pomoResetRequestBy = null;
  doc.pomoResetRequestedAt = null;
}

/**
 * Update one user's per-user activity presence. Used by both the explicit
 * "I joined X" flow and the "I left X" flow (kind=null). Also auto-stops a
 * host-led session this user owns if they switch to a different kind — the
 * single-host invariant says the activity ends when its host leaves it.
 */
export async function setActivityPresence({
  channelId,
  userId,
  kind,
}: {
  channelId: string;
  userId: string;
  kind: SetPresenceBody['kind'];
}): Promise<void> {
  // Host-leave auto-stop. If this user is the host of an active host-led
  // session and they're moving to a *different* kind (including null), the
  // session ends. Same rule the webhook applies when the host disconnects
  // from voice entirely.
  const doc = await VoiceActivity.findOne({ channelId });
  if (doc && doc.hostUserId === userId && doc.kind !== kind) {
    await VoiceActivity.deleteOne({ channelId });
    voiceActivityEvents.emit('state_changed', { channelId, snapshot: null });
  }

  voicePresence.setActivity(channelId, userId, kind);
}

/**
 * Stop the activity. Host-only — non-hosts are rejected. Idempotent: stopping
 * a channel with no active activity returns false.
 */
export async function stopActivity({
  channelId,
  userId,
}: {
  channelId: string;
  userId: string;
}): Promise<boolean> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) return false;
  if (doc.hostUserId !== userId) {
    throw forbidden('Only the host can end the activity');
  }
  await VoiceActivity.deleteOne({ channelId });
  voiceActivityEvents.emit('state_changed', { channelId, snapshot: null });
  return true;
}

/**
 * Internal: end the activity for a system-level reason (host left voice, room
 * finished, etc). Skips the host check.
 */
export async function forceStopActivity({
  channelId,
  reason,
}: {
  channelId: string;
  reason: string;
}): Promise<{ stopped: boolean; hostUserId: string | null; reason: string }> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) return { stopped: false, hostUserId: null, reason };
  const hostUserId = doc.hostUserId;
  await VoiceActivity.deleteOne({ channelId });
  voiceActivityEvents.emit('state_changed', { channelId, snapshot: null });
  return { stopped: true, hostUserId, reason };
}

/**
 * Look up the current host id, or null if no activity is running.
 */
export async function getHostUserId(channelId: string): Promise<string | null> {
  const doc = await VoiceActivity.findOne({ channelId }).select('hostUserId').lean();
  return doc?.hostUserId ?? null;
}

/**
 * Apply a watch-party control. Only valid when the active activity is a
 * watch kind; rejected with 400 otherwise.
 */
export async function applyWatchControl({
  channelId,
  userId,
  command,
}: {
  channelId: string;
  userId: string;
  command: ControlBody;
}): Promise<VoiceActivityResponse> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) throw notFound('voice_activity');
  if (doc.kind !== 'youtube' && doc.kind !== 'screen-share') {
    throw badRequest('not_a_watch_activity', 'Playback control is only valid for watch activities');
  }
  if (doc.hostUserId !== userId) {
    throw forbidden('Only the host can control playback');
  }

  const now = new Date();
  doc.currentTimeMs = command.timeMs;
  doc.lastTickAt = now;
  if (command.action === 'play') doc.state = 'playing';
  else if (command.action === 'pause') doc.state = 'paused';
  // 'seek' preserves the current play/pause state — only the playhead moves.
  await doc.save();

  return broadcast(doc);
}

/**
 * Transfer host to another user. Caller must currently be host.
 */
export async function transferHost({
  channelId,
  fromUserId,
  toUserId,
}: {
  channelId: string;
  fromUserId: string;
  toUserId: string;
}): Promise<VoiceActivityResponse> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) throw notFound('voice_activity');
  if (doc.hostUserId !== fromUserId) {
    throw forbidden('Only the current host can transfer the host role');
  }
  doc.hostUserId = toUserId;
  await doc.save();
  return broadcast(doc);
}

/**
 * Host-only: pin a quiz to the current quiz activity so everyone in voice
 * sees the same quiz. Setting `quizId` to null unpins (host returns to the
 * "pick a quiz" view).
 */
export async function pinQuiz({
  channelId,
  userId,
  body,
}: {
  channelId: string;
  userId: string;
  body: PinQuizBody;
}): Promise<VoiceActivityResponse> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) throw notFound('voice_activity');
  if (doc.kind !== 'quiz') {
    throw badRequest('not_a_quiz_activity', 'Quiz pin is only valid for the quiz activity');
  }
  if (doc.hostUserId !== userId) {
    throw forbidden('Only the host can pin a quiz');
  }
  doc.quizId = body.quizId;
  await doc.save();
  return broadcast(doc);
}

/**
 * Pomodoro control surface. Three host-only actions plus a participant
 * "reset request" flow:
 *
 *  - `pause`         → snapshot remaining ms, clear `endsAt`. Host-only.
 *  - `resume`        → re-anchor `endsAt = now + paused`. Host-only.
 *  - `skip`          → advance the cycle (`focus → break`, `break → focus
 *                      + round++`, or end on the final break). Host-only.
 *                      Clears any pending reset request.
 *  - `requestReset`  → any participant. Pins a reset request from this
 *                      user. Re-requests by the same user refresh the
 *                      timestamp; a request from a different user replaces
 *                      the existing one (single-slot model).
 *  - `respondReset`  → host-only. Accept resets the timer to a fresh focus
 *                      phase (preserves round count); decline clears the
 *                      request. Either way the banner disappears.
 */
export async function applyPomodoroControl({
  channelId,
  userId,
  command,
}: {
  channelId: string;
  userId: string;
  command: PomodoroControlBody;
}): Promise<VoiceActivityResponse> {
  const doc = await VoiceActivity.findOne({ channelId });
  if (!doc) throw notFound('voice_activity');
  if (doc.kind !== 'pomodoro') {
    throw badRequest('not_a_pomodoro_activity', 'Pomodoro controls only apply to a pomodoro activity');
  }
  if (!doc.pomoPhase || doc.pomoRound == null || doc.pomoTotalRounds == null) {
    // Defensive — a pomodoro doc without phase/round is malformed and
    // shouldn't exist; treat it as not-found.
    throw notFound('voice_activity');
  }

  const now = new Date();
  const isHost = doc.hostUserId === userId;
  clearStaleResetRequest(doc, now.getTime());

  if (command.action === 'requestReset') {
    // Anyone in the channel can request. Replace the existing single-
    // slot request (whether from the same user or someone else).
    doc.pomoResetRequestBy = userId;
    doc.pomoResetRequestedAt = now;
    await doc.save();
    return broadcast(doc);
  }

  // Every other action is host-only.
  if (!isHost) {
    throw forbidden('Only the host can control the pomodoro');
  }

  if (command.action === 'pause') {
    if (doc.pomoEndsAt) {
      doc.pomoPausedRemainingMs = Math.max(0, doc.pomoEndsAt.getTime() - now.getTime());
      doc.pomoEndsAt = null;
    }
  } else if (command.action === 'resume') {
    if (doc.pomoPausedRemainingMs != null) {
      doc.pomoEndsAt = new Date(now.getTime() + doc.pomoPausedRemainingMs);
      doc.pomoPausedRemainingMs = null;
    }
  } else if (command.action === 'skip') {
    advancePomoPhase(doc, now);
    // Skip clears any pending reset — moot once the phase rolled.
    doc.pomoResetRequestBy = null;
    doc.pomoResetRequestedAt = null;
    // `skip` from the final break ends the cycle. The advance helper
    // signals this by zeroing the phase; we drop the doc here.
    if (doc.pomoPhase === null) {
      await VoiceActivity.deleteOne({ channelId });
      voiceActivityEvents.emit('state_changed', { channelId, snapshot: null });
      return {
        channelId,
        kind: 'pomodoro',
        hostUserId: userId,
        startedAt: doc.startedAt.toISOString(),
        source: null,
        state: null,
        currentTimeMs: 0,
        lastTickAt: null,
        quizId: null,
        pomodoro: null,
      };
    }
  } else if (command.action === 'respondReset') {
    if (command.accept) {
      doc.pomoEndsAt = new Date(now.getTime() + POMO_FOCUS_MS);
      doc.pomoPausedRemainingMs = null;
      doc.pomoPhase = 'focus';
      // Round count is preserved — a reset doesn't reward you with a fresh cycle.
    }
    doc.pomoResetRequestBy = null;
    doc.pomoResetRequestedAt = null;
  }

  await doc.save();
  return broadcast(doc);
}

/**
 * Roll the pomodoro phase forward. `focus → break`, `break → focus + round
 * + 1`, and `break on the final round → cycle complete` (caller deletes the
 * doc). Mutates `doc` in place. Always clears `pomoPausedRemainingMs`.
 */
function advancePomoPhase(doc: VoiceActivityDoc, now: Date): void {
  if (!doc.pomoPhase || doc.pomoRound == null || doc.pomoTotalRounds == null) return;
  doc.pomoPausedRemainingMs = null;
  if (doc.pomoPhase === 'focus') {
    doc.pomoPhase = 'break';
    doc.pomoEndsAt = new Date(now.getTime() + POMO_BREAK_MS);
    return;
  }
  // Currently on a break.
  if (doc.pomoRound >= doc.pomoTotalRounds) {
    // Final break complete → cycle done. Caller deletes the doc.
    doc.pomoPhase = null;
    doc.pomoRound = null;
    doc.pomoTotalRounds = null;
    doc.pomoEndsAt = null;
    return;
  }
  doc.pomoPhase = 'focus';
  doc.pomoRound += 1;
  doc.pomoEndsAt = new Date(now.getTime() + POMO_FOCUS_MS);
}
