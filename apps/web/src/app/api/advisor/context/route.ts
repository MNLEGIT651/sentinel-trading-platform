import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { dbError } from '@/lib/api-error';
import { buildAdvisorContext } from '@/lib/advisor-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/context
 * Build and return assembled advisor context (profile + preferences + thread).
 * Used by agents to construct LLM prompts.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('thread_id') ?? undefined;
    const maxMessages = searchParams.get('max_messages')
      ? Number(searchParams.get('max_messages'))
      : undefined;

    const opts: { threadId?: string; maxRecentMessages?: number } = {};
    if (threadId) opts.threadId = threadId;
    if (maxMessages) opts.maxRecentMessages = maxMessages;

    const context = await buildAdvisorContext(user.id, opts);

    return NextResponse.json(context);
  } catch (err) {
    console.error('context.GET', err);
    return dbError({ message: String(err) }, 'Failed to build advisor context');
  }
}
