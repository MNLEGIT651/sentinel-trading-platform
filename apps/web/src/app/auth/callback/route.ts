import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Ensure the redirect target is a safe, same-origin path. */
function sanitizeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.includes('//') || next.includes('://') || next.includes('\\')) return '/';
  return next;
}

/**
 * Supabase auth callback handler.
 * Handles email confirmation links and OAuth redirects by exchanging the
 * authorization code for a session, then redirecting to the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const safePath = sanitizeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safePath}`);
    }
  }

  // If something went wrong, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
