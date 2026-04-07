import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody, parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Service-role client that bypasses RLS — used only for operator admin queries */
function supabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing server Supabase configuration. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

type OperatorRole = 'observer' | 'reviewer' | 'approver' | 'operator';

const ROLE_LEVELS: Record<OperatorRole, number> = {
  observer: 1,
  reviewer: 2,
  approver: 3,
  operator: 4,
};

// ─── Zod Schemas ────────────────────────────────────────────────────────

const RolesQuerySchema = z.object({
  scope: z.enum(['all', 'me']).optional().default('all'),
});

const RoleUpdateSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  newRole: z.enum(['observer', 'reviewer', 'approver', 'operator']),
  reason: z.string().optional(),
});

// GET /api/roles — list own profile (scope=me) or all profiles (scope=all, operator only)
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const params = parseSearchParams(request, RolesQuerySchema);
  if (params instanceof NextResponse) return params;

  if (params.scope === 'me') {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        profile: {
          id: user.id,
          display_name: user.email,
          role: 'operator' as OperatorRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }
    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch roles') },
        { status: 500 },
      );
    }
    return NextResponse.json({ profile: data });
  }

  // scope=all requires operator role — verified via user's own profile
  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const callerRole = (callerProfile?.role ?? 'operator') as OperatorRole;
  if (ROLE_LEVELS[callerRole] < ROLE_LEVELS['operator']) {
    return NextResponse.json({ error: 'Only operators can list all profiles' }, { status: 403 });
  }

  // Use service_role to bypass RLS for legitimate operator admin query
  const admin = supabaseAdmin();

  const { data: profiles, error } = await admin
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch role history') },
      { status: 500 },
    );
  }

  const { data: history } = await admin
    .from('role_change_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    profiles: profiles ?? [],
    history: history ?? [],
    currentUserId: user.id,
  });
}

// PATCH /api/roles — update a user's role (operator only)
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const body = await parseBody(request, RoleUpdateSchema);
  if (body instanceof NextResponse) return body;

  const { targetUserId, newRole, reason } = body;

  // Check requester is operator (via user's own RLS-scoped client)
  const { data: requesterProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const requesterRole = (requesterProfile?.role ?? 'operator') as OperatorRole;
  if (ROLE_LEVELS[requesterRole] < ROLE_LEVELS['operator']) {
    return NextResponse.json({ error: 'Only operators can change roles' }, { status: 403 });
  }

  // Use service_role for cross-user operations (bypasses user-scoped RLS)
  const admin = supabaseAdmin();

  // Get current role of target user
  const { data: targetProfile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();

  const oldRole = (targetProfile?.role ?? 'operator') as OperatorRole;

  if (oldRole === newRole) {
    return NextResponse.json({ error: 'User already has this role' }, { status: 400 });
  }

  // Prevent removing the last operator
  if (targetUserId === user.id && newRole !== 'operator') {
    const { count } = await admin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator');

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last operator' }, { status: 400 });
    }
  }

  // Update role via admin client
  const { error: updateError } = await admin.from('user_profiles').upsert({
    id: targetUserId,
    role: newRole,
    updated_at: new Date().toISOString(),
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log the change
  await admin.from('role_change_log').insert({
    target_user_id: targetUserId,
    changed_by: user.id,
    old_role: oldRole,
    new_role: newRole,
    reason: reason ?? null,
  });

  return NextResponse.json({
    success: true,
    targetUserId,
    oldRole,
    newRole,
  });
}
