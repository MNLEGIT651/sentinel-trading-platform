import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { dbError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/memory-events
 * List memory audit trail, paginated and filterable by preference_id.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(req.url);
    const preferenceId = searchParams.get('preference_id');
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const offset = Number(searchParams.get('offset') ?? 0);

    let query = supabase
      .from('advisor_memory_events')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (preferenceId) query = query.eq('preference_id', preferenceId);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return dbError(error, 'Failed to list memory events');
    }

    return NextResponse.json({ events: data, total: count });
  } catch (err) {
    console.error('memory-events.GET', err);
    return dbError({ message: String(err) }, 'Failed to list memory events');
  }
}
