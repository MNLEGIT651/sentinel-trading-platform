import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody, parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// GET /api/roles — list all user profiles or own profile
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

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch role history') },
      { status: 500 },
    );
  }

  const { data: history } = await supabase
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

  // Check requester is operator
  const { data: requesterProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const requesterRole = (requesterProfile?.role ?? 'operator') as OperatorRole;
  if (ROLE_LEVELS[requesterRole] < ROLE_LEVELS['operator']) {
    return NextResponse.json({ error: 'Only operators can change roles' }, { status: 403 });
  }

  // Get current role of target user
  const { data: targetProfile } = await supabase
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
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator');

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last operator' }, { status: 400 });
    }
  }

  // Update role
  const { error: updateError } = await supabase.from('user_profiles').upsert({
    id: targetUserId,
    role: newRole,
    updated_at: new Date().toISOString(),
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log the change
  await supabase.from('role_change_log').insert({
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
