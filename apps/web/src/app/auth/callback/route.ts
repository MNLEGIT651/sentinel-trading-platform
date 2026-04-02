import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sanitizeRedirectPath } from '@/lib/auth/url';

/**
 * Auth failure reason codes — used in URL params and logs.
 * Each code maps to user-facing copy on the auth-error page.
 */
type AuthFailureReason =
  | 'missing_params'
  | 'code_exchange_failed'
  | 'token_verification_failed'
  | 'unknown';

function buildErrorRedirect(origin: string, reason: AuthFailureReason): Response {
  return NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);
}

/**
 * Supabase auth callback handler.
 *
 * Handles two link formats Supabase may send:
 *
 * 1. **PKCE code exchange** (default for email confirmation):
 *    `/auth/callback?code=<code>&next=/`
 *
 * 2. **Token hash verification** (magic links, some email templates):
 *    `/auth/callback?token_hash=<hash>&type=email`
 *
 * Both patterns are supported to prevent user-facing failures if the
 * Supabase email template or auth config changes.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const safePath = sanitizeRedirectPath(searchParams.get('next'));

  // ── PKCE code exchange (primary path) ───────────────────────────────
  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safePath}`);
      }
      console.error('[auth/callback] code exchange failed:', {
        reason: error.message,
        status: error.status,
      });
      return buildErrorRedirect(origin, 'code_exchange_failed');
    } catch (err) {
      console.error('[auth/callback] unexpected error during code exchange:', err);
      return buildErrorRedirect(origin, 'code_exchange_failed');
    }
  }

  // ── Token hash verification (magic link / alternate email template) ─
  if (tokenHash && type) {
    const validTypes = ['email', 'recovery', 'email_change'] as const;
    type OtpType = (typeof validTypes)[number];
    const otpType: OtpType | undefined = validTypes.find((t) => t === type);
    if (!otpType) {
      console.warn('[auth/callback] invalid OTP type:', type);
      return buildErrorRedirect(origin, 'missing_params');
    }
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (!error) {
        // For recovery tokens, redirect to the reset-password page
        const redirectPath = otpType === 'recovery' ? '/reset-password' : safePath;
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
      console.error('[auth/callback] token verification failed:', {
        reason: error.message,
        status: error.status,
        type,
      });
      return buildErrorRedirect(origin, 'token_verification_failed');
    } catch (err) {
      console.error('[auth/callback] unexpected error during token verification:', err);
      return buildErrorRedirect(origin, 'token_verification_failed');
    }
  }

  // ── No valid params at all ──────────────────────────────────────────
  console.warn('[auth/callback] missing params:', {
    hasCode: !!code,
    hasTokenHash: !!tokenHash,
    hasType: !!type,
  });
  return buildErrorRedirect(origin, 'missing_params');
}
