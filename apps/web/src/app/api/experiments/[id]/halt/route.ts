import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Experiment } from '@sentinel/shared';
import { requireAuth } from '@/lib/auth/require-auth';

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
/*  POST /api/experiments/[id]/halt — halt an experiment              */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason: string | null = typeof body?.reason === 'string' ? body.reason.trim() : null;

    const sb = supabaseAdmin();

    // Fetch current experiment state
    const { data: experiment, error: fetchErr } = await sb
      .from('experiments')
      .select('id, status, halted')
      .eq('id', id)
      .single();

    if (fetchErr || !experiment) {
      if (fetchErr?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      console.error('experiments.[id].halt fetch', fetchErr);
      return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }

    const { status, halted } = experiment as Pick<Experiment, 'status' | 'halted'>;

    if (halted) {
      return NextResponse.json({ error: 'Experiment is already halted' }, { status: 400 });
    }

    if (status === 'completed' || status === 'aborted') {
      return NextResponse.json(
        { error: `Cannot halt an experiment with status "${status}"` },
        { status: 400 },
      );
    }

    const { data: updated, error: updateErr } = await sb
      .from('experiments')
      .update({
        halted: true,
        halt_reason: reason,
        halted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('experiments.[id].halt update', updateErr);
      return NextResponse.json({ error: 'Failed to halt experiment' }, { status: 500 });
    }

    return NextResponse.json(updated as Experiment);
  } catch (err) {
    console.error('experiments.[id].halt', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
