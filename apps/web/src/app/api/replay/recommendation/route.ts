export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

/**
 * GET /api/replay/recommendation?ticker=AAPL&from=ISO&to=ISO&status=filled&limit=50
 *
 * Search agent_recommendations for the replay page.
 * Returns a compact list of matching recommendations for the picker.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const recId = searchParams.get('id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('agent_recommendations')
    .select(
      'id, ticker, side, quantity, order_type, strategy_name, signal_strength, status, reason, created_at, order_id',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (recId) {
    query = query.eq('id', recId);
  }
  if (ticker) {
    query = query.ilike('ticker', `%${ticker}%`);
  }
  if (from) {
    query = query.gte('created_at', new Date(from).toISOString());
  }
  if (to) {
    query = query.lte('created_at', new Date(to).toISOString());
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
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
