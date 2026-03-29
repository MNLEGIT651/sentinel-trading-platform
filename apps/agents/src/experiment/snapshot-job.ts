import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../logger.js';

export class SnapshotJob {
  private experimentId: string;

  constructor(experimentId: string) {
    this.experimentId = experimentId;
  }

  /** Generate a snapshot for today (or a given date). Upserts on (experiment_id, snapshot_date). */
  async capture(date?: Date): Promise<void> {
    const snapshotDate = date ?? new Date();
    const dateStr = snapshotDate.toISOString().slice(0, 10);

    const supabase = getSupabaseClient();

    // 1. Fetch experiment to determine current phase
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('status, initial_capital')
      .eq('id', this.experimentId)
      .single();

    if (expError || !experiment) {
      logger.error('snapshot_job.capture.experiment_fetch_failed', {
        experimentId: this.experimentId,
        error: expError?.message,
      });
      return;
    }

    const phase = experiment.status as string;
    const initialCapital = Number(experiment.initial_capital);

    // 2. Count orders by status for this experiment
    const orderStats = await this.getOrderStats();

    // 3. Count recommendations linked to experiment orders
    const recoStats = await this.getRecommendationStats();

    // 4. Calculate equity from experiment orders
    const equityMetrics = await this.calculateEquity(initialCapital);

    // 5. Count cycles and errors from workflow_runs for the snapshot date
    const workflowStats = await this.getWorkflowStats(dateStr);

    // 6. Calculate derived metrics
    const dailyPnl = equityMetrics.equity - initialCapital;
    const cumulativePnl = dailyPnl;
    const dailyReturnPct = initialCapital > 0 ? (dailyPnl / initialCapital) * 100 : 0;
    const cumulativeReturnPct = dailyReturnPct;

    const tradeMetrics = await this.getTradeMetrics();

    // 7. Upsert snapshot
    const { error: upsertError } = await supabase.from('experiment_snapshots').upsert(
      {
        experiment_id: this.experimentId,
        snapshot_date: dateStr,
        phase,
        equity: equityMetrics.equity,
        cash: equityMetrics.cash,
        positions_value: equityMetrics.positionsValue,
        daily_pnl: dailyPnl,
        cumulative_pnl: cumulativePnl,
        daily_return_pct: dailyReturnPct,
        cumulative_return_pct: cumulativeReturnPct,
        max_drawdown_pct: equityMetrics.drawdownPct,
        recommendations_generated: recoStats.generated,
        recommendations_executed: recoStats.executed,
        recommendations_blocked: recoStats.blocked,
        orders_submitted: orderStats.submitted,
        orders_filled: orderStats.filled,
        orders_rejected: orderStats.rejected,
        win_rate: tradeMetrics.winRate,
        profit_factor: tradeMetrics.profitFactor,
        avg_trade_return: tradeMetrics.avgTradeReturn,
        cycle_count: workflowStats.cycleCount,
        error_count: workflowStats.errorCount,
        avg_cycle_duration_ms: workflowStats.avgDurationMs,
      },
      { onConflict: 'experiment_id,snapshot_date' },
    );

    if (upsertError) {
      logger.error('snapshot_job.capture.upsert_failed', {
        experimentId: this.experimentId,
        snapshotDate: dateStr,
        error: upsertError.message,
      });
      return;
    }

    logger.info('snapshot_job.capture.ok', {
      experimentId: this.experimentId,
      snapshotDate: dateStr,
      phase,
      equity: equityMetrics.equity,
      dailyPnl,
      ordersFilled: orderStats.filled,
    });
  }

  private async getOrderStats(): Promise<{
    submitted: number;
    filled: number;
    rejected: number;
  }> {
    const supabase = getSupabaseClient();

    const statuses = ['submitted', 'filled', 'rejected'] as const;
    const result = { submitted: 0, filled: 0, rejected: 0 };

    for (const status of statuses) {
      const { count, error } = await supabase
        .from('experiment_orders')
        .select('id', { count: 'exact', head: true })
        .eq('experiment_id', this.experimentId)
        .eq('status', status);

      if (error) {
        logger.warn('snapshot_job.order_stats.failed', {
          experimentId: this.experimentId,
          status,
          error: error.message,
        });
        continue;
      }

      result[status] = count ?? 0;
    }

    // Also count pending & partially_filled under submitted
    const { count: pendingCount } = await supabase
      .from('experiment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('experiment_id', this.experimentId)
      .eq('status', 'pending');

    result.submitted += pendingCount ?? 0;

    return result;
  }

  private async getRecommendationStats(): Promise<{
    generated: number;
    executed: number;
    blocked: number;
  }> {
    const supabase = getSupabaseClient();

    // Total distinct recommendations linked to experiment orders
    const { data: linkedOrders, error } = await supabase
      .from('experiment_orders')
      .select('recommendation_id, status')
      .eq('experiment_id', this.experimentId)
      .not('recommendation_id', 'is', null);

    if (error || !linkedOrders) {
      logger.warn('snapshot_job.reco_stats.failed', {
        experimentId: this.experimentId,
        error: error?.message,
      });
      return { generated: 0, executed: 0, blocked: 0 };
    }

    const recoIds = new Set(linkedOrders.map((o) => o.recommendation_id));
    const filledRecoIds = new Set(
      linkedOrders.filter((o) => o.status === 'filled').map((o) => o.recommendation_id),
    );
    const rejectedRecoIds = new Set(
      linkedOrders
        .filter((o) => o.status === 'rejected' || o.status === 'cancelled')
        .map((o) => o.recommendation_id),
    );

    return {
      generated: recoIds.size,
      executed: filledRecoIds.size,
      blocked: rejectedRecoIds.size,
    };
  }

  private async calculateEquity(initialCapital: number): Promise<{
    equity: number;
    cash: number;
    positionsValue: number;
    drawdownPct: number;
  }> {
    const supabase = getSupabaseClient();

    const { data: orders, error } = await supabase
      .from('experiment_orders')
      .select('symbol, side, quantity, fill_price, status')
      .eq('experiment_id', this.experimentId)
      .in('status', ['filled', 'partially_filled']);

    if (error) {
      logger.warn('snapshot_job.calc_equity.failed', {
        experimentId: this.experimentId,
        error: error.message,
      });
      return { equity: initialCapital, cash: initialCapital, positionsValue: 0, drawdownPct: 0 };
    }

    let cash = initialCapital;
    const positions = new Map<string, { netQty: number; lastPrice: number }>();

    for (const order of orders ?? []) {
      const price = Number(order.fill_price ?? 0);
      const qty = Number(order.quantity);

      if (order.side === 'buy') {
        cash -= qty * price;
      } else {
        cash += qty * price;
      }

      const pos = positions.get(order.symbol) ?? { netQty: 0, lastPrice: 0 };
      pos.netQty += order.side === 'buy' ? qty : -qty;
      if (price > 0) pos.lastPrice = price;
      positions.set(order.symbol, pos);
    }

    let positionsValue = 0;
    for (const pos of positions.values()) {
      positionsValue += Math.abs(pos.netQty) * pos.lastPrice;
    }

    const equity = cash + positionsValue;
    const drawdownPct =
      initialCapital > 0 ? Math.max(0, ((initialCapital - equity) / initialCapital) * 100) : 0;

    return { equity, cash, positionsValue, drawdownPct };
  }

  private async getWorkflowStats(
    dateStr: string,
  ): Promise<{ cycleCount: number; errorCount: number; avgDurationMs: number | null }> {
    const supabase = getSupabaseClient();

    const dayStart = `${dateStr}T00:00:00.000Z`;
    const dayEnd = `${dateStr}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('workflow_runs')
      .select('success, started_at, finished_at')
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd);

    if (error) {
      logger.warn('snapshot_job.workflow_stats.failed', {
        experimentId: this.experimentId,
        error: error.message,
      });
      return { cycleCount: 0, errorCount: 0, avgDurationMs: null };
    }

    if (!data || data.length === 0) {
      return { cycleCount: 0, errorCount: 0, avgDurationMs: null };
    }

    const cycleCount = data.length;
    const errorCount = data.filter((r) => !r.success).length;

    const durations: number[] = [];
    for (const run of data) {
      if (run.started_at && run.finished_at) {
        const ms =
          new Date(run.finished_at as string).getTime() -
          new Date(run.started_at as string).getTime();
        if (ms >= 0) durations.push(ms);
      }
    }

    const avgDurationMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    return { cycleCount, errorCount, avgDurationMs };
  }

  private async getTradeMetrics(): Promise<{
    winRate: number | null;
    profitFactor: number | null;
    avgTradeReturn: number | null;
  }> {
    const supabase = getSupabaseClient();

    // Get paired buy+sell trades to compute P&L per round trip
    const { data: orders, error } = await supabase
      .from('experiment_orders')
      .select('symbol, side, quantity, fill_price')
      .eq('experiment_id', this.experimentId)
      .eq('status', 'filled')
      .order('created_at', { ascending: true });

    if (error || !orders || orders.length < 2) {
      return { winRate: null, profitFactor: null, avgTradeReturn: null };
    }

    // Simple P&L: for each symbol, compare avg buy price vs avg sell price
    const symbolData = new Map<
      string,
      { buyQty: number; buyCost: number; sellQty: number; sellProceeds: number }
    >();

    for (const order of orders) {
      const price = Number(order.fill_price ?? 0);
      const qty = Number(order.quantity);
      const entry = symbolData.get(order.symbol) ?? {
        buyQty: 0,
        buyCost: 0,
        sellQty: 0,
        sellProceeds: 0,
      };

      if (order.side === 'buy') {
        entry.buyQty += qty;
        entry.buyCost += qty * price;
      } else {
        entry.sellQty += qty;
        entry.sellProceeds += qty * price;
      }

      symbolData.set(order.symbol, entry);
    }

    // Only consider symbols with both buys and sells (closed or partially closed)
    const pnlList: number[] = [];

    for (const entry of symbolData.values()) {
      const closedQty = Math.min(entry.buyQty, entry.sellQty);
      if (closedQty === 0) continue;

      const avgBuyPrice = entry.buyCost / entry.buyQty;
      const avgSellPrice = entry.sellProceeds / entry.sellQty;
      const pnl = (avgSellPrice - avgBuyPrice) * closedQty;
      pnlList.push(pnl);
    }

    if (pnlList.length === 0) {
      return { winRate: null, profitFactor: null, avgTradeReturn: null };
    }

    const wins = pnlList.filter((p) => p > 0);
    const losses = pnlList.filter((p) => p < 0);
    const winRate = (wins.length / pnlList.length) * 100;

    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgTradeReturn = pnlList.reduce((a, b) => a + b, 0) / pnlList.length;

    return {
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: profitFactor === Infinity ? null : Math.round(profitFactor * 100) / 100,
      avgTradeReturn: Math.round(avgTradeReturn * 100) / 100,
    };
  }
}
