import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

import AuthLayout from '@/components/auth/AuthLayout';
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
import { useSignIn, useSignUp } from '@/queries/auth';

type Mode = 'signin' | 'signup';

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type CredentialsValues = z.infer<typeof credentialsSchema>;

function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

const COPY: Record<Mode, { subtitle: string; heading: string; cta: string; switchPrompt: string; switchAction: string }> = {
  signin: {
    subtitle: 'Welcome back — pick up where you left off.',
    heading: 'Sign in to Wiscord',
    cta: 'Sign in',
    switchPrompt: 'New here?',
    switchAction: 'Create an account',
  },
  signup: {
    subtitle: 'A calmer place to study together.',
    heading: 'Create your account',
    cta: 'Create account',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
  },
};

export default function SignInPage(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('signin');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = safeRedirectPath(params.get('next'));

  const signIn = useSignIn();
  const signUp = useSignUp();

  const form = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: CredentialsValues): Promise<void> {
    const mutation = mode === 'signin' ? signIn : signUp;
    try {
      await mutation.mutateAsync(values);
      // Session cache is primed by the mutation's onSuccess; route guards at
      // the destination send the user onward to onboarding or the app.
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message =
        err !== null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Something went wrong. Please try again.';
      toast.error(message);
    }
  }

  function switchMode(): void {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    form.clearErrors();
    signIn.reset();
    signUp.reset();
  }

  const copy = COPY[mode];
  const isPending = form.formState.isSubmitting || signIn.isPending || signUp.isPending;

  return (
    <AuthLayout subtitle={copy.subtitle}>
      <h1 className="text-foreground mb-6 text-center text-xl font-semibold">{copy.heading}</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              copy.cta
            )}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {copy.switchPrompt}{' '}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 align-baseline"
          onClick={switchMode}
          disabled={isPending}
        >
          {copy.switchAction}
        </Button>
      </p>
    </AuthLayout>
  );
}
