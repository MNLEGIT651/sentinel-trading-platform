import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/autonomy/activity
 *
 * Returns recent auto-execution events (auto_approved, auto_execution_denied)
 * joined with recommendation tickers for the activity feed.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('recommendation_events')
    .select(
      `
      id,
      recommendation_id,
      event_type,
      event_ts,
      actor_type,
      actor_id,
      payload,
      created_at,
      agent_recommendations!inner(ticker)
    `,
    )
    .in('event_type', ['auto_approved', 'auto_execution_denied'])
    .order('event_ts', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((row) => {
    const rec = row.agent_recommendations as unknown as { ticker: string } | null;
    return {
      id: row.id,
      recommendation_id: row.recommendation_id,
      event_type: row.event_type,
      event_ts: row.event_ts,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      payload: row.payload,
      created_at: row.created_at,
      ticker: rec?.ticker ?? 'Unknown',
    };
  });

  return NextResponse.json({ data: events });
}
