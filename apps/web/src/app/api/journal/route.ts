import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody, parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { JournalEntry } from '@sentinel/shared';

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

// ─── Zod Schemas ────────────────────────────────────────────────────

const JournalQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  event_type: z.enum(VALID_EVENT_TYPES).optional(),
  ticker: z.string().optional(),
  grade: z.enum(VALID_GRADES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const JournalCreateSchema = z
  .object({
    event_type: z.enum(VALID_EVENT_TYPES),
    confidence: z.number().min(0).max(1).nullable().optional(),
    user_grade: z.enum(VALID_GRADES).nullable().optional(),
  })
  .passthrough();

// ─── GET: List journal entries (paginated, filterable) ──────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const params = parseSearchParams(request, JournalQuerySchema);
    if (params instanceof NextResponse) return params;

    let query = supabase
      .from('decision_journal')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.event_type) {
      query = query.eq('event_type', params.event_type);
    }
    if (params.ticker) {
      query = query.eq('ticker', params.ticker.toUpperCase());
    }
    if (params.grade) {
      query = query.eq('user_grade', params.grade);
    }
    if (params.from) {
      query = query.gte('created_at', params.from);
    }
    if (params.to) {
      query = query.lte('created_at', params.to);
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
      limit: params.limit,
      offset: params.offset,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a journal entry ──────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, JournalCreateSchema);
    if (body instanceof NextResponse) return body;

    const { data, error } = await supabase
      .from('decision_journal')
      .insert({ ...body, user_id: user.id })
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
