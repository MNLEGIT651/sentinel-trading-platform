import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile?.role) {
    console.error(
      JSON.stringify({
        scope: 'auth',
        level: 'error',
        action: 'profile_lookup_failed',
        userId: user.id,
        minimumRole,
        message: error?.message ?? 'Missing user_profiles role',
      }),
    );
    return FORBIDDEN(minimumRole);
  }

  const role = profile.role as OperatorRole;
  if (!(role in ROLE_LEVELS)) {
    console.error(
      JSON.stringify({
        scope: 'auth',
        level: 'error',
        action: 'profile_role_invalid',
        userId: user.id,
        role,
      }),
    );
    return FORBIDDEN(minimumRole);
  }

  const required = ROLE_LEVELS[minimumRole] ?? 4;
  const actual = ROLE_LEVELS[role] ?? 0;

  if (actual < required) return FORBIDDEN(minimumRole);

  return auth;
}
