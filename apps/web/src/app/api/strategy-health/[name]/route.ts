import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * GET /api/strategy-health/[name]
 *
 * Returns recent health snapshots for a single strategy (time-series),
 * plus the latest snapshot. Useful for trend charts.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;

  // Fetch last 30 snapshots for this strategy (time-series for charts)
  const { data: history, error: historyError } = await supabase
    .from('strategy_health_snapshots')
    .select('*')
    .eq('strategy_name', name)
    .order('computed_at', { ascending: false })
    .limit(30);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  if (!history || history.length === 0) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  const latest = history[0];

  return NextResponse.json({
    strategy_name: name,
    latest,
    history,
  });
}
