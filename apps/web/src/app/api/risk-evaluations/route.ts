export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/risk-evaluations?recommendation_id=UUID&limit=50&offset=0
 * Returns risk evaluations, optionally filtered by recommendation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const recommendationId = searchParams.get('recommendation_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('risk_evaluations')
    .select('*', { count: 'exact' })
    .order('evaluated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (recommendationId) {
    query = query.eq('recommendation_id', recommendationId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/risk-evaluations
 * Record a new risk evaluation for a recommendation.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    recommendation_id,
    policy_version,
    allowed,
    original_quantity,
    adjusted_quantity,
    checks_performed,
    reason,
  } = body as Record<string, unknown>;

  if (!recommendation_id || typeof recommendation_id !== 'string') {
    return NextResponse.json({ error: 'recommendation_id is required' }, { status: 400 });
  }

  if (typeof allowed !== 'boolean') {
    return NextResponse.json({ error: 'allowed (boolean) is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('risk_evaluations')
    .insert({
      recommendation_id,
      policy_version: (policy_version as string) ?? null,
      allowed,
      original_quantity: (original_quantity as number) ?? null,
      adjusted_quantity: (adjusted_quantity as number) ?? null,
      checks_performed: (checks_performed as unknown[]) ?? [],
      reason: (reason as string) ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
