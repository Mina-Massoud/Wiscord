import { useAuth } from '@/hooks/useAuth';
import { CheckoutReturnHandler } from '@/components/billing/CheckoutReturnHandler';

export function AuthedCheckoutReturnHandler(): React.JSX.Element | null {
  const { session, isOnboarded } = useAuth();
  if (!session || !isOnboarded) return null;
  return <CheckoutReturnHandler />;
}
