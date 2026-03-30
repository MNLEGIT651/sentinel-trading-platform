import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { dbError, badRequest, safeParseBody } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/threads
 * List user's threads sorted by last_activity DESC.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const offset = Number(searchParams.get('offset') ?? 0);

    const { data, error, count } = await supabase
      .from('advisor_threads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return dbError(error, 'Failed to list threads');
    }

    return NextResponse.json({ threads: data, total: count });
  } catch (err) {
    console.error('threads.GET', err);
    return dbError({ message: String(err) }, 'Failed to list threads');
  }
}

/**
 * POST /api/advisor/threads
 * Create a new conversation thread.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const body = await safeParseBody<{ title?: string }>(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body');
    }
    const title = body.title ?? 'New conversation';

    const { data, error } = await supabase
      .from('advisor_threads')
      .insert({ user_id: user.id, title })
      .select()
      .single();

    if (error) {
      return dbError(error, 'Failed to create thread');
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('threads.POST', err);
    return dbError({ message: String(err) }, 'Failed to create thread');
  }
}
