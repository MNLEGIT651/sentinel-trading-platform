import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/strategy-health
 *
 * Returns the latest health snapshot for each strategy from the
 * `strategy_health_latest` view. Optionally filter by health_label.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const label = searchParams.get('label');

  let query = supabase
    .from('strategy_health_latest' as 'strategy_health_snapshots')
    .select('*')
    .order('health_score', { ascending: false, nullsFirst: false });

  if (label) {
    query = query.eq('health_label', label);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch health data') },
      { status: 500 },
    );
  }

  return NextResponse.json({ snapshots: data ?? [] });
}
