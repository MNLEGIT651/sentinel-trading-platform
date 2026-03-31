export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';

/**
 * GET /api/replay/recommendation/[id]
 *
 * Full reconstruction of a recommendation lifecycle:
 * - Recommendation details
 * - Event timeline (recommendation_events)
 * - Risk evaluations
 * - Order + fills
 * - Operator actions
 * - Decision journal entries
 * - Market regime at time of recommendation
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const { id } = await params;

  // Phase 1: Fetch recommendation and related data in parallel
  const [recResult, eventsResult, riskResult, operatorActionsResult, journalResult] =
    await Promise.all([
      supabase.from('agent_recommendations').select('*').eq('id', id).single(),
      supabase
        .from('recommendation_events')
        .select('*')
        .eq('recommendation_id', id)
        .order('event_ts', { ascending: true }),
      supabase
        .from('risk_evaluations')
        .select('*')
        .eq('recommendation_id', id)
        .order('evaluated_at', { ascending: true }),
      supabase
        .from('operator_actions')
        .select('*')
        .eq('target_type', 'recommendation')
        .eq('target_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('decision_journal')
        .select('*')
        .eq('recommendation_id', id)
        .order('created_at', { ascending: true }),
    ]);

  if (recResult.error) {
    return NextResponse.json(
      { error: recResult.error.message },
      { status: recResult.status === 406 ? 404 : 500 },
    );
  }

  const rec = recResult.data;

  // Phase 2: Fetch order/fills if order exists, and market regime near recommendation time
  let order = null;
  let fills: unknown[] = [];
  const orderId = rec?.order_id;
  const recTime = rec?.created_at;

  const phase2Promises: Promise<unknown>[] = [];

  // Order + fills
  if (orderId) {
    phase2Promises.push(
      Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).single(),
        supabase
          .from('fills')
          .select('*')
          .eq('order_id', orderId)
          .order('fill_ts', { ascending: true }),
      ]).then(([orderRes, fillsRes]) => {
        order = orderRes.data ?? null;
        fills = fillsRes.data ?? [];
      }),
    );
  }

  // Market regime at time of recommendation
  let marketRegime = null;
  if (recTime) {
    phase2Promises.push(
      Promise.resolve(
        supabase
          .from('market_regime_history')
          .select('*')
          .lte('detected_at', recTime)
          .order('detected_at', { ascending: false })
          .limit(1),
      ).then((res) => {
        marketRegime = res.data?.[0] ?? null;
      }),
    );
  }

  await Promise.all(phase2Promises);

  // Build the outcome summary
  const journalEntries = journalResult.data ?? [];
  const graded = journalEntries.find(
    (j: Record<string, unknown>) => j.user_grade != null || j.outcome_pnl != null,
  );

  const outcome: Record<string, unknown> = {
    status: rec.status,
    pnl: graded?.outcome_pnl ?? null,
    return_pct: graded?.outcome_return_pct ?? null,
    hold_minutes: graded?.outcome_hold_minutes ?? null,
    grade: graded?.user_grade ?? null,
    graded_at: graded?.graded_at ?? null,
  };

  // If filled, compute slippage from fills
  if (fills.length > 0) {
    const totalSlippage = (fills as Array<Record<string, unknown>>).reduce(
      (sum, f) => sum + (Number(f.slippage) || 0),
      0,
    );
    outcome.total_slippage = totalSlippage;
    outcome.fill_count = fills.length;
    const avgFillPrice =
      (fills as Array<Record<string, unknown>>).reduce(
        (sum, f) => sum + Number(f.fill_price) * Number(f.fill_qty),
        0,
      ) / (fills as Array<Record<string, unknown>>).reduce((sum, f) => sum + Number(f.fill_qty), 0);
    outcome.avg_fill_price = isFinite(avgFillPrice) ? avgFillPrice : null;
  }

  return NextResponse.json({
    recommendation: rec,
    events: eventsResult.data ?? [],
    riskEvaluations: riskResult.data ?? [],
    order,
    fills,
    operatorActions: operatorActionsResult.data ?? [],
    journalEntries,
    marketRegime,
    outcome,
  });
}
