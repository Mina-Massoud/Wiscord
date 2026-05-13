import { useState } from 'react';
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
import { useSendMagicLink } from '@/queries/auth';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInPage(): React.JSX.Element {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const mutation = useSendMagicLink();

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: SignInValues): Promise<void> {
    try {
      await mutation.mutateAsync({ email: values.email });
      setSentTo(values.email);
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

  if (sentTo !== null) {
    return (
      <AuthLayout subtitle="Check your inbox">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-foreground text-xl font-semibold">Check your inbox</h1>
          <p className="text-muted-foreground text-sm">
            We sent a magic link to <span className="text-foreground font-medium">{sentTo}</span>.
            Click it to sign in.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSentTo(null);
              form.reset();
              mutation.reset();
            }}
          >
            Use a different email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const isPending = form.formState.isSubmitting || mutation.isPending;

  return (
    <AuthLayout subtitle="We'll email you a magic link to get back in.">
      <h1 className="text-foreground mb-6 text-center text-xl font-semibold">Sign in to Wiscord</h1>

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

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              'Send magic link'
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
