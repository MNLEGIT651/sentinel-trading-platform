import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { RecommendationEventType } from '@sentinel/shared';

import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
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

const postBodySchema = z.object({
  event_type: z.enum(ALLOWED_EVENT_TYPES as [string, ...string[]]),
  actor_type: z.string().optional().default('system'),
  actor_id: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { data, error } = await supabase
    .from('recommendation_events')
    .insert({
      recommendation_id: id,
      event_type: parsed.event_type,
      actor_type: parsed.actor_type,
      actor_id: parsed.actor_id ?? null,
      payload: parsed.payload,
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
