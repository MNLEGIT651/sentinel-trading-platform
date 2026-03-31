export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

/**
 * GET /api/fills?order_id=UUID&limit=50&offset=0&from=ISO&to=ISO
 * Returns fill records, optionally filtered by order and date range.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

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
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const FillCreateSchema = z.object({
    order_id: z.string().min(1, 'order_id is required'),
    fill_price: z.number().positive('fill_price (positive number) is required'),
    fill_qty: z.number().positive('fill_qty (positive number) is required'),
    commission: z.number().optional(),
    slippage: z.number().nullable().optional(),
    venue: z.string().nullable().optional(),
    broker_fill_id: z.string().nullable().optional(),
  });

  const body = await parseBody(request, FillCreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await supabase
    .from('fills')
    .insert({
      order_id: body.order_id,
      fill_price: body.fill_price,
      fill_qty: body.fill_qty,
      commission: body.commission ?? 0,
      slippage: body.slippage ?? null,
      venue: body.venue ?? null,
      broker_fill_id: body.broker_fill_id ?? null,
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
