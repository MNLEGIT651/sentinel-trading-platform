export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

/**
 * GET /api/risk-evaluations?recommendation_id=UUID&limit=50&offset=0
 * Returns risk evaluations, optionally filtered by recommendation.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { searchParams } = request.nextUrl;
  const recommendationId = searchParams.get('recommendation_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

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
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch evaluations') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/risk-evaluations
 * Record a new risk evaluation for a recommendation.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const RiskEvalCreateSchema = z.object({
    recommendation_id: z.string().min(1, 'recommendation_id is required'),
    allowed: z.boolean({ error: 'allowed (boolean) is required' }),
    policy_version: z.string().nullable().optional(),
    original_quantity: z.number().nullable().optional(),
    adjusted_quantity: z.number().nullable().optional(),
    checks_performed: z.array(z.unknown()).optional(),
    reason: z.string().nullable().optional(),
  });

  const body = await parseBody(request, RiskEvalCreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await supabase
    .from('risk_evaluations')
    .insert({
      recommendation_id: body.recommendation_id,
      policy_version: body.policy_version ?? null,
      allowed: body.allowed,
      original_quantity: body.original_quantity ?? null,
      adjusted_quantity: body.adjusted_quantity ?? null,
      checks_performed: body.checks_performed ?? [],
      reason: body.reason ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create evaluation') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
