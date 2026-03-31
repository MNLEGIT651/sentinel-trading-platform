import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';
import { dbError, notFound } from '@/lib/api-error';

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

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

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

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const ThreadUpdateSchema = z
    .object({
      title: z.string().min(1).optional(),
      rolling_summary: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'No fields to update',
    });

  try {
    const body = await parseBody(req, ThreadUpdateSchema);
    if (body instanceof NextResponse) return body;
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.rolling_summary !== undefined) update.rolling_summary = body.rolling_summary;

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

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

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
