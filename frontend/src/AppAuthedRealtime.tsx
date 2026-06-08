import { useAuth } from '@/hooks/useAuth';
import { useDmRealtime } from '@/queries/dms';
import { useNotificationRealtime } from '@/queries/notifications';
import { useServerUnreadRealtime } from '@/queries/servers';

function AuthedRealtimeSubscriptions(): null {
  useDmRealtime();
  useNotificationRealtime();
  useServerUnreadRealtime();
  return null;
}

export function AuthedRealtime(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <AuthedRealtimeSubscriptions />;
}
