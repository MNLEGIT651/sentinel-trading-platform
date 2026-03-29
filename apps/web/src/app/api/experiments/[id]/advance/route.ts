import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Experiment, ExperimentStatus } from '@sentinel/shared';

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

/**
 * Build the update payload for advancing to the next phase.
 * Returns null when the transition is not allowed.
 */
function transitionPayload(current: ExperimentStatus, now: string): Record<string, unknown> | null {
  switch (current) {
    case 'pending':
      return { status: 'week1_shadow', week1_start: now };
    case 'week1_shadow':
      return { status: 'week2_execution', week1_end: now, week2_start: now };
    case 'week2_execution':
      return { status: 'completed', week2_end: now };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/experiments/[id]/advance — advance to the next phase    */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const resume = body?.resume === true;

    const sb = supabaseAdmin();

    // Fetch current state
    const { data: experiment, error: fetchErr } = await sb
      .from('experiments')
      .select('id, status, halted')
      .eq('id', id)
      .single();

    if (fetchErr || !experiment) {
      if (fetchErr?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      console.error('experiments.[id].advance fetch', fetchErr);
      return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }

    const { status, halted } = experiment as Pick<Experiment, 'status' | 'halted'>;

    // If halted, require explicit resume flag
    if (halted && !resume) {
      return NextResponse.json(
        {
          error: 'Experiment is halted. Pass { "resume": true } to clear the halt and advance.',
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const payload = transitionPayload(status, now);

    if (!payload) {
      return NextResponse.json(
        { error: `Cannot advance from status "${status}"` },
        { status: 400 },
      );
    }

    // Clear halt fields when advancing (whether resuming or not)
    payload.halted = false;
    payload.halt_reason = null;
    payload.halted_at = null;
    payload.updated_at = now;

    const { data: updated, error: updateErr } = await sb
      .from('experiments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('experiments.[id].advance update', updateErr);
      return NextResponse.json({ error: 'Failed to advance experiment' }, { status: 500 });
    }

    return NextResponse.json(updated as Experiment);
  } catch (err) {
    console.error('experiments.[id].advance', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
