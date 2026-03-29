import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { JournalEntry, JournalEntryUpdate, TradeGrade } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_GRADES = ['excellent', 'good', 'neutral', 'bad', 'terrible'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET: Fetch a single journal entry ──────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update annotations and outcome ──────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if ('user_notes' in raw) {
      if (typeof raw.user_notes !== 'string' && raw.user_notes !== null) {
        return NextResponse.json({ error: 'user_notes must be a string or null' }, { status: 400 });
      }
      update.user_notes = raw.user_notes;
    }

    if ('user_grade' in raw) {
      if (
        raw.user_grade !== null &&
        !VALID_GRADES.includes(raw.user_grade as (typeof VALID_GRADES)[number])
      ) {
        return NextResponse.json(
          { error: `user_grade must be one of: ${VALID_GRADES.join(', ')}` },
          { status: 400 },
        );
      }
      update.user_grade = raw.user_grade as TradeGrade | null;
      update.graded_at = raw.user_grade !== null ? new Date().toISOString() : null;
    }

    if ('outcome_pnl' in raw) {
      if (typeof raw.outcome_pnl !== 'number' && raw.outcome_pnl !== null) {
        return NextResponse.json(
          { error: 'outcome_pnl must be a number or null' },
          { status: 400 },
        );
      }
      update.outcome_pnl = raw.outcome_pnl;
    }

    if ('outcome_return_pct' in raw) {
      if (typeof raw.outcome_return_pct !== 'number' && raw.outcome_return_pct !== null) {
        return NextResponse.json(
          { error: 'outcome_return_pct must be a number or null' },
          { status: 400 },
        );
      }
      update.outcome_return_pct = raw.outcome_return_pct;
    }

    if ('outcome_hold_minutes' in raw) {
      if (typeof raw.outcome_hold_minutes !== 'number' && raw.outcome_hold_minutes !== null) {
        return NextResponse.json(
          { error: 'outcome_hold_minutes must be a number or null' },
          { status: 400 },
        );
      }
      update.outcome_hold_minutes = raw.outcome_hold_minutes;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
