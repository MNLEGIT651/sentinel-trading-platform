import { NextRequest, NextResponse } from 'next/server';
import type { Experiment, ExperimentSnapshot, ExperimentOrder } from '@sentinel/shared';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

interface ReportSummary {
  total_snapshots: number;
  total_orders: number;
  orders_filled: number;
  orders_rejected: number;
  total_pnl: number;
  max_drawdown_pct: number;
  latest_equity: number | null;
  latest_sharpe: number | null;
  latest_win_rate: number | null;
}

function computeSummary(snapshots: ExperimentSnapshot[], orders: ExperimentOrder[]): ReportSummary {
  const filled = orders.filter((o) => o.status === 'filled').length;
  const rejected = orders.filter((o) => o.status === 'rejected').length;

  const last = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  let maxDrawdown = 0;
  let totalPnl = 0;
  for (const s of snapshots) {
    totalPnl += s.daily_pnl;
    if (s.max_drawdown_pct > maxDrawdown) {
      maxDrawdown = s.max_drawdown_pct;
    }
  }

  return {
    total_snapshots: snapshots.length,
    total_orders: orders.length,
    orders_filled: filled,
    orders_rejected: rejected,
    total_pnl: totalPnl,
    max_drawdown_pct: maxDrawdown,
    latest_equity: last?.equity ?? null,
    latest_sharpe: last?.sharpe_ratio ?? null,
    latest_win_rate: last?.win_rate ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  GET /api/experiments/[id]/report ΓÇö full experiment report         */
/* ------------------------------------------------------------------ */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid experiment id' }, { status: 400 });
    }

    // RLS enforces created_by = auth.uid() on experiments and scopes
    // snapshots/orders through experiment_id FK automatically
    const [experimentRes, snapshotsRes, ordersRes] = await Promise.all([
      supabase.from('experiments').select('*').eq('id', id).eq('created_by', user.id).single(),
      supabase
        .from('experiment_snapshots')
        .select('*')
        .eq('experiment_id', id)
        .order('snapshot_date', { ascending: true }),
      supabase
        .from('experiment_orders')
        .select('*')
        .eq('experiment_id', id)
        .order('submitted_at', { ascending: false }),
    ]);

    if (experimentRes.error) {
      if (experimentRes.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      console.error('experiments.[id].report experiment', experimentRes.error);
      return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }

    if (snapshotsRes.error) {
      console.error('experiments.[id].report snapshots', snapshotsRes.error);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    if (ordersRes.error) {
      console.error('experiments.[id].report orders', ordersRes.error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const snapshots = (snapshotsRes.data ?? []) as ExperimentSnapshot[];
    const orders = (ordersRes.data ?? []) as ExperimentOrder[];

    return NextResponse.json({
      experiment: experimentRes.data as Experiment,
      snapshots,
      orders,
      summary: computeSummary(snapshots, orders),
    });
  } catch (err) {
    console.error('experiments.[id].report', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
