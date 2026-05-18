import { useAuth } from '@/hooks/useAuth';
import { useListenTogetherRealtime } from '@/queries/listen-together';
import { useListenTogetherSync } from '@/hooks/useListenTogetherSync';
import { HiddenMusicPlayer } from '@/components/music/HiddenMusicPlayer';
import { MusicCapsule } from '@/components/music/MusicCapsule';
import { AiCapsule } from '@/components/ai/AiCapsule';

export function AuthedMusic(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  // Subscribe to listen-together socket events at the root so invites land
  // even when the recipient is on a page that doesn't otherwise read the
  // music store. The hook is a no-op when there's no live socket.
  useListenTogetherRealtime();
  // Bridge listen-together session state to/from the music player store.
  // No-op when there's no active session.
  useListenTogetherSync();
  if (!session || !isOnboarded) return null;
  return (
    <>
      <HiddenMusicPlayer />
      <MusicCapsule />
      <AiCapsule />
    </>
  );
}
