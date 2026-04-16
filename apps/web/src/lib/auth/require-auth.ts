import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────

export type OperatorRole = 'observer' | 'reviewer' | 'approver' | 'operator';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
}

const UNAUTHORIZED = NextResponse.json(
  { error: 'unauthorized', message: 'Not authenticated' },
  { status: 401 },
);

const FORBIDDEN = (required: OperatorRole) =>
  NextResponse.json(
    { error: 'forbidden', message: `Requires ${required} role or higher` },
    { status: 403 },
  );

// ─── requireAuth ────────────────────────────────────────────────────

/**
 * Authenticate the current request via Supabase cookie-based JWT.
 *
 * Returns `{ user, supabase }` on success, or a `NextResponse` 401 on failure.
 * Usage:
 * ```ts
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth;
 * const { user, supabase } = auth;
 * ```
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return UNAUTHORIZED;
  return { user, supabase };
}

/**
 * Compatibility helper for mutation/read routes that need both auth + API rate limiting.
 *
 * Prefer this helper in new routes to avoid duplicated boilerplate:
 *   const auth = await requireAuthWithRateLimit();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAuthWithRateLimit(): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = await checkApiRateLimit(auth.user.id);
  if (rl) return rl;
  return auth;
}

// ─── requireRole ────────────────────────────────────────────────────

const ROLE_LEVELS: Record<OperatorRole, number> = {
  observer: 1,
  reviewer: 2,
  approver: 3,
  operator: 4,
};

/**
 * Authenticate and authorize the current request.
 *
 * Calls `requireAuth()` first, then checks the user's role in
 * `user_profiles` against the minimum required role level.
 */
export async function requireRole(minimumRole: OperatorRole): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { supabase, user } = auth;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Default to operator for solo-user setups (matches migration 00013 default)
  const role = (profile?.role as OperatorRole) ?? 'operator';
  const required = ROLE_LEVELS[minimumRole] ?? 4;
  const actual = ROLE_LEVELS[role] ?? 0;

  if (actual < required) return FORBIDDEN(minimumRole);

  return auth;
}
