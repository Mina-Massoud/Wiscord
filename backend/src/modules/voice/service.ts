import { AccessToken, TrackSource } from 'livekit-server-sdk';

import { User } from '../../db/models/index.js';
import { env } from '../../lib/env.js';
import { notFound, serverError } from '../../lib/errors.js';

export interface VoiceTokenResult {
  token: string;
  livekitUrl: string;
  identity: string;
  roomName: string;
}

/**
 * Mint a short-lived LiveKit access token scoped to a single channel's voice
 * room. The room name is `channel-<channelId>` — every participant minting a
 * token for the same channel lands in the same room.
 *
 * Identity is the authenticated user's id; the display `name` is the user's
 * displayName falling back to their username so LiveKit's participant tile
 * shows something human-readable.
 *
 * Presence (who's currently in the channel) is NOT served from LiveKit on a
 * per-viewer basis. Viewers learn about active channels through the Socket.IO
 * gateway driven by `voice/presence-store`, so we never spin up "observer"
 * LiveKit sessions just to populate sidebars — that would blow past LiveKit's
 * participant cap as soon as a server had a handful of channels.
 *
 * TODO(channel-team): once the channels module exists, verify the user is a
 * member of channelId and throw forbidden('not_member') otherwise. For now
 * the only gate is requireAuth — anyone signed in can mint a token for any
 * UUID. Flip this single line and the feature is production-ready.
 */
export async function mintLivekitToken({
  userId,
  channelId,
}: {
  userId: string;
  channelId: string;
}): Promise<VoiceTokenResult> {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL) {
    throw serverError(
      'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in backend/.env.',
    );
  }

  const user = await User.findById(userId);
  if (!user) throw notFound('user');

  const displayName = user.displayName?.trim() || user.username;
  const roomName = `channel-${channelId}`;

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: displayName,
    ttl: '1h',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Microphone + screen share are the only sources we permit. Camera stays
    // off — Wiscord's voice surface is audio-only (no face cams), but screen
    // share is needed for the Watch Together "share your tab" path.
    canPublishSources: [
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
  });

  const token = await at.toJwt();

  return {
    token,
    livekitUrl: env.LIVEKIT_URL,
    identity: userId,
    roomName,
  };
}
