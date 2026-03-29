import { NextRequest, NextResponse } from 'next/server';

import type { RecommendationEventType } from '@sentinel/shared';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_EVENT_TYPES: RecommendationEventType[] = [
  'created',
  'risk_checked',
  'risk_blocked',
  'pending_approval',
  'approved',
  'rejected',
  'submitted',
  'partially_filled',
  'filled',
  'cancelled',
  'failed',
  'reviewed',
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();

  const [recResult, eventsResult, riskResult, operatorActionsResult] = await Promise.all([
    supabase.from('agent_recommendations').select('*').eq('id', id).single(),
    supabase
      .from('recommendation_events')
      .select('*')
      .eq('recommendation_id', id)
      .order('event_ts', { ascending: true }),
    supabase.from('risk_evaluations').select('*').eq('recommendation_id', id),
    supabase
      .from('operator_actions')
      .select('*')
      .eq('target_type', 'recommendation')
      .eq('target_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (recResult.error) {
    return NextResponse.json(
      { error: recResult.error.message },
      { status: recResult.status === 406 ? 404 : 500 },
    );
  }

  // Fetch associated order + fills if the recommendation has an order_id
  let order = null;
  let fills: unknown[] = [];
  const orderId = recResult.data?.order_id;
  if (orderId) {
    const [orderResult, fillsResult] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase
        .from('fills')
        .select('*')
        .eq('order_id', orderId)
        .order('fill_ts', { ascending: true }),
    ]);
    order = orderResult.data ?? null;
    fills = fillsResult.data ?? [];
  }

  return NextResponse.json({
    recommendation: recResult.data,
    events: eventsResult.data ?? [],
    riskEvaluations: riskResult.data ?? [],
    order,
    fills,
    operatorActions: operatorActionsResult.data ?? [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let body: {
    event_type: string;
    actor_type?: string | undefined;
    actor_id?: string | undefined;
    payload?: Record<string, unknown> | undefined;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !body.event_type ||
    !ALLOWED_EVENT_TYPES.includes(body.event_type as RecommendationEventType)
  ) {
    return NextResponse.json(
      { error: `Invalid event_type. Allowed: ${ALLOWED_EVENT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('recommendation_events')
    .insert({
      recommendation_id: id,
      event_type: body.event_type,
      actor_type: body.actor_type ?? 'system',
      actor_id: body.actor_id ?? null,
      payload: body.payload ?? {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to record event') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
