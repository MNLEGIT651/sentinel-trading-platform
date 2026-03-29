import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Experiment, ExperimentUpdate } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ------------------------------------------------------------------ */
/*  GET /api/experiments/[id] — fetch a single experiment             */
/* ------------------------------------------------------------------ */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.from('experiments').select('*').eq('id', id).single();

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
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const allowed: (keyof ExperimentUpdate)[] = [
      'name',
      'description',
      'max_daily_trades',
      'max_position_value',
      'signal_strength_threshold',
      'max_total_exposure',
      'initial_capital',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || (updates.name as string).trim().length === 0) {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
      }
      updates.name = (updates.name as string).trim();
    }

    updates.updated_at = new Date().toISOString();

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('experiments')
      .update(updates)
      .eq('id', id)
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
