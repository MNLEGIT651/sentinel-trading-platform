import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Experiment } from '@sentinel/shared';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/experiments/[id] — fetch a single experiment             */
/* ------------------------------------------------------------------ */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { id } = await params;

    const uuidSchema = z.string().uuid('Invalid experiment id');
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      console.error('experiments.[id].GET', error);
      return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }

    return NextResponse.json(data as Experiment);
  } catch (err) {
    console.error('experiments.[id].GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/experiments/[id] — update experiment fields            */
/*  Cannot update status (use halt / advance endpoints).              */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { id } = await params;

    const uuidSchema = z.string().uuid('Invalid experiment id');
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const ExperimentUpdateSchema = z
      .object({
        name: z.string().min(1, 'name must be a non-empty string').optional(),
        description: z.string().optional(),
        max_daily_trades: z.number().int().positive().optional(),
        max_position_value: z.number().positive().optional(),
        signal_strength_threshold: z.number().optional(),
        max_total_exposure: z.number().positive().optional(),
        initial_capital: z.number().positive().optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: 'No valid fields to update',
      });

    const body = await parseBody(req, ExperimentUpdateSchema);
    if (body instanceof NextResponse) return body;

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.max_daily_trades !== undefined) updates.max_daily_trades = body.max_daily_trades;
    if (body.max_position_value !== undefined) updates.max_position_value = body.max_position_value;
    if (body.signal_strength_threshold !== undefined)
      updates.signal_strength_threshold = body.signal_strength_threshold;
    if (body.max_total_exposure !== undefined) updates.max_total_exposure = body.max_total_exposure;
    if (body.initial_capital !== undefined) updates.initial_capital = body.initial_capital;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('experiments')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      console.error('experiments.[id].PATCH', error);
      return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
    }

    return NextResponse.json(data as Experiment);
  } catch (err) {
    console.error('experiments.[id].PATCH', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
