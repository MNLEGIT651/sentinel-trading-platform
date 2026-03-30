'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const FALLBACK_ERROR = {
  title: 'Something went wrong',
  message: 'An unexpected error occurred during authentication. Please try again.',
  recoverable: true,
} as const;

const ERROR_COPY: Record<string, { title: string; message: string; recoverable: boolean }> = {
  missing_params: {
    title: 'Invalid confirmation link',
    message:
      'The link you followed is missing required information. This can happen if the link was truncated by your email client.',
    recoverable: true,
  },
  code_exchange_failed: {
    title: 'Confirmation link expired or already used',
    message:
      'This confirmation link has expired or has already been used. Confirmation links are single-use and expire after 24 hours.',
    recoverable: true,
  },
  token_verification_failed: {
    title: 'Verification failed',
    message:
      'We could not verify your email with this link. It may have expired or already been used.',
    recoverable: true,
  },
  unknown: FALLBACK_ERROR,
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? 'unknown';
  const info = ERROR_COPY[reason] ?? FALLBACK_ERROR;

  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    if (!resendEmail) return;
    setResendState('sending');
    setResendError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
      });

      if (error) {
        setResendError(error.message);
        setResendState('error');
        return;
      }
      setResendState('sent');
    } catch {
      setResendError('Failed to resend. Please try again.');
      setResendState('error');
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
          <p className="text-sm text-muted-foreground">{info.message}</p>
        </div>

        {info.recoverable && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Resend confirmation email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                onClick={handleResend}
                disabled={!resendEmail || resendState === 'sending'}
                variant="outline"
                className="shrink-0"
              >
                {resendState === 'sending' ? 'Sending…' : 'Resend'}
              </Button>
            </div>

            {resendState === 'sent' && (
              <p className="text-sm text-green-600">✓ Confirmation email sent. Check your inbox.</p>
            )}
            {resendError && <p className="text-sm text-destructive">{resendError}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <a
            href="/login"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Go to sign in
          </a>
          <a href="/signup" className="inline-block text-sm text-muted-foreground hover:underline">
            Create a new account
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
