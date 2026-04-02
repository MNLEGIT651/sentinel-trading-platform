'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getEmailRedirectUrl } from '@/lib/auth/url';
import { Button } from '@/components/ui/button';

const CURRENT_TERMS_VERSION = '1.0.0';
const CURRENT_PRIVACY_VERSION = '1.0.0';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function recordConsent(document_type: string, document_version: string) {
    try {
      await fetch('/api/onboarding/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type, document_version }),
      });
    } catch {
      // Consent recording is best-effort during signup;
      // the user can still proceed if the API call fails.
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    if (!acceptedTerms || !acceptedPrivacy) {
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Record consents after successful signup
      await Promise.all([
        recordConsent('terms_of_service', CURRENT_TERMS_VERSION),
        recordConsent('privacy_policy', CURRENT_PRIVACY_VERSION),
      ]);

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
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

  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account.
          </p>
          <p className="text-xs text-muted-foreground">
            The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
          </p>

          <div className="pt-2">
            {resendState === 'idle' && (
              <button
                onClick={handleResendConfirmation}
                className="text-sm font-medium text-primary hover:underline"
              >
                Didn&apos;t receive the email? Resend
              </button>
            )}
            {resendState === 'sending' && (
              <p className="text-sm text-muted-foreground">Resending…</p>
            )}
            {resendState === 'sent' && (
              <p className="text-sm text-green-600">✓ Confirmation email resent</p>
            )}
            {resendState === 'error' && (
              <p className="text-sm text-destructive">
                Could not resend.{' '}
                <button onClick={handleResendConfirmation} className="font-medium underline">
                  Try again
                </button>
              </p>
            )}
          </div>

          <a
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Sign up to start using the Sentinel trading platform
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
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
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span className="text-muted-foreground">
                I agree to the{' '}
                <a href="/legal/terms" className="font-medium text-primary hover:underline">
                  Terms of Service
                </a>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span className="text-muted-foreground">
                I agree to the{' '}
                <a href="/legal/privacy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !acceptedTerms || !acceptedPrivacy}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
