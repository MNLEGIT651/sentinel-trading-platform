import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { Experiment } from '@sentinel/shared';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ------------------------------------------------------------------ */
/*  GET /api/experiments ΓÇö list all experiments                       */
/* ------------------------------------------------------------------ */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from('experiments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('experiments.GET query', error);
      return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
    }

    return NextResponse.json(data as Experiment[]);
  } catch (err) {
    console.error('experiments.GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/experiments ΓÇö create a new experiment                   */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const ExperimentCreateSchema = z.object({
    name: z.string().min(1, 'name is required and must be a non-empty string'),
    description: z.string().optional(),
    max_daily_trades: z.number().int().positive().optional(),
    max_position_value: z.number().positive().optional(),
    signal_strength_threshold: z.number().optional(),
    max_total_exposure: z.number().positive().optional(),
    initial_capital: z.number().positive().optional(),
  });

  try {
    const body = await parseBody(request, ExperimentCreateSchema);
    if (body instanceof NextResponse) return body;

    const insert: Record<string, unknown> = {
      name: body.name.trim(),
      status: 'pending',
    };

    if (body.description !== undefined) insert.description = body.description;
    if (body.max_daily_trades !== undefined) insert.max_daily_trades = body.max_daily_trades;
    if (body.max_position_value !== undefined) insert.max_position_value = body.max_position_value;
    if (body.signal_strength_threshold !== undefined)
      insert.signal_strength_threshold = body.signal_strength_threshold;
    if (body.max_total_exposure !== undefined) insert.max_total_exposure = body.max_total_exposure;
    if (body.initial_capital !== undefined) insert.initial_capital = body.initial_capital;

    const sb = supabaseAdmin();
    const { data, error } = await sb.from('experiments').insert(insert).select().single();

    if (error) {
      console.error('experiments.POST insert', error);
      return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
    }

    return NextResponse.json(data as Experiment, { status: 201 });
  } catch (err) {
    console.error('experiments.POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
