import { useEffect, useState } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import {
  ConnectionState,
  type LocalParticipant,
  type Participant,
  RoomEvent,
} from 'livekit-client';

/**
 * Null-safe LiveKit hook wrappers. The `@livekit/components-react` hooks
 * (`useConnectionState`, `useParticipants`, `useLocalParticipant`) all
 * throw when called outside `<LiveKitRoom>`, which breaks the brief
 * window where the voice-route page renders before
 * `GlobalVoiceProvider`'s lazy `LiveKitRoomMount` chunk has finished
 * loading.
 *
 * These wrappers degrade gracefully:
 *   - No Room context yet → return sane defaults (Disconnected, []).
 *   - Room mounted → subscribe to the same events the real hooks watch
 *     and re-render on change.
 *
 * Voice-page-internal components that used to call the throwing
 * variants should use these instead. Live-only components rendered
 * exclusively from inside a confirmed-connected gate (e.g. behind a
 * `hasConnected` check) can keep using the real hooks.
 */
export function useMaybeConnectionState(): ConnectionState {
  const room = useMaybeRoomContext();
  const [state, setState] = useState<ConnectionState>(room?.state ?? ConnectionState.Disconnected);

  useEffect(() => {
    if (!room) {
      setState(ConnectionState.Disconnected);
      return;
    }
    setState(room.state);
    const onChange = (next: ConnectionState): void => setState(next);
    room.on(RoomEvent.ConnectionStateChanged, onChange);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onChange);
    };
  }, [room]);

  return state;
}

export function useMaybeParticipants(): Participant[] {
  const room = useMaybeRoomContext();
  const [participants, setParticipants] = useState<Participant[]>(() => snapshotParticipants(room));

  useEffect(() => {
    if (!room) {
      setParticipants([]);
      return;
    }
    setParticipants(snapshotParticipants(room));
    const update = (): void => setParticipants(snapshotParticipants(room));
    const events: RoomEvent[] = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ConnectionStateChanged,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
    ];
    for (const e of events) room.on(e, update);
    return () => {
      for (const e of events) room.off(e, update);
    };
  }, [room]);

  return participants;
}

export function useMaybeLocalParticipant(): LocalParticipant | null {
  const room = useMaybeRoomContext();
  return room?.localParticipant ?? null;
}

function snapshotParticipants(room: ReturnType<typeof useMaybeRoomContext>): Participant[] {
  if (!room) return [];
  const local = room.localParticipant;
  const remotes = Array.from(room.remoteParticipants.values());
  return local ? [local, ...remotes] : remotes;
}
