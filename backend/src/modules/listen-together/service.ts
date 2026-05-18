import {
  Friendship,
  User,
  canonicalPair,
  type UserDoc,
} from '../../db/models/index.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { listenTogetherStore } from './sessionStore.js';
import type {
  ListenTogetherInviteDto,
  ListenTogetherPlaybackDto,
  ListenTogetherSessionDto,
  ListenTogetherTrackDto,
  ListenTogetherUserDto,
  PlaybackBody,
} from './schemas.js';

/**
 * Thin orchestration layer between HTTP routes and the in-memory
 * `listenTogetherStore`. The store enforces invariants (one session per user,
 * recipient-only accept, host-only broadcast); this service adds the things
 * the store can't know: the friendship gate, the recipient-must-be-online
 * check, and the User → UserDto projection.
 */

function toUserDto(user: UserDoc): ListenTogetherUserDto {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

/**
 * Are these two users friends? Listen-together invites are gated to the
 * caller's friends list — same surface area as DMs.
 */
async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const { a, b } = canonicalPair(userIdA, userIdB);
  const edge = await Friendship.findOne({ userAId: a, userBId: b });
  return edge !== null;
}

export async function sendInvite(
  callerId: string,
  toUserId: string,
  track: ListenTogetherTrackDto,
  isRecipientOnline: (userId: string) => boolean,
): Promise<ListenTogetherInviteDto> {
  if (callerId === toUserId) {
    throw badRequest('cannot_invite_self', "You can't vibe with yourself, fam.");
  }

  const [me, them] = await Promise.all([
    User.findById(callerId),
    User.findById(toUserId),
  ]);
  if (!me) throw notFound('user');
  if (!them) throw notFound('recipient');

  const friends = await areFriends(callerId, toUserId);
  if (!friends) throw forbidden('Add them as a friend first.');

  if (!isRecipientOnline(toUserId)) {
    throw conflict('recipient_offline', "They're not around. Try again later.");
  }

  const result = listenTogetherStore.sendInvite(
    toUserDto(me),
    toUserDto(them),
    track,
  );
  if (!result.ok) {
    if (result.code === 'self_invite') {
      throw badRequest('cannot_invite_self', "You can't vibe with yourself, fam.");
    }
    if (result.code === 'already_in_session') {
      throw conflict(
        'already_in_session',
        'One of you is already in a listen-together session.',
      );
    }
  }
  return (result as { ok: true; invite: ListenTogetherInviteDto }).invite;
}

export function acceptInvite(
  callerId: string,
  inviteId: string,
): ListenTogetherSessionDto {
  const result = listenTogetherStore.acceptInvite(callerId, inviteId);
  if (!result.ok) {
    if (result.code === 'invite_not_found') throw notFound('invite');
    if (result.code === 'not_recipient') {
      throw forbidden('Only the recipient can accept this invite.');
    }
    if (result.code === 'already_in_session') {
      throw conflict(
        'already_in_session',
        'One of you is already in a listen-together session.',
      );
    }
  }
  return (result as { ok: true; session: ListenTogetherSessionDto }).session;
}

export function declineInvite(callerId: string, inviteId: string): { id: string } {
  const result = listenTogetherStore.declineInvite(callerId, inviteId);
  if (!result.ok) {
    if (result.code === 'invite_not_found') throw notFound('invite');
    if (result.code === 'not_recipient') {
      throw forbidden('Only the recipient can decline this invite.');
    }
  }
  return { id: (result as { ok: true; inviteId: string }).inviteId };
}

export function endSession(callerId: string, sessionId: string): { id: string } {
  const result = listenTogetherStore.endSession(callerId, sessionId);
  if (!result.ok) {
    if (result.code === 'session_not_found') throw notFound('session');
    if (result.code === 'not_participant') {
      throw forbidden('Only participants can end this session.');
    }
  }
  return { id: (result as { ok: true; sessionId: string }).sessionId };
}

export function broadcastPlayback(
  callerId: string,
  sessionId: string,
  body: PlaybackBody,
): ListenTogetherPlaybackDto {
  const result = listenTogetherStore.broadcastPlayback(callerId, sessionId, body);
  if (!result.ok) {
    if (result.code === 'session_not_found') throw notFound('session');
    if (result.code === 'not_host') {
      throw forbidden('Only the host can broadcast playback.');
    }
  }
  return (result as { ok: true; playback: ListenTogetherPlaybackDto }).playback;
}
