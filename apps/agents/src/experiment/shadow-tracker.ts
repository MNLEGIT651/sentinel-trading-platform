import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../logger.js';

interface ShadowFillParams {
  recommendationId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  marketPrice: number;
  orderType?: string;
  riskCheckResult?: Record<string, unknown>;
}

interface ShadowPosition {
  quantity: number;
  avgPrice: number;
  side: string;
}

interface ShadowEquity {
  equity: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
}

export class ShadowTracker {
  private experimentId: string;

  constructor(experimentId: string) {
    this.experimentId = experimentId;
  }

  /** Record a shadow "fill" — what would have happened if this recommendation were executed. */
  async recordShadowFill(params: ShadowFillParams): Promise<string> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('experiment_orders')
      .insert({
        experiment_id: this.experimentId,
        recommendation_id: params.recommendationId,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        order_type: params.orderType ?? 'market',
        shadow_fill_price: params.marketPrice,
        fill_price: params.marketPrice,
        fill_quantity: params.quantity,
        is_shadow: true,
        phase: 'week1_shadow',
        status: 'filled',
        risk_check_result: params.riskCheckResult ?? null,
        submitted_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      logger.error('shadow_tracker.record_fill.failed', {
        experimentId: this.experimentId,
        symbol: params.symbol,
        error: error.message,
      });
      throw new Error(`Failed to record shadow fill: ${error.message}`);
    }

    logger.info('shadow_tracker.record_fill.ok', {
      experimentId: this.experimentId,
      orderId: data.id,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      marketPrice: params.marketPrice,
    });

    return data.id as string;
  }

  /** Get all shadow positions for this experiment (aggregate buys/sells per symbol). */
  async getShadowPositions(): Promise<Map<string, ShadowPosition>> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('experiment_orders')
      .select('symbol, side, quantity, fill_price')
      .eq('experiment_id', this.experimentId)
      .eq('is_shadow', true)
      .eq('status', 'filled');

    if (error) {
      logger.error('shadow_tracker.get_positions.failed', {
        experimentId: this.experimentId,
        error: error.message,
      });
      return new Map();
    }

    if (!data || data.length === 0) {
      return new Map();
    }

    const positions = new Map<
      string,
      { totalQty: number; totalCost: number; buyQty: number; sellQty: number }
    >();

    for (const order of data) {
      const entry = positions.get(order.symbol) ?? {
        totalQty: 0,
        totalCost: 0,
        buyQty: 0,
        sellQty: 0,
      };

      const price = Number(order.fill_price ?? 0);
      const qty = Number(order.quantity);

      if (order.side === 'buy') {
        entry.totalQty += qty;
        entry.totalCost += qty * price;
        entry.buyQty += qty;
      } else {
        entry.totalQty -= qty;
        entry.totalCost -= qty * price;
        entry.sellQty += qty;
      }

      positions.set(order.symbol, entry);
    }

    const result = new Map<string, ShadowPosition>();

    for (const [symbol, entry] of positions) {
      if (entry.totalQty === 0) continue;

      const side = entry.totalQty > 0 ? 'long' : 'short';
      const absQty = Math.abs(entry.totalQty);
      // Weighted average price: total cost / total bought quantity for longs
      const avgPrice =
        entry.buyQty > 0
          ? Math.abs(entry.totalCost) / (side === 'long' ? entry.buyQty : entry.sellQty)
          : 0;

      result.set(symbol, { quantity: absQty, avgPrice, side });
    }

    return result;
  }

  /** Calculate current shadow portfolio equity given current market prices. */
  async calculateShadowEquity(currentPrices: Map<string, number>): Promise<ShadowEquity> {
    const supabase = getSupabaseClient();

    // Fetch initial capital from the experiment
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('initial_capital')
      .eq('id', this.experimentId)
      .single();

    if (expError || !experiment) {
      logger.error('shadow_tracker.calc_equity.experiment_fetch_failed', {
        experimentId: this.experimentId,
        error: expError?.message,
      });
      return { equity: 0, cash: 0, positionsValue: 0, unrealizedPnl: 0 };
    }

    const initialCapital = Number(experiment.initial_capital);

    // Fetch all filled shadow orders
    const { data: orders, error: ordersError } = await supabase
      .from('experiment_orders')
      .select('symbol, side, quantity, fill_price')
      .eq('experiment_id', this.experimentId)
      .eq('is_shadow', true)
      .eq('status', 'filled');

    if (ordersError) {
      logger.error('shadow_tracker.calc_equity.orders_fetch_failed', {
        experimentId: this.experimentId,
        error: ordersError.message,
      });
      return { equity: initialCapital, cash: initialCapital, positionsValue: 0, unrealizedPnl: 0 };
    }

    // Calculate cash impact: buys reduce cash, sells increase cash
    let cash = initialCapital;
    const netPositions = new Map<string, { qty: number; costBasis: number }>();

    for (const order of orders ?? []) {
      const price = Number(order.fill_price ?? 0);
      const qty = Number(order.quantity);

      const pos = netPositions.get(order.symbol) ?? { qty: 0, costBasis: 0 };

      if (order.side === 'buy') {
        cash -= qty * price;
        pos.qty += qty;
        pos.costBasis += qty * price;
      } else {
        cash += qty * price;
        pos.qty -= qty;
        pos.costBasis -= qty * price;
      }

      netPositions.set(order.symbol, pos);
    }

    // Mark to market
    let positionsValue = 0;
    let costBasisTotal = 0;

    for (const [symbol, pos] of netPositions) {
      if (pos.qty === 0) continue;

      const currentPrice = currentPrices.get(symbol);
      if (currentPrice === undefined) {
        logger.warn('shadow_tracker.calc_equity.missing_price', {
          experimentId: this.experimentId,
          symbol,
        });
        // Fall back to cost basis for missing prices
        positionsValue += Math.abs(pos.costBasis);
        costBasisTotal += Math.abs(pos.costBasis);
        continue;
      }

      const marketValue = pos.qty * currentPrice;
      positionsValue += marketValue;
      costBasisTotal += Math.abs(pos.costBasis);
    }

    const equity = cash + positionsValue;
    const unrealizedPnl = positionsValue - costBasisTotal;

    logger.debug('shadow_tracker.calc_equity.ok', {
      experimentId: this.experimentId,
      equity,
      cash,
      positionsValue,
      unrealizedPnl,
    });

    return { equity, cash, positionsValue, unrealizedPnl };
  }
}
