import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
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

const postBodySchema = z.object({
  event_type: z.enum(VALID_EVENT_TYPES),
  severity: z.enum(VALID_SEVERITIES).optional().default('info'),
  provider: z.string().nullish(),
  ticker: z.string().nullish(),
  message: z.string().min(1, 'message is required'),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const patchBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'ids array is required'),
  resolved: z.boolean({ message: 'resolved must be a boolean' }),
});

// GET ΓÇö list data quality events with filters
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

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

// POST ΓÇö record a new data quality event
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { event_type, severity, provider, ticker, message, metadata } = parsed;

  const { data, error } = await supabase
    .from('data_quality_events')
    .insert({
      user_id: user.id,
      event_type,
      severity,
      provider: provider ?? null,
      ticker: ticker ?? null,
      message,
      metadata,
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

// PATCH ΓÇö bulk resolve events
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, patchBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { ids, resolved } = parsed;

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
