import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { Experiment, ExperimentStatus } from '@sentinel/shared';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
/*  POST /api/experiments/[id]/advance ΓÇö advance to the next phase    */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const AdvanceSchema = z.object({
    resume: z.boolean().optional(),
  });

  try {
    const { id } = await params;

    const uuidSchema = z.string().uuid('Invalid experiment id');
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const body = await parseBody(req, AdvanceSchema);
    if (body instanceof NextResponse) return body;
    const resume = body.resume === true;

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
