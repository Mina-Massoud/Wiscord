import { useEffect, useRef, type RefObject } from 'react';

import type { WatchPartySnapshot } from '@/queries/client';
import type { PlayerAdapter } from '@/components/watch/playerAdapter';

/**
 * Maximum acceptable drift before a viewer's player auto-seeks to catch up
 * with the host. ±1.5s feels in-sync to viewers; smaller windows cause
 * constant micro-stutter on slightly-laggy connections.
 */
const DRIFT_TOLERANCE_MS = 1500;

interface UseWatchSyncOptions {
  party: WatchPartySnapshot | null;
  isHost: boolean;
  playerRef: RefObject<PlayerAdapter | null>;
}

/**
 * Projects the host's playhead onto every viewer's player.
 *
 * The math: `expectedNow = party.currentTimeMs + (Date.now() - lastTickAt)`
 * if `state === 'playing'`, else `party.currentTimeMs`. We compare against
 * `player.getCurrentTimeMs()` and seek when the gap exceeds the tolerance.
 *
 * The hook runs:
 *   - once on every party state change (instant snap to the new state)
 *   - every 2s on a polling interval (catches gradual drift from clock skew)
 *
 * The host is exempted from the seek/play/pause replay — their actions
 * already moved the player locally, and re-applying them would cause a
 * one-frame stutter on every host control.
 */
export function useWatchSync({ party, isHost, playerRef }: UseWatchSyncOptions): void {
  // Keep the latest party in a ref so the polling interval can read it
  // without re-binding the interval on every change.
  const partyRef = useRef<WatchPartySnapshot | null>(party);
  partyRef.current = party;

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  // Apply on every party state change.
  useEffect(() => {
    if (!party) return;
    if (isHost) return;
    applySync(party, playerRef.current);
  }, [party, isHost, playerRef]);

  // Drift polling — handles slow-burn skew when there's no fresh server event.
  useEffect(() => {
    if (!party) return;
    if (isHost) return;
    const interval = window.setInterval(() => {
      const current = partyRef.current;
      if (!current) return;
      if (isHostRef.current) return;
      applySync(current, playerRef.current);
    }, 2000);
    return () => {
      window.clearInterval(interval);
    };
  }, [party, isHost, playerRef]);
}

function applySync(party: WatchPartySnapshot, player: PlayerAdapter | null): void {
  if (!player) return;

  const expectedMs = computeExpectedMs(party);
  const actualMs = player.getCurrentTimeMs();
  const drift = Math.abs(actualMs - expectedMs);

  if (drift > DRIFT_TOLERANCE_MS) {
    player.seek(expectedMs);
  }

  if (party.state === 'playing') {
    player.play();
  } else if (party.state === 'paused' || party.state === 'idle') {
    player.pause();
  }
}

/**
 * Pure helper — exported so unit tests can verify the projection math
 * without dragging a player into the harness.
 */
export function computeExpectedMs(party: WatchPartySnapshot): number {
  if (party.state !== 'playing') return party.currentTimeMs;
  const lastTickMs = new Date(party.lastTickAt).getTime();
  const elapsed = Date.now() - lastTickMs;
  // Clamp to ≥ 0 in case the viewer's clock is ahead of the server's.
  return party.currentTimeMs + Math.max(0, elapsed);
}
