import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { setPendingServerJoin } from '@/lib/pending-server-join';
import { toast } from '@/lib/toast';
import { ApiError } from '@/queries/client';
import { useRedeemInvite } from '@/queries/invites';

export default function InviteRedeemPage(): React.JSX.Element {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isOnboarded } = useAuth();
  const redeem = useRedeemInvite();
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;

    // Use mutateAsync so we can await the result directly in this effect
    // instead of relying on redeem.data updating — which doesn't reliably
    // trigger a re-render when onSuccess runs outside React's cycle.
    void (async () => {
      try {
        const { serverId } = await redeem.mutateAsync({ code });
        toast.success('You joined the server');
        if (!isOnboarded) {
          setPendingServerJoin(serverId);
          void navigate('/onboarding', { replace: true });
          return;
        }
        void navigate(`/app/servers/${serverId}`, { replace: true });
      } catch (err) {
        // Error state is handled by redeem.isError in the JSX below.
        console.error('[invite] redeem failed', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!code) {
    return <Navigate to="/app" replace />;
  }

  if (redeem.isError) {
    const err = redeem.error;
    const isAuthError =
      err instanceof ApiError &&
      (err.code === 'unauthorized' || err.code === 'unauthenticated' || err.status === 401);

    return (
      <div className="bg-canvas flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-display text-ink font-semibold">Couldn&apos;t join</h1>
        <p className="text-body text-ink-muted max-w-sm">
          {isAuthError
            ? 'You need to be signed in to join a server. Sign in and open this link again.'
            : 'This invite may be expired, already used, or invalid. Ask whoever sent it for a fresh link.'}
        </p>
        <div className="flex gap-2">
          {isAuthError && (
            <Button
              type="button"
              variant="default"
              onClick={() => void navigate(`/sign-in?next=/invite/${code}`, { replace: true })}
            >
              Sign in
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate('/app', { replace: true })}
          >
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-canvas flex min-h-screen flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="text-blurple size-8 animate-spin" aria-hidden />
      <p className="text-body text-ink-muted">Joining server…</p>
    </div>
  );
}