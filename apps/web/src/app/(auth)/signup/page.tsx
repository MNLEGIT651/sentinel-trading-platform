'use client';

import { useState, useMemo, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getEmailRedirectUrl } from '@/lib/auth/url';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';

const CURRENT_TERMS_VERSION = '1.0.0';
const CURRENT_PRIVACY_VERSION = '1.0.0';

function getPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'text-loss', 'text-amber', 'text-profit', 'text-profit'];

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

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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
      <div className="space-y-5 text-center animate-sentinel-in">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account.
          </p>
          <p className="text-xs text-muted-foreground/70">
            The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
          </p>
        </div>

        <div className="pt-1">
          {resendState === 'idle' && (
            <button
              onClick={handleResendConfirmation}
              className="text-sm font-medium text-primary hover:underline"
            >
              Didn&apos;t receive the email? Resend
            </button>
          )}
          {resendState === 'sending' && <p className="text-sm text-muted-foreground">Resending…</p>}
          {resendState === 'sent' && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-profit">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmation email resent
            </p>
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

        <a href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-sentinel-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Sign up to start using the Sentinel trading platform
        </p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
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
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {password.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="strength-meter" data-strength={strength}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className={`text-[11px] font-medium ${STRENGTH_COLORS[strength]}`}>
                {STRENGTH_LABELS[strength]}
              </p>
            </div>
          )}
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
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-2.5 text-sm">
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

          <label className="flex items-start gap-2.5 text-sm">
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
  );
}
