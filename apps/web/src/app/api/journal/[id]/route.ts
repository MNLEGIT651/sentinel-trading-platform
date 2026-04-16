import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { JournalEntry, JournalEntryUpdate } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_GRADES = ['excellent', 'good', 'neutral', 'bad', 'terrible'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Zod Schemas ────────────────────────────────────────────────────

const uuidField = z.string().regex(UUID_RE, 'Invalid UUID').nullable().optional();

const JournalUpdateSchema = z
  .object({
    user_notes: z.string().nullable().optional(),
    user_grade: z.enum(VALID_GRADES).nullable().optional(),
    outcome_pnl: z.number().nullable().optional(),
    outcome_return_pct: z.number().nullable().optional(),
    outcome_hold_minutes: z.number().nullable().optional(),
    order_id: uuidField,
    recommendation_id: uuidField,
    signal_id: uuidField,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'No valid fields to update',
  });

// ─── GET: Fetch a single journal entry ──────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const { data, error } = await supabase
      .from('decision_journal')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    return NextResponse.json(data as JournalEntry);
  } catch (error) {
    console.error('journal.[id].GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update annotations and outcome ──────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, JournalUpdateSchema);
    if (body instanceof NextResponse) return body;

    // Build update object with computed graded_at
    const update: Record<string, unknown> = { ...body };
    if ('user_grade' in body) {
      update.graded_at = body.user_grade !== null ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('decision_journal')
      .update(update as JournalEntryUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
    }

    return NextResponse.json(data as JournalEntry);
  } catch (error) {
    console.error('journal.[id].PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
