import { RoomServiceClient } from 'livekit-server-sdk';

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { voicePresence, type VoiceParticipant } from './presence-store.js';
import { forceStopActivity, getHostUserId } from '../voice-activity/service.js';

const POLL_INTERVAL_MS = 2_000;
const ROOM_PREFIX = 'channel-';

/**
 * Polls LiveKit for the live participant set across every voice channel and
 * feeds it into `voicePresence`.
 *
 * This is the v1 source of truth for channel membership — it lets the
 * Socket.IO gateway push presence updates without forcing every viewer to
 * hold their own LiveKit connection (which would balloon participant-minute
 * billing the moment a server has more than a handful of channels).
 *
 * Webhooks will eventually take over as the primary signal (see
 * `voice-webhook` route): they're sub-second and stateless. The poller stays
 * on as a slower reconciliation loop to repair any missed webhook deltas.
 *
 * Gracefully no-ops when LiveKit isn't configured — local dev without a
 * LIVEKIT_* env block still boots the rest of the app.
 */
class LivekitPresencePoller {
  private timer: NodeJS.Timeout | null = null;
  private client: RoomServiceClient | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL) {
      logger.warn('voice: LiveKit not configured — presence poller disabled');
      return;
    }

    const httpUrl = env.LIVEKIT_URL.replace(/^wss:\/\//, 'https://').replace(
      /^ws:\/\//,
      'http://',
    );
    this.client = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // Don't pin the event loop open on shutdown.
    this.timer.unref?.();

    logger.info({ intervalMs: POLL_INTERVAL_MS }, 'voice: presence poller started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.client || this.running) return;
    this.running = true;
    try {
      const rooms = await this.client.listRooms();
      const liveChannelIds = new Set<string>();

      for (const room of rooms) {
        if (!room.name.startsWith(ROOM_PREFIX)) continue;
        const channelId = room.name.slice(ROOM_PREFIX.length);
        liveChannelIds.add(channelId);

        const participants = await this.client.listParticipants(room.name);
        // The shape `replace()` accepts — activityKind is not LiveKit-derived;
        // the presence store carries any existing kind forward across ticks.
        const mapped: Array<Omit<VoiceParticipant, 'activityKind'>> = participants.map((p) => ({
          identity: p.identity,
          name: p.name?.trim() || p.identity,
          joinedAt: Number(p.joinedAt) * 1000 || Date.now(),
        }));

        voicePresence.replace(channelId, mapped);

        // Reconciliation: if an activity is running in this channel but the
        // host isn't in the LiveKit participant list, the webhook missed the
        // departure — force-stop here. Idempotent if already stopped.
        await this.checkActivityHostStillPresent(channelId, mapped);
      }

      // Channels that disappeared from LiveKit (room finished / last
      // participant left) need to clear locally so the sidebar stops
      // showing stale rows. Also auto-stop any activity that was running.
      for (const channelId of voicePresence.activeChannelIds()) {
        if (!liveChannelIds.has(channelId)) {
          voicePresence.replace(channelId, []);
          await this.forceStopOnVanish(channelId);
        }
      }
    } catch (err) {
      logger.warn({ err }, 'voice: presence poll failed');
    } finally {
      this.running = false;
    }
  }

  private async checkActivityHostStillPresent(
    channelId: string,
    participants: ReadonlyArray<Pick<VoiceParticipant, 'identity'>>,
  ): Promise<void> {
    try {
      const hostId = await getHostUserId(channelId);
      if (!hostId) return;
      const stillThere = participants.some((p) => p.identity === hostId);
      if (stillThere) return;
      const result = await forceStopActivity({
        channelId,
        reason: 'host_missing_from_room',
      });
      if (result.stopped) {
        logger.info(
          { channelId, hostUserId: result.hostUserId },
          'voice: poller force-stopped activity (host vanished)',
        );
      }
    } catch (err) {
      logger.warn(
        { err, channelId },
        'voice: poller failed to check activity host presence',
      );
    }
  }

  private async forceStopOnVanish(channelId: string): Promise<void> {
    try {
      await forceStopActivity({ channelId, reason: 'room_vanished' });
    } catch (err) {
      logger.warn(
        { err, channelId },
        'voice: poller failed to force-stop activity on room vanish',
      );
    }
  }
}

export const livekitPresencePoller: LivekitPresencePoller = new LivekitPresencePoller();
