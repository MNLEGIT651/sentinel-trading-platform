import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { JournalStats } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const { data, error } = await supabase
      .from('journal_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch journal stats' }, { status: 500 });
    }

    // Return zero stats if no entries exist yet
    const stats: JournalStats = data ?? {
      total_entries: 0,
      approvals: 0,
      rejections: 0,
      fills: 0,
      risk_blocks: 0,
      graded: 0,
      avg_return_pct: null,
      winning_trades: 0,
      losing_trades: 0,
    };

    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
