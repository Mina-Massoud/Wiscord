import { useNavigate } from 'react-router';
import { toast } from '@/lib/toast';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sign-in landing while the workspace UI is still being built.
 * Server CRUD is intentionally out of scope until the backend exposes it.
 */
export default function AppShellPlaceholder(): React.JSX.Element {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  async function handleSignOut(): Promise<void> {
    try {
      await signOut();
      void navigate('/sign-in');
    } catch (err: unknown) {
      const message =
        err !== null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not sign out. Please try again.';
      toast.error(message);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-md border p-8">
        <h1 className="text-foreground text-subhead mb-1 font-semibold">
          Welcome back,{' '}
          <span className="font-bold">{profile?.display_name ?? profile?.username ?? '…'}</span>.
        </h1>
        <p className="text-muted-foreground text-control mb-6">
          You&apos;re signed in. The workspace surface (servers, channels, chat) ships next once the
          backend exposes those endpoints.
        </p>

        <Button variant="outline" onClick={handleSignOut} className="w-full">
          Sign out
        </Button>
      </div>
    </div>
  );
}
