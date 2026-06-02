import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/lib/toast';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

import Identicon from '@/components/auth/Identicon';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { consumePendingServerJoin } from '@/lib/pending-server-join';
import { useUpdateProfile, useUsernameAvailable } from '@/queries/profile';
import type { ProfileError } from '@/types/auth';
import { OnboardingProgress } from './OnboardingProgress';
import { ProfileSkeleton } from './ProfileStepProfileSkeleton';
import { ProfileLoadError } from './ProfileStepProfileLoadError';

const profileSchema = z.object({
  username: z
    .string()
    .min(2, 'At least 2 characters')
    .max(32, 'At most 32 characters')
    .regex(/^[a-z0-9_]+$/i, 'Letters, numbers, and underscores only'),
  display_name: z.string().min(1, 'Required').max(64, 'At most 64 characters'),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfileStep(): React.JSX.Element {
  const navigate = useNavigate();
  const { user, profile, isLoading, profileError, signOut } = useAuth();
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? profile?.username ?? '',
    },
  });

  const watchedUsername = form.watch('username');
  const { isChecking, isAvailable } = useUsernameAvailable(watchedUsername);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // Stale JWT, deleted account, RLS failure, network — surface a clear recovery
  // path instead of spinning forever on the skeleton.
  if (profileError !== null || !profile || !user) {
    return (
      <ProfileLoadError
        message={profileError?.message ?? 'Your session looks stale. Sign in again to continue.'}
        onSignOut={signOut}
      />
    );
  }

  const isPending = form.formState.isSubmitting || updateProfile.isPending;
  const isUsernameInvalid = isAvailable === false;
  const canSubmit = !isPending && !isUsernameInvalid && !isChecking;

  async function onSubmit(values: ProfileValues): Promise<void> {
    try {
      await updateProfile.mutateAsync({
        username: values.username,
        display_name: values.display_name,
        // Server-side workspace setup is not wired yet — finish onboarding
        // here. Once CRUD endpoints land we'll move this stamp to the
        // workspace step so reload-mid-flow doesn't strand the user.
        onboarded_at: new Date().toISOString(),
      });
      const pendingServerId = consumePendingServerJoin();
      void navigate(pendingServerId ? `/app/servers/${pendingServerId}` : '/app');
    } catch (err: unknown) {
      const profileErr = err as ProfileError;
      if (profileErr?.code === 'username_taken') {
        form.setError('username', { message: 'That username is already taken.' });
        return;
      }
      toast.error(profileErr?.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <OnboardingProgress step={3} />
      </div>

      <Identicon seed={user.id} size="lg" />

      <div className="w-full">
        <h2 className="text-foreground text-subhead mb-1 text-center font-semibold">
          Set up your profile
        </h2>
        <p className="text-muted-foreground text-caption mb-6 text-center">
          Choose a username and display name.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {/* Username */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input placeholder="your_username" autoComplete="username" {...field} />
                    </FormControl>
                    {/* Availability badge */}
                    {watchedUsername.length >= 2 && (
                      <span className="absolute inset-y-0 right-3 flex items-center">
                        {isChecking ? (
                          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        ) : isAvailable === true ? (
                          <CheckCircle2 className="text-secondary h-4 w-4" aria-label="Available" />
                        ) : isAvailable === false ? (
                          <XCircle className="text-destructive h-4 w-4" aria-label="Taken" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  {watchedUsername.length >= 2 && !isChecking && isAvailable !== null && (
                    <p
                      className={
                        isAvailable ? 'text-secondary text-badge' : 'text-destructive text-badge'
                      }
                    >
                      {isAvailable ? '✓ Available' : '✗ Taken'}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display name */}
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
