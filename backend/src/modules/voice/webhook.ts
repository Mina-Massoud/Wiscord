import { WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { badRequest, serverError } from '../../lib/errors.js';
import { voicePresence, type VoiceParticipant } from './presence-store.js';
import { forceStopParty, getHostUserId } from '../watchparty/service.js';

const ROOM_PREFIX = 'channel-';

let cached: WebhookReceiver | null = null;
function receiver(): WebhookReceiver {
  if (cached) return cached;
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw serverError('LiveKit credentials not configured');
  }
  cached = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  return cached;
}

/**
 * Verifies the LiveKit-signed webhook, applies the event to the in-memory
 * presence store, and returns the parsed event for logging.
 *
 * Webhooks LiveKit may send (we act on the participant ones; the rest are
 * just logged for visibility):
 *  - `participant_joined` → add to channel's participant set
 *  - `participant_left`   → remove from channel's participant set
 *  - `room_finished`      → clear the channel
 *  - `room_started`, `track_*`, `egress_*`, `ingress_*` → ignored
 *
 * The poller in `livekit-presence-poller` continues to run in parallel and
 * reconciles any state we missed (webhook delivery isn't guaranteed).
 */
export async function handleLivekitWebhook(
  body: string,
  authHeader: string,
): Promise<WebhookEvent> {
  if (!authHeader) throw badRequest('missing_auth_header', 'LiveKit Authorization header required');

  let event: WebhookEvent;
  try {
    event = await receiver().receive(body, authHeader);
  } catch (err) {
    logger.warn({ err }, 'voice: webhook signature rejected');
    throw badRequest('invalid_webhook_signature', 'Webhook signature did not verify');
  }

  const roomName = event.room?.name;
  if (!roomName || !roomName.startsWith(ROOM_PREFIX)) return event;
  const channelId = roomName.slice(ROOM_PREFIX.length);

  switch (event.event) {
    case 'participant_joined': {
      const p = event.participant;
      if (!p) break;
      const existing = voicePresence.list(channelId);
      const next: VoiceParticipant[] = [
        ...existing.filter((x) => x.identity !== p.identity),
        {
          identity: p.identity,
          name: p.name?.trim() || p.identity,
          joinedAt: Number(p.joinedAt) * 1000 || Date.now(),
        },
      ];
      voicePresence.replace(channelId, next);
      break;
    }
    case 'participant_left': {
      const p = event.participant;
      if (!p) break;
      voicePresence.remove(channelId, p.identity);
      // If the leaver was hosting a watch party in this channel, end it.
      // Non-host leavers are a no-op for the party — viewers stay watching.
      try {
        const hostId = await getHostUserId(channelId);
        if (hostId && hostId === p.identity) {
          const result = await forceStopParty({
            channelId,
            reason: 'host_left_voice',
          });
          if (result.stopped) {
            logger.info(
              { channelId, hostUserId: result.hostUserId },
              'voice: host left → watch party auto-stopped',
            );
          }
        }
      } catch (err) {
        logger.warn({ err, channelId }, 'voice: failed to auto-stop watch party on host leave');
      }
      break;
    }
    case 'room_finished': {
      voicePresence.replace(channelId, []);
      // Whole room is gone — any party for this channel ends with it.
      try {
        await forceStopParty({ channelId, reason: 'room_finished' });
      } catch (err) {
        logger.warn({ err, channelId }, 'voice: failed to auto-stop watch party on room_finished');
      }
      break;
    }
    default:
      break;
  }

  return event;
}
