import { useAuth } from '@/hooks/useAuth';
import { IntegrationsReturnHandler } from '@/components/settings/IntegrationsReturnHandler';

export function AuthedIntegrationsReturnHandler(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <IntegrationsReturnHandler />;
}
