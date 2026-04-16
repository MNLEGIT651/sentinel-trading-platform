export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

const VALID_SORT_FIELDS = new Set(['created_at', 'updated_at']);

/**
 * GET /api/workflows?workflow_type=X&status=Y&limit=50&offset=0&sort_by=created_at&sort_direction=desc
 * Returns workflow jobs with optional filters, sorting, and summary stats.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { searchParams } = request.nextUrl;
  const workflowType = searchParams.get('workflow_type');
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);
  const sortBy = searchParams.get('sort_by');
  const sortDirection = searchParams.get('sort_direction');

  const sortField = sortBy && VALID_SORT_FIELDS.has(sortBy) ? sortBy : 'created_at';
  const ascending = sortDirection === 'asc';

  let query = supabase
    .from('workflow_jobs')
    .select('*', { count: 'exact' })
    .order(sortField, { ascending })
    .range(offset, offset + limit - 1);

  if (workflowType) {
    query = query.eq('workflow_type', workflowType);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch workflows') },
      { status: 500 },
    );
  }

  // Fetch summary stats: status counts + completed_at/created_at for avg duration
  const { data: statsData } = await supabase
    .from('workflow_jobs')
    .select('status, created_at, completed_at');

  const total = statsData?.length ?? 0;
  const pending = statsData?.filter((j) => j.status === 'pending').length ?? 0;
  const running = statsData?.filter((j) => j.status === 'running').length ?? 0;
  const completed = statsData?.filter((j) => j.status === 'completed').length ?? 0;
  const failed = statsData?.filter((j) => j.status === 'failed').length ?? 0;
  const retrying = statsData?.filter((j) => j.status === 'retrying').length ?? 0;
  const cancelled = statsData?.filter((j) => j.status === 'cancelled').length ?? 0;

  // Compute average completion time for completed jobs
  let avgDurationMs: number | null = null;
  if (statsData) {
    const durations = statsData
      .filter((j) => j.status === 'completed' && j.completed_at && j.created_at)
      .map((j) => new Date(j.completed_at!).getTime() - new Date(j.created_at!).getTime())
      .filter((d) => d > 0);
    if (durations.length > 0) {
      avgDurationMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }

  // Failure rate: failed / (completed + failed) ΓÇö excludes pending/running
  const resolved = completed + failed;
  const failureRate = resolved > 0 ? Math.round((failed / resolved) * 10000) / 100 : null;

  const stats = {
    total,
    pending,
    running,
    completed,
    failed,
    retrying,
    cancelled,
    avg_duration_ms: avgDurationMs,
    failure_rate: failureRate,
  };

  return NextResponse.json({ data: data ?? [], total: count ?? 0, stats });
}
