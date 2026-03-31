export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

const SearchQuery = z.object({
  id: z.string().uuid().optional(),
  ticker: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * GET /api/replay/recommendation?ticker=AAPL&from=ISO&to=ISO&status=filled&limit=50
 *
 * Search agent_recommendations for the replay page.
 * Returns a compact list of matching recommendations for the picker.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const params = parseSearchParams(request, SearchQuery);
  if (params instanceof NextResponse) return params;

  let query = supabase
    .from('agent_recommendations')
    .select(
      'id, ticker, side, quantity, order_type, strategy_name, signal_strength, status, reason, created_at, order_id',
    )
    .order('created_at', { ascending: false })
    .limit(params.limit);

  if (params.id) {
    query = query.eq('id', params.id);
  }
  if (params.ticker) {
    query = query.ilike('ticker', `%${params.ticker}%`);
  }
  if (params.from) {
    query = query.gte('created_at', new Date(params.from).toISOString());
  }
  if (params.to) {
    query = query.lte('created_at', new Date(params.to).toISOString());
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch recommendation') },
      { status: 500 },
    );
  }

  return NextResponse.json({ recommendations: data ?? [], total: data?.length ?? 0 });
}
