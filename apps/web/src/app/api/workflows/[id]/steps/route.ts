import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const { data, error } = await supabase
    .from('workflow_step_log')
    .select('*')
    .eq('job_id', id)
    .order('executed_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch steps') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
