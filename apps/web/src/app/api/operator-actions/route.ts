import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { OperatorActionType } from '@sentinel/shared';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTION_TYPES: OperatorActionType[] = [
  'halt_trading',
  'resume_trading',
  'approve_recommendation',
  'reject_recommendation',
  'update_policy',
  'change_mode',
  'override_risk',
  'cancel_order',
  'manual_order',
  'role_change',
  'system_config_change',
];

const postBodySchema = z.object({
  action_type: z.enum(VALID_ACTION_TYPES as [string, ...string[]]),
  target_type: z.string().optional(),
  target_id: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

/** GET /api/operator-actions ΓÇö list operator actions with optional filters */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);
  const actionType = searchParams.get('action_type');
  const operatorId = searchParams.get('operator_id');
  const targetType = searchParams.get('target_type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('operator_actions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType) {
    query = query.eq('action_type', actionType);
  }
  if (operatorId) {
    query = query.eq('operator_id', operatorId);
  }
  if (targetType) {
    query = query.eq('target_type', targetType);
  }
  if (from) {
    query = query.gte('created_at', from);
  }
  if (to) {
    query = query.lte('created_at', to);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch actions') },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}

/** POST /api/operator-actions ΓÇö record a new operator action */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { action_type, target_type, target_id, reason, metadata } = parsed;

  const { data, error } = await supabase
    .from('operator_actions')
    .insert({
      operator_id: user.id,
      action_type,
      target_type: target_type ?? null,
      target_id: target_id ?? null,
      reason: reason ?? null,
      metadata,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create action') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
