import { useListenTogetherStore } from '@/lib/listen-together-store';
import { useMusicPlayerStore } from '@/lib/music-player-store';
import { useIntegrations } from '@/queries/integrations';

import { resolveView } from './MusicCapsule';
import { MUSIC_SHAPES } from './musicCapsuleShapes';

/**
 * Current rendered width of the music capsule, mirroring the resolution
 * priority in `MusicCapsule`. Sibling capsules (AI) read this to slide
 * out of the music shell's path as it morphs between idle/bar/expanded
 * — same source of truth, same morph cadence.
 */
export function useMusicShellWidth(): number {
  const { data: integrations } = useIntegrations();
  const view = useMusicPlayerStore((s) => s.view);
  const track = useMusicPlayerStore((s) => s.track);
  const incomingInvite = useListenTogetherStore((s) => s.incomingInvite);
  const sentInvite = useListenTogetherStore((s) => s.sentInvite);
  const activeSession = useListenTogetherStore((s) => s.activeSession);
  const role = useListenTogetherStore((s) => s.role);

  const hasIntegration = (integrations?.length ?? 0) > 0;
  const effectiveView = resolveView({
    hasIntegration,
    incomingInvite: incomingInvite !== null,
    activeSession: activeSession !== null,
    sentInvite: sentInvite !== null,
    role,
    hasTrack: track !== null,
    expanded: view === 'expanded',
  });
  return MUSIC_SHAPES[effectiveView].width;
}
