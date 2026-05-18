import { useAuth } from '@/hooks/useAuth';
import { DynamicIsland } from '@/components/island/DynamicIsland';

export function AuthedIsland(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <DynamicIsland />;
}
