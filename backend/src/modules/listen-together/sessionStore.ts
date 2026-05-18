import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';

import { logger } from '../../lib/logger.js';
import type {
  ListenTogetherInviteDto,
  ListenTogetherPlaybackDto,
  ListenTogetherSessionDto,
  ListenTogetherTrackDto,
  ListenTogetherUserDto,
  ListenTogetherPlaybackKind,
} from './schemas.js';

/**
 * In-memory store for listen-together invites and sessions. The store is the
 * single source of truth for "who is in a session with whom" and "what
 * pending invites exist". The realtime gateway forwards every event to the
 * relevant user's `user:<id>` room.
 *
 * Why in-memory: invites and sessions are inherently ephemeral. If the
 * backend restarts mid-session, both sides will reconnect to an empty store
 * and that's fine — they can re-invite. Persisting to MongoDB would mean
 * cleanup jobs for orphaned rows. Pattern mirrors `voice/presence-store.ts`.
 *
 * Multi-node deploys would need Redis pubsub. Acceptable for v1 (single
 * backend node); document and revisit when we horizontally scale.
 */

const INVITE_TTL_MS = 60_000;

export interface ListenTogetherInviteSentEvent {
  toUserId: string;
  invite: ListenTogetherInviteDto;
}

export interface ListenTogetherInviteResolvedEvent {
  /** The party who needs to know — accepter notifies sender, decliner notifies sender, etc. */
  toUserId: string;
  inviteId: string;
  outcome: 'accepted' | 'declined' | 'expired';
  /** Present when outcome === 'accepted'. */
  session: ListenTogetherSessionDto | null;
}

export interface ListenTogetherSessionEndedEvent {
  toUserId: string;
  sessionId: string;
  endedBy: string;
  reason: 'left' | 'replaced' | 'disconnected';
}

export interface ListenTogetherPlaybackEvent {
  toUserId: string;
  playback: ListenTogetherPlaybackDto;
}

interface Invite {
  id: string;
  from: ListenTogetherUserDto;
  to: ListenTogetherUserDto;
  track: ListenTogetherTrackDto;
  createdAt: number;
  expiresAt: number;
  expiryTimer: NodeJS.Timeout;
}

interface Session {
  id: string;
  host: ListenTogetherUserDto;
  viewer: ListenTogetherUserDto;
  track: ListenTogetherTrackDto;
  startedAt: number;
}

export type ListenTogetherSendInviteResult =
  | { ok: true; invite: ListenTogetherInviteDto }
  | { ok: false; code: 'self_invite' | 'already_in_session' };

export type ListenTogetherAcceptResult =
  | { ok: true; session: ListenTogetherSessionDto }
  | { ok: false; code: 'invite_not_found' | 'not_recipient' | 'already_in_session' };

export type ListenTogetherDeclineResult =
  | { ok: true; inviteId: string }
  | { ok: false; code: 'invite_not_found' | 'not_recipient' };

export type ListenTogetherEndResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: 'session_not_found' | 'not_participant' };

export type ListenTogetherBroadcastResult =
  | { ok: true; playback: ListenTogetherPlaybackDto }
  | { ok: false; code: 'session_not_found' | 'not_host' };

export declare interface ListenTogetherSessionStore {
  on(event: 'invite:sent', listener: (event: ListenTogetherInviteSentEvent) => void): this;
  on(
    event: 'invite:resolved',
    listener: (event: ListenTogetherInviteResolvedEvent) => void,
  ): this;
  on(
    event: 'session:ended',
    listener: (event: ListenTogetherSessionEndedEvent) => void,
  ): this;
  on(event: 'session:playback', listener: (event: ListenTogetherPlaybackEvent) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
}

export class ListenTogetherSessionStore extends EventEmitter {
  /** Pending invites keyed by invite id. */
  private readonly invites = new Map<string, Invite>();
  /** Sessions keyed by session id. */
  private readonly sessions = new Map<string, Session>();
  /** Per-user index — points to the session id they're currently in, if any. */
  private readonly userToSession = new Map<string, string>();
  /** Per-user index — pending invites the user has sent or received. */
  private readonly userInvites = new Map<string, Set<string>>();

  // ── Pure lookup helpers ────────────────────────────────────────────────

  getInvite(inviteId: string): ListenTogetherInviteDto | null {
    const inv = this.invites.get(inviteId);
    return inv ? this.toInviteDto(inv) : null;
  }

  getSession(sessionId: string): ListenTogetherSessionDto | null {
    const s = this.sessions.get(sessionId);
    return s ? this.toSessionDto(s) : null;
  }

  getSessionForUser(userId: string): ListenTogetherSessionDto | null {
    const id = this.userToSession.get(userId);
    if (!id) return null;
    const s = this.sessions.get(id);
    return s ? this.toSessionDto(s) : null;
  }

  isUserBusy(userId: string): boolean {
    return this.userToSession.has(userId);
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  sendInvite(
    from: ListenTogetherUserDto,
    to: ListenTogetherUserDto,
    track: ListenTogetherTrackDto,
  ): ListenTogetherSendInviteResult {
    if (from.id === to.id) return { ok: false, code: 'self_invite' };
    if (this.isUserBusy(from.id) || this.isUserBusy(to.id)) {
      return { ok: false, code: 'already_in_session' };
    }

    // Clear any prior pending invite from `from` to `to` — sender re-invites
    // are an "update the track" operation, not a duplicate.
    for (const existingId of this.outgoingInvitesFrom(from.id)) {
      const existing = this.invites.get(existingId);
      if (existing && existing.to.id === to.id) {
        this.expireInvite(existing, /* notify */ false);
      }
    }

    const id = generateInviteId();
    const now = Date.now();
    const expiresAt = now + INVITE_TTL_MS;
    const expiryTimer = setTimeout(() => {
      const stillPending = this.invites.get(id);
      if (stillPending) this.expireInvite(stillPending, /* notify */ true);
    }, INVITE_TTL_MS);
    // Don't keep the event loop alive just for an invite countdown.
    if (typeof expiryTimer.unref === 'function') expiryTimer.unref();

    const invite: Invite = {
      id,
      from,
      to,
      track,
      createdAt: now,
      expiresAt,
      expiryTimer,
    };
    this.invites.set(id, invite);
    this.indexInvite(from.id, id);
    this.indexInvite(to.id, id);

    const dto = this.toInviteDto(invite);
    logger.info(
      { inviteId: id, fromUserId: from.id, toUserId: to.id },
      'listen-together: invite sent',
    );
    this.emit('invite:sent', {
      toUserId: to.id,
      invite: dto,
    } satisfies ListenTogetherInviteSentEvent);

    return { ok: true, invite: dto };
  }

  acceptInvite(callerId: string, inviteId: string): ListenTogetherAcceptResult {
    const invite = this.invites.get(inviteId);
    if (!invite) return { ok: false, code: 'invite_not_found' };
    if (invite.to.id !== callerId) return { ok: false, code: 'not_recipient' };
    // The sender or recipient could have entered a separate session in the
    // window between sendInvite and accept — re-check.
    if (this.isUserBusy(invite.from.id) || this.isUserBusy(invite.to.id)) {
      return { ok: false, code: 'already_in_session' };
    }

    // Resolve the invite (clears timer + indices).
    this.removeInvite(invite);

    // Bounce every *other* pending invite involving either party. The
    // accepter is no longer reachable from other sessions; the sender is
    // committed to this one.
    this.cancelInvitesInvolving(invite.from.id, inviteId);
    this.cancelInvitesInvolving(invite.to.id, inviteId);

    const session: Session = {
      id: generateSessionId(),
      host: invite.from,
      viewer: invite.to,
      track: invite.track,
      startedAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.userToSession.set(session.host.id, session.id);
    this.userToSession.set(session.viewer.id, session.id);

    const dto = this.toSessionDto(session);
    logger.info(
      { sessionId: session.id, host: session.host.id, viewer: session.viewer.id },
      'listen-together: session started',
    );

    // Notify both parties. The accepter already gets the response inline
    // via the HTTP call, but pushing through the socket too keeps state
    // identical if they have multiple tabs open.
    this.emit('invite:resolved', {
      toUserId: invite.from.id,
      inviteId: invite.id,
      outcome: 'accepted',
      session: dto,
    } satisfies ListenTogetherInviteResolvedEvent);
    this.emit('invite:resolved', {
      toUserId: invite.to.id,
      inviteId: invite.id,
      outcome: 'accepted',
      session: dto,
    } satisfies ListenTogetherInviteResolvedEvent);

    return { ok: true, session: dto };
  }

  declineInvite(callerId: string, inviteId: string): ListenTogetherDeclineResult {
    const invite = this.invites.get(inviteId);
    if (!invite) return { ok: false, code: 'invite_not_found' };
    if (invite.to.id !== callerId) return { ok: false, code: 'not_recipient' };

    this.removeInvite(invite);

    logger.info(
      { inviteId, fromUserId: invite.from.id, toUserId: invite.to.id },
      'listen-together: invite declined',
    );
    this.emit('invite:resolved', {
      toUserId: invite.from.id,
      inviteId,
      outcome: 'declined',
      session: null,
    } satisfies ListenTogetherInviteResolvedEvent);

    return { ok: true, inviteId };
  }

  endSession(callerId: string, sessionId: string): ListenTogetherEndResult {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, code: 'session_not_found' };
    const isParticipant =
      session.host.id === callerId || session.viewer.id === callerId;
    if (!isParticipant) return { ok: false, code: 'not_participant' };

    this.tearDownSession(session, callerId, 'left');
    return { ok: true, sessionId };
  }

  broadcastPlayback(
    callerId: string,
    sessionId: string,
    body:
      | { kind: 'play' | 'pause'; hostProgressMs: number }
      | { kind: 'seek'; ms: number; hostProgressMs: number }
      | {
          kind: 'track_changed';
          track: ListenTogetherTrackDto;
          hostProgressMs: number;
        },
  ): ListenTogetherBroadcastResult {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, code: 'session_not_found' };
    if (session.host.id !== callerId) return { ok: false, code: 'not_host' };

    if (body.kind === 'track_changed') {
      session.track = body.track;
    }

    const kind: ListenTogetherPlaybackKind = body.kind;
    const playback: ListenTogetherPlaybackDto = {
      sessionId: session.id,
      kind,
      ms: body.kind === 'seek' ? body.ms : null,
      track: body.kind === 'track_changed' ? body.track : null,
      hostProgressMs: body.hostProgressMs,
      emittedAt: new Date().toISOString(),
    };

    this.emit('session:playback', {
      toUserId: session.viewer.id,
      playback,
    } satisfies ListenTogetherPlaybackEvent);

    return { ok: true, playback };
  }

  /**
   * Called by the gateway on socket disconnect once we've confirmed the user
   * has no other live sockets. Tears down their session and bins pending
   * invites involving them.
   */
  handleDisconnect(userId: string): void {
    const sessionId = this.userToSession.get(userId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) this.tearDownSession(session, userId, 'disconnected');
    }

    for (const inviteId of Array.from(this.outgoingOrIncomingInvitesFor(userId))) {
      const invite = this.invites.get(inviteId);
      if (invite) this.expireInvite(invite, /* notify */ true);
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private cancelInvitesInvolving(userId: string, exceptInviteId: string): void {
    for (const inviteId of Array.from(this.outgoingOrIncomingInvitesFor(userId))) {
      if (inviteId === exceptInviteId) continue;
      const invite = this.invites.get(inviteId);
      if (invite) this.expireInvite(invite, /* notify */ true);
    }
  }

  private tearDownSession(
    session: Session,
    endedBy: string,
    reason: 'left' | 'replaced' | 'disconnected',
  ): void {
    this.sessions.delete(session.id);
    this.userToSession.delete(session.host.id);
    this.userToSession.delete(session.viewer.id);

    logger.info(
      { sessionId: session.id, endedBy, reason },
      'listen-together: session ended',
    );

    // Notify the *other* participant.
    const otherId = endedBy === session.host.id ? session.viewer.id : session.host.id;
    this.emit('session:ended', {
      toUserId: otherId,
      sessionId: session.id,
      endedBy,
      reason,
    } satisfies ListenTogetherSessionEndedEvent);
  }

  private expireInvite(invite: Invite, notify: boolean): void {
    if (!this.invites.has(invite.id)) return;
    this.removeInvite(invite);
    if (!notify) return;
    logger.info({ inviteId: invite.id }, 'listen-together: invite expired');
    // Tell both parties so neither client renders a ghost invite.
    this.emit('invite:resolved', {
      toUserId: invite.from.id,
      inviteId: invite.id,
      outcome: 'expired',
      session: null,
    } satisfies ListenTogetherInviteResolvedEvent);
    this.emit('invite:resolved', {
      toUserId: invite.to.id,
      inviteId: invite.id,
      outcome: 'expired',
      session: null,
    } satisfies ListenTogetherInviteResolvedEvent);
  }

  private removeInvite(invite: Invite): void {
    clearTimeout(invite.expiryTimer);
    this.invites.delete(invite.id);
    this.unindexInvite(invite.from.id, invite.id);
    this.unindexInvite(invite.to.id, invite.id);
  }

  private indexInvite(userId: string, inviteId: string): void {
    const set = this.userInvites.get(userId) ?? new Set<string>();
    set.add(inviteId);
    this.userInvites.set(userId, set);
  }

  private unindexInvite(userId: string, inviteId: string): void {
    const set = this.userInvites.get(userId);
    if (!set) return;
    set.delete(inviteId);
    if (set.size === 0) this.userInvites.delete(userId);
  }

  private outgoingInvitesFrom(userId: string): string[] {
    const set = this.userInvites.get(userId);
    if (!set) return [];
    const out: string[] = [];
    for (const id of Array.from(set)) {
      const inv = this.invites.get(id);
      if (inv && inv.from.id === userId) out.push(id);
    }
    return out;
  }

  private outgoingOrIncomingInvitesFor(userId: string): string[] {
    const set = this.userInvites.get(userId);
    if (!set) return [];
    return Array.from(set);
  }

  private toInviteDto(invite: Invite): ListenTogetherInviteDto {
    return {
      id: invite.id,
      from: invite.from,
      to: invite.to,
      track: invite.track,
      expiresAt: new Date(invite.expiresAt).toISOString(),
      createdAt: new Date(invite.createdAt).toISOString(),
    };
  }

  private toSessionDto(session: Session): ListenTogetherSessionDto {
    return {
      id: session.id,
      host: session.host,
      viewer: session.viewer,
      track: session.track,
      startedAt: new Date(session.startedAt).toISOString(),
    };
  }
}

function generateInviteId(): string {
  return `lt_${randomBytes(8).toString('hex')}`;
}

function generateSessionId(): string {
  return `lts_${randomBytes(8).toString('hex')}`;
}

export const listenTogetherStore: ListenTogetherSessionStore =
  new ListenTogetherSessionStore();
