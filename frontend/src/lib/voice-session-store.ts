import { create } from 'zustand';

import type { ActivityKind } from '@/queries/client';

/**
 * Source of truth for "is this user in a voice channel right now."
 *
 * Voice connection state lives in this store instead of inside the voice
 * page's component tree so it survives every route change. The matching
 * `<LiveKitRoom>` is mounted at the app root (see `GlobalVoiceProvider`)
 * and reads from this store via `connect={Boolean(channelId && token)}`.
 *
 * Not persisted — refreshing the tab drops the session so we never
 * silently re-open a microphone the user didn't ask for on this load.
 */
interface VoiceSessionStore {
  /** Channel the user wants to be in. `null` = not in voice. */
  channelId: string | null;
  /**
   * Route path that *owns* the connected channel — where "jump to voice"
   * and the activity launcher navigate back to. A server voice channel
   * sets `/app/servers/:serverId/channels/:channelId`; the labs voice page
   * sets `/app/labs/voice/:channelId`. Recorded at join time so navigation
   * never has to guess which surface the channel lives on.
   */
  voiceHome: string | null;
  /** LiveKit access token, fetched after channelId is set. */
  token: string | null;
  /** LiveKit server URL paired with the token. */
  livekitUrl: string | null;
  /** Which activity surface this user is currently viewing in-channel. */
  myActivityKind: ActivityKind | null;
  /**
   * Flips true the first time LiveKit reports `Connected` for the current
   * session. Used to gate "you left voice" feedback so we don't toast on
   * a cancelled connect attempt. Resets on `leaveChannel`.
   */
  hasConnected: boolean;

  /**
   * Begin joining a channel. Clears any prior token so the LiveKit room
   * disconnects, then a lifecycle hook will fetch the new channel's
   * token and call `setSession`. Calling with the currently-active
   * channelId is a no-op so this is safe to call defensively.
   *
   * `home` is the route that owns the channel (server channel route or
   * labs voice route); it's refreshed even on the no-op path so a re-join
   * from a different surface keeps the navigation target accurate.
   */
  joinChannel: (channelId: string, home?: string | null) => void;

  /**
   * Write the freshly-fetched token+url for `channelId` back to the
   * store. Stale results (where the user already switched to a different
   * channel) are discarded — keeps channel-switch races safe.
   */
  setSession: (input: { channelId: string; token: string; livekitUrl: string }) => void;

  /** Disconnect intent. Resets every voice-related field. */
  leaveChannel: () => void;

  /**
   * Update what activity surface the user is viewing. No-op when the
   * user is not in voice — activities only exist inside a channel.
   */
  setActivityKind: (kind: ActivityKind | null) => void;

  /** Called by the global LiveKitRoom's `onConnected` callback. */
  markConnected: () => void;
}

export const useVoiceSessionStore = create<VoiceSessionStore>((set) => ({
  channelId: null,
  voiceHome: null,
  token: null,
  livekitUrl: null,
  myActivityKind: null,
  hasConnected: false,

  joinChannel: (channelId, home = null) =>
    set((state) => {
      if (state.channelId === channelId) {
        // Already in this channel — refresh the home route if a new one
        // was supplied (e.g. re-entered from a different surface).
        return home && home !== state.voiceHome ? { voiceHome: home } : state;
      }
      return {
        channelId,
        voiceHome: home,
        token: null,
        livekitUrl: null,
        myActivityKind: null,
        hasConnected: false,
      };
    }),

  setSession: ({ channelId, token, livekitUrl }) =>
    set((state) => {
      if (state.channelId !== channelId) return state;
      if (state.token === token && state.livekitUrl === livekitUrl) return state;
      return { token, livekitUrl };
    }),

  leaveChannel: () =>
    set({
      channelId: null,
      voiceHome: null,
      token: null,
      livekitUrl: null,
      myActivityKind: null,
      hasConnected: false,
    }),

  setActivityKind: (kind) =>
    set((state) => {
      if (!state.channelId) return state;
      if (state.myActivityKind === kind) return state;
      return { myActivityKind: kind };
    }),

  markConnected: () =>
    set((state) => {
      if (!state.channelId) return state;
      if (state.hasConnected) return state;
      return { hasConnected: true };
    }),
}));

/** Stable selector helpers for components that only need one field. */
export const useConnectedChannelId = (): string | null => useVoiceSessionStore((s) => s.channelId);

/** Route that owns the connected channel (server channel route or labs voice route). */
export const useVoiceHome = (): string | null => useVoiceSessionStore((s) => s.voiceHome);

export const useMyActivityKind = (): ActivityKind | null =>
  useVoiceSessionStore((s) => s.myActivityKind);
