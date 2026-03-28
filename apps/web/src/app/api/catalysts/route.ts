export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/catalysts?from=DATE&to=DATE&ticker=AAPL&type=earnings
 * POST /api/catalysts — create a custom catalyst event
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const ticker = searchParams.get('ticker');
  const eventType = searchParams.get('type');
  const impact = searchParams.get('impact');

  const supabase = await createServerSupabaseClient();

  let query = supabase.from('catalyst_events').select('*').order('event_date', { ascending: true });

  if (from) query = query.gte('event_date', from);
  if (to) query = query.lte('event_date', to);
  if (ticker) query = query.eq('ticker', ticker);
  if (eventType) query = query.eq('event_type', eventType);
  if (impact) query = query.eq('impact', impact);

  query = query.limit(200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group events by date for calendar view
  const byDate: Record<string, typeof data> = {};
  for (const event of data || []) {
    const date = event.event_date;
    const list = byDate[date];
    if (list) {
      list.push(event);
    } else {
      byDate[date] = [event];
    }
  }

  // Compute summary stats
  const types: Record<string, number> = {};
  const impacts: Record<string, number> = {};
  for (const event of data || []) {
    const t = event.event_type;
    types[t] = (types[t] || 0) + 1;
    const i = event.impact || 'medium';
    impacts[i] = (impacts[i] || 0) + 1;
  }

  return NextResponse.json({
    events: data || [],
    byDate,
    stats: {
      total: data?.length || 0,
      byType: types,
      byImpact: impacts,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const body = await request.json();
  const {
    event_type,
    ticker,
    sector,
    event_date,
    event_time,
    title,
    description,
    impact,
    eps_estimate,
    revenue_estimate,
    source,
    source_id,
    metadata,
  } = body;

  if (!event_type || !event_date || !title) {
    return NextResponse.json(
      { error: 'event_type, event_date, and title are required' },
      { status: 400 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('catalyst_events')
    .insert({
      event_type,
      ticker: ticker || null,
      sector: sector || null,
      event_date,
      event_time: event_time || null,
      title,
      description: description || null,
      impact: impact || 'medium',
      eps_estimate: eps_estimate || null,
      revenue_estimate: revenue_estimate || null,
      source: source || 'manual',
      source_id: source_id || null,
      metadata: metadata || {},
      user_id: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
