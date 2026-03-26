import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Supabase auth callback handler.
 * Handles email confirmation links and OAuth redirects by exchanging the
 * authorization code for a session, then redirecting to the dashboard.
 */
/**
 * Validate the `next` redirect target to prevent open-redirect attacks.
 * Only same-origin relative paths are allowed — protocol-relative URLs,
 * absolute URLs, and path-traversal tricks are rejected.
 */
function sanitizeRedirectPath(raw: string): string {
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('://') ||
    raw.includes('\\')
  ) {
    return '/';
  }
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next') ?? '/');

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login`);
}
