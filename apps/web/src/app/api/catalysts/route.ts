export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

/**
 * GET /api/catalysts?from=DATE&to=DATE&ticker=AAPL&type=earnings
 * POST /api/catalysts ΓÇö create a custom catalyst event
 */

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const ticker = searchParams.get('ticker');
  const eventType = searchParams.get('type');
  const impact = searchParams.get('impact');

  let query = supabase
    .from('catalyst_events')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true });

  if (from) query = query.gte('event_date', from);
  if (to) query = query.lte('event_date', to);
  if (ticker) query = query.eq('ticker', ticker);
  if (eventType) query = query.eq('event_type', eventType);
  if (impact) query = query.eq('impact', impact);

  query = query.limit(200);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch catalysts') },
      { status: 500 },
    );
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
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const CatalystCreateSchema = z.object({
    event_type: z.string().min(1, 'event_type is required'),
    event_date: z.string().min(1, 'event_date is required'),
    title: z.string().min(1, 'title is required'),
    ticker: z.string().nullable().optional(),
    sector: z.string().nullable().optional(),
    event_time: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    impact: z.string().optional(),
    eps_estimate: z.number().nullable().optional(),
    revenue_estimate: z.number().nullable().optional(),
    source: z.string().optional(),
    source_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const body = await parseBody(request, CatalystCreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await supabase
    .from('catalyst_events')
    .insert({
      event_type: body.event_type,
      ticker: body.ticker || null,
      sector: body.sector || null,
      event_date: body.event_date,
      event_time: body.event_time || null,
      title: body.title,
      description: body.description || null,
      impact: body.impact || 'medium',
      eps_estimate: body.eps_estimate || null,
      revenue_estimate: body.revenue_estimate || null,
      source: body.source || 'manual',
      source_id: body.source_id || null,
      metadata: body.metadata || {},
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create catalyst') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
