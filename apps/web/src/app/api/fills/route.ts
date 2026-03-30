export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * GET /api/fills?order_id=UUID&limit=50&offset=0&from=ISO&to=ISO
 * Returns fill records, optionally filtered by order and date range.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get('order_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('fills')
    .select('*', { count: 'exact' })
    .order('fill_ts', { ascending: false })
    .range(offset, offset + limit - 1);

  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  if (from) {
    query = query.gte('fill_ts', from);
  }
  if (to) {
    query = query.lte('fill_ts', to);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch fills') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/fills
 * Record a new fill for an order execution.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { order_id, fill_price, fill_qty, commission, slippage, venue, broker_fill_id } =
    body as Record<string, unknown>;

  if (!order_id || typeof order_id !== 'string') {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }

  if (typeof fill_price !== 'number' || fill_price <= 0) {
    return NextResponse.json(
      { error: 'fill_price (positive number) is required' },
      { status: 400 },
    );
  }

  if (typeof fill_qty !== 'number' || fill_qty <= 0) {
    return NextResponse.json({ error: 'fill_qty (positive number) is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fills')
    .insert({
      order_id,
      fill_price,
      fill_qty,
      commission: (commission as number) ?? 0,
      slippage: (slippage as number) ?? null,
      venue: (venue as string) ?? null,
      broker_fill_id: (broker_fill_id as string) ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to record fill') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
