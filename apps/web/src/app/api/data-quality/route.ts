import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES = [
  'stale_quote',
  'missing_bars',
  'delayed_quote',
  'provider_fallback',
  'cache_miss',
  'cache_hit',
  'data_gap',
  'api_error',
  'rate_limited',
] as const;

const VALID_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

// GET — list data quality events with filters
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventType = url.searchParams.get('event_type');
  const severity = url.searchParams.get('severity');
  const resolved = url.searchParams.get('resolved');
  const ticker = url.searchParams.get('ticker');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);

  let query = supabase
    .from('data_quality_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (eventType) query = query.eq('event_type', eventType);
  if (severity) query = query.eq('severity', severity);
  if (resolved === 'true') query = query.eq('resolved', true);
  if (resolved === 'false') query = query.eq('resolved', false);
  if (ticker) query = query.eq('ticker', ticker);

  const { data: events, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch events') },
      { status: 500 },
    );
  }

  // Compute summary stats
  const all = events ?? [];
  const unresolved = all.filter((e) => !e.resolved);
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const e of unresolved) {
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
  }

  return NextResponse.json({
    events: all,
    stats: {
      total: all.length,
      unresolved: unresolved.length,
      by_severity: bySeverity,
      by_type: byType,
    },
  });
}

// POST — record a new data quality event
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { event_type, severity, provider, ticker, message, metadata } = body;

  if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
    return NextResponse.json(
      { error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return NextResponse.json(
      { error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('data_quality_events')
    .insert({
      user_id: user.id,
      event_type,
      severity: severity ?? 'info',
      provider: provider ?? null,
      ticker: ticker ?? null,
      message,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create event') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — bulk resolve events
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ids, resolved } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  if (typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 });
  }

  const { error } = await supabase
    .from('data_quality_events')
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .in('id', ids)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to update events') },
      { status: 500 },
    );
  }

  return NextResponse.json({ updated: ids.length });
}
