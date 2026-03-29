import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

/** GET /api/operator-actions — list operator actions with optional filters */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

/** POST /api/operator-actions — record a new operator action */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    action_type?: string;
    target_type?: string | undefined;
    target_id?: string | undefined;
    reason?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action_type, target_type, target_id, reason, metadata } = body;

  if (!action_type) {
    return NextResponse.json({ error: 'action_type is required' }, { status: 400 });
  }

  if (!VALID_ACTION_TYPES.includes(action_type as OperatorActionType)) {
    return NextResponse.json(
      { error: `Invalid action_type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('operator_actions')
    .insert({
      operator_id: user.id,
      action_type,
      target_type: target_type ?? null,
      target_id: target_id ?? null,
      reason: reason ?? null,
      metadata: metadata ?? {},
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
