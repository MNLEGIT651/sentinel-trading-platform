import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { dbError, badRequest, notFound, safeParseBody } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/threads/[id]
 * Get a single thread detail.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const { data, error } = await supabase
      .from('advisor_threads')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return notFound('Thread not found');
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('threads/[id].GET', err);
    return dbError({ message: String(err) }, 'Failed to fetch thread');
  }
}

/**
 * PATCH /api/advisor/threads/[id]
 * Update thread title or rolling_summary.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const body = await safeParseBody<{ title?: string; rolling_summary?: string }>(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body');
    }
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.rolling_summary !== undefined) update.rolling_summary = body.rolling_summary;

    if (Object.keys(update).length === 0) {
      return badRequest('No fields to update');
    }

    const { data, error } = await supabase
      .from('advisor_threads')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) {
      return notFound('Thread not found');
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('threads/[id].PATCH', err);
    return dbError({ message: String(err) }, 'Failed to update thread');
  }
}

/**
 * DELETE /api/advisor/threads/[id]
 * Delete a thread (cascades to messages).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const { error } = await supabase
      .from('advisor_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return dbError(error, 'Failed to delete thread');
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('threads/[id].DELETE', err);
    return dbError({ message: String(err) }, 'Failed to delete thread');
  }
}
