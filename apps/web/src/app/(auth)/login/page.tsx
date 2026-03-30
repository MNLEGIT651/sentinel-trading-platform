'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/** Maps URL error params from callback/middleware to user-facing messages. */
const URL_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed:
    'We could not complete your sign-in. The link may have expired or already been used.',
  session_expired: 'Your session has expired. Please sign in again.',
  unauthorized: 'You must be signed in to access that page.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Supabase returns this for unconfirmed email accounts
        if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setUnconfirmedEmail(true);
          setError('Your email address has not been confirmed yet.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      setError('Enter your email address above, then click resend.');
      return;
    }
    setResendState('sending');
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) {
        setResendState('error');
        return;
      }
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  }

  const urlErrorMessage = urlError ? URL_ERROR_MESSAGES[urlError] : null;

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      {urlErrorMessage && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {urlErrorMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {unconfirmedEmail && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          {resendState === 'idle' && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              className="text-sm font-medium text-primary hover:underline"
            >
              Resend confirmation email
            </button>
          )}
          {resendState === 'sending' && <p className="text-sm text-muted-foreground">Resending…</p>}
          {resendState === 'sent' && (
            <p className="text-sm text-green-600">✓ Confirmation email resent. Check your inbox.</p>
          )}
          {resendState === 'error' && (
            <p className="text-sm text-destructive">
              Could not resend.{' '}
              <button type="button" onClick={handleResendConfirmation} className="underline">
                Try again
              </button>
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Forgot password?
          </a>
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to Sentinel</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the trading platform
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
