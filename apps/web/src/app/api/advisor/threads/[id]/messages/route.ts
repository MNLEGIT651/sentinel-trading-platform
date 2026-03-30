import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { dbError, badRequest, notFound, safeParseBody } from '@/lib/api-error';
import type { AdvisorMessageCreate } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/threads/[id]/messages
 * List messages in a thread (paginated, ascending by created_at).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    // Verify thread ownership
    const { data: thread } = await supabase
      .from('advisor_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single();

    if (!thread) {
      return notFound('Thread not found');
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
    const offset = Number(searchParams.get('offset') ?? 0);

    const { data, error, count } = await supabase
      .from('advisor_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return dbError(error, 'Failed to list messages');
    }

    return NextResponse.json({ messages: data, total: count });
  } catch (err) {
    console.error('messages.GET', err);
    return dbError({ message: String(err) }, 'Failed to list messages');
  }
}

/**
 * POST /api/advisor/threads/[id]/messages
 * Append a message to a thread. Updates thread.last_activity and message_count.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    // Verify thread ownership
    const { data: thread } = await supabase
      .from('advisor_threads')
      .select('id, message_count')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single();

    if (!thread) {
      return notFound('Thread not found');
    }

    const body = await safeParseBody<AdvisorMessageCreate>(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body');
    }

    if (!body.role || !body.content) {
      return badRequest('role and content are required');
    }

    // Insert message
    const { data: message, error: msgErr } = await supabase
      .from('advisor_messages')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: body.role,
        content: body.content,
        metadata: body.metadata ?? {},
      })
      .select()
      .single();

    if (msgErr) {
      return dbError(msgErr, 'Failed to create message');
    }

    // Update thread activity and message count
    await supabase
      .from('advisor_threads')
      .update({
        last_activity: new Date().toISOString(),
        message_count: (thread.message_count ?? 0) + 1,
      })
      .eq('id', threadId);

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error('messages.POST', err);
    return dbError({ message: String(err) }, 'Failed to create message');
  }
}
