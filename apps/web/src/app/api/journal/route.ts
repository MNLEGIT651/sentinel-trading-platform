import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { JournalEntryCreate, JournalEntry } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES = [
  'recommendation',
  'approval',
  'rejection',
  'fill',
  'risk_block',
  'cancellation',
  'policy_change',
  'manual_note',
] as const;

const VALID_GRADES = ['excellent', 'good', 'neutral', 'bad', 'terrible'] as const;

// ─── GET: List journal entries (paginated, filterable) ──────────────

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
    const eventType = url.searchParams.get('event_type');
    const ticker = url.searchParams.get('ticker');
    const grade = url.searchParams.get('grade');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let query = supabase
      .from('decision_journal')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType && VALID_EVENT_TYPES.includes(eventType as (typeof VALID_EVENT_TYPES)[number])) {
      query = query.eq('event_type', eventType);
    }
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    if (grade && VALID_GRADES.includes(grade as (typeof VALID_GRADES)[number])) {
      query = query.eq('user_grade', grade);
    }
    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch journal', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      entries: (data ?? []) as JournalEntry[],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a journal entry ──────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  try {
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

    const entry = body as Partial<JournalEntryCreate>;

    if (
      !entry.event_type ||
      !VALID_EVENT_TYPES.includes(entry.event_type as (typeof VALID_EVENT_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (
      entry.confidence !== undefined &&
      entry.confidence !== null &&
      (entry.confidence < 0 || entry.confidence > 1)
    ) {
      return NextResponse.json({ error: 'confidence must be between 0 and 1' }, { status: 400 });
    }

    if (
      entry.user_grade !== undefined &&
      entry.user_grade !== null &&
      !VALID_GRADES.includes(entry.user_grade as (typeof VALID_GRADES)[number])
    ) {
      return NextResponse.json(
        { error: `user_grade must be one of: ${VALID_GRADES.join(', ')}` },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('decision_journal')
      .insert({ ...entry, user_id: user.id })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create journal entry', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data as JournalEntry, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
