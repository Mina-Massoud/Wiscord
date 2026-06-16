import { beforeEach, describe, expect, it } from 'vitest';

import { useVoiceSessionStore } from './voice-session-store';

const initialState = useVoiceSessionStore.getState();

function reset(): void {
  useVoiceSessionStore.setState(initialState, true);
}

const CHANNEL_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const CHANNEL_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describe('voice-session-store', () => {
  beforeEach(reset);

  it('starts in a fully disconnected state', () => {
    const s = useVoiceSessionStore.getState();
    expect(s.channelId).toBeNull();
    expect(s.voiceHome).toBeNull();
    expect(s.token).toBeNull();
    expect(s.livekitUrl).toBeNull();
    expect(s.myActivityKind).toBeNull();
    expect(s.hasConnected).toBe(false);
  });

  it('joinChannel records the home route for the connected channel', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A, '/app/servers/s1/channels/aaa');
    expect(useVoiceSessionStore.getState().voiceHome).toBe('/app/servers/s1/channels/aaa');
  });

  it('joinChannel refreshes the home route even when the channel is unchanged', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A, '/app/labs/voice/aaa');
    // Re-entered from the server surface — same channel, new home.
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A, '/app/servers/s1/channels/aaa');
    expect(useVoiceSessionStore.getState().channelId).toBe(CHANNEL_A);
    expect(useVoiceSessionStore.getState().voiceHome).toBe('/app/servers/s1/channels/aaa');
  });

  it('leaveChannel clears the home route', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A, '/app/servers/s1/channels/aaa');
    useVoiceSessionStore.getState().leaveChannel();
    expect(useVoiceSessionStore.getState().voiceHome).toBeNull();
  });

  it('joinChannel sets channelId and leaves token null until setSession fires', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    const s = useVoiceSessionStore.getState();
    expect(s.channelId).toBe(CHANNEL_A);
    expect(s.token).toBeNull();
    expect(s.livekitUrl).toBeNull();
  });

  it('joinChannel is a no-op when the target channel is already active', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().setSession({
      channelId: CHANNEL_A,
      token: 't-a',
      livekitUrl: 'wss://a',
    });
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    const s = useVoiceSessionStore.getState();
    expect(s.token).toBe('t-a');
    expect(s.livekitUrl).toBe('wss://a');
  });

  it('joinChannel(B) while in A clears the prior token so LiveKit disconnects', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().setSession({
      channelId: CHANNEL_A,
      token: 't-a',
      livekitUrl: 'wss://a',
    });
    useVoiceSessionStore.getState().setActivityKind('notes');
    useVoiceSessionStore.getState().markConnected();

    useVoiceSessionStore.getState().joinChannel(CHANNEL_B);
    const s = useVoiceSessionStore.getState();
    expect(s.channelId).toBe(CHANNEL_B);
    expect(s.token).toBeNull();
    expect(s.livekitUrl).toBeNull();
    expect(s.myActivityKind).toBeNull();
    expect(s.hasConnected).toBe(false);
  });

  it('setSession discards stale results that arrive after a channel switch', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().joinChannel(CHANNEL_B);
    // Pretend the A-token fetch resolved after we already switched to B.
    useVoiceSessionStore
      .getState()
      .setSession({ channelId: CHANNEL_A, token: 't-a', livekitUrl: 'wss://a' });
    const s = useVoiceSessionStore.getState();
    expect(s.channelId).toBe(CHANNEL_B);
    expect(s.token).toBeNull();
  });

  it('leaveChannel resets every voice field', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().setSession({
      channelId: CHANNEL_A,
      token: 't-a',
      livekitUrl: 'wss://a',
    });
    useVoiceSessionStore.getState().setActivityKind('whiteboard');
    useVoiceSessionStore.getState().markConnected();

    useVoiceSessionStore.getState().leaveChannel();
    const s = useVoiceSessionStore.getState();
    expect(s.channelId).toBeNull();
    expect(s.token).toBeNull();
    expect(s.livekitUrl).toBeNull();
    expect(s.myActivityKind).toBeNull();
    expect(s.hasConnected).toBe(false);
  });

  it('leaveChannel is idempotent', () => {
    useVoiceSessionStore.getState().leaveChannel();
    useVoiceSessionStore.getState().leaveChannel();
    expect(useVoiceSessionStore.getState().channelId).toBeNull();
  });

  it('setActivityKind is a no-op when not in a channel', () => {
    useVoiceSessionStore.getState().setActivityKind('notes');
    expect(useVoiceSessionStore.getState().myActivityKind).toBeNull();
  });

  it('setActivityKind updates the field once a channel is set', () => {
    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().setActivityKind('notes');
    expect(useVoiceSessionStore.getState().myActivityKind).toBe('notes');
    useVoiceSessionStore.getState().setActivityKind(null);
    expect(useVoiceSessionStore.getState().myActivityKind).toBeNull();
  });

  it('markConnected only flips hasConnected when a channel is set', () => {
    useVoiceSessionStore.getState().markConnected();
    expect(useVoiceSessionStore.getState().hasConnected).toBe(false);

    useVoiceSessionStore.getState().joinChannel(CHANNEL_A);
    useVoiceSessionStore.getState().markConnected();
    expect(useVoiceSessionStore.getState().hasConnected).toBe(true);
  });
});
