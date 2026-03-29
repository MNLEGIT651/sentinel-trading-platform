import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../logger.js';

interface ExperimentCaps {
  maxDailyTrades: number;
  maxPositionValue: number;
  signalStrengthThreshold: number;
  maxTotalExposure: number;
}

interface Recommendation {
  id: string;
  signal_strength?: number | null | undefined;
  quantity: number;
  price?: number | null | undefined;
  ticker: string;
}

interface EvaluationResult {
  allowed: boolean;
  reason: string;
  checks: {
    signalStrength: boolean;
    positionValue: boolean;
    dailyLimit: boolean;
    totalExposure: boolean;
  };
}

interface RecordExecutionParams {
  recommendationId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: string;
  brokerOrderId?: string | undefined;
  fillPrice?: number | undefined;
  fillQuantity?: number | undefined;
  status: string;
  riskCheckResult?: Record<string, unknown> | undefined;
}

export class BoundedExecutor {
  private experimentId: string;
  private caps: ExperimentCaps;

  constructor(experimentId: string, caps: ExperimentCaps) {
    this.experimentId = experimentId;
    this.caps = caps;
  }

  /** Evaluate whether a recommendation passes experiment-specific bounds. */
  async evaluate(recommendation: Recommendation): Promise<EvaluationResult> {
    const checks = {
      signalStrength: true,
      positionValue: true,
      dailyLimit: true,
      totalExposure: true,
    };
    const reasons: string[] = [];

    // 1. Signal strength check
    const strength = recommendation.signal_strength ?? 0;
    if (strength < this.caps.signalStrengthThreshold) {
      checks.signalStrength = false;
      reasons.push(
        `signal_strength ${strength.toFixed(2)} < threshold ${this.caps.signalStrengthThreshold.toFixed(2)}`,
      );
    }

    // 2. Position value check
    const estimatedPrice = recommendation.price ?? 0;
    const positionValue = recommendation.quantity * estimatedPrice;
    if (positionValue > this.caps.maxPositionValue) {
      checks.positionValue = false;
      reasons.push(
        `position_value $${positionValue.toFixed(2)} > max $${this.caps.maxPositionValue.toFixed(2)}`,
      );
    }

    // 3. Daily trade limit check
    const dailyCount = await this.getTodayOrderCount();
    if (dailyCount >= this.caps.maxDailyTrades) {
      checks.dailyLimit = false;
      reasons.push(`daily_trades ${dailyCount} >= max ${this.caps.maxDailyTrades}`);
    }

    // 4. Total exposure check
    const currentExposure = await this.getTotalExposure();
    const newExposure = currentExposure + positionValue;
    if (newExposure > this.caps.maxTotalExposure) {
      checks.totalExposure = false;
      reasons.push(
        `total_exposure $${newExposure.toFixed(2)} > max $${this.caps.maxTotalExposure.toFixed(2)}`,
      );
    }

    const allowed =
      checks.signalStrength && checks.positionValue && checks.dailyLimit && checks.totalExposure;

    const reason = allowed ? 'all checks passed' : reasons.join('; ');

    logger.info('bounded_executor.evaluate', {
      experimentId: this.experimentId,
      recommendationId: recommendation.id,
      ticker: recommendation.ticker,
      allowed,
      reason,
      checks,
    });

    return { allowed, reason, checks };
  }

  /** Record an executed order in the experiment_orders table. */
  async recordExecution(params: RecordExecutionParams): Promise<string> {
    const supabase = getSupabaseClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('experiment_orders')
      .insert({
        experiment_id: this.experimentId,
        recommendation_id: params.recommendationId,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        order_type: params.orderType,
        broker_order_id: params.brokerOrderId ?? null,
        fill_price: params.fillPrice ?? null,
        fill_quantity: params.fillQuantity ?? null,
        status: params.status,
        is_shadow: false,
        phase: 'week2_execution',
        risk_check_result: params.riskCheckResult ?? null,
        submitted_at: now,
        filled_at: params.fillPrice != null ? now : null,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('bounded_executor.record_execution.failed', {
        experimentId: this.experimentId,
        symbol: params.symbol,
        error: error.message,
      });
      throw new Error(`Failed to record execution: ${error.message}`);
    }

    logger.info('bounded_executor.record_execution.ok', {
      experimentId: this.experimentId,
      orderId: data.id,
      symbol: params.symbol,
      side: params.side,
      status: params.status,
    });

    return data.id as string;
  }

  /** Count today's experiment orders (non-shadow). */
  private async getTodayOrderCount(): Promise<number> {
    const supabase = getSupabaseClient();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('experiment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('experiment_id', this.experimentId)
      .eq('is_shadow', false)
      .gte('created_at', todayStart.toISOString());

    if (error) {
      logger.error('bounded_executor.daily_count.failed', {
        experimentId: this.experimentId,
        error: error.message,
      });
      // Conservative: assume limit reached on error
      return this.caps.maxDailyTrades;
    }

    return count ?? 0;
  }

  /** Calculate total exposure across all open (filled, non-shadow) positions. */
  private async getTotalExposure(): Promise<number> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('experiment_orders')
      .select('symbol, side, quantity, fill_price')
      .eq('experiment_id', this.experimentId)
      .eq('is_shadow', false)
      .eq('status', 'filled');

    if (error) {
      logger.error('bounded_executor.total_exposure.failed', {
        experimentId: this.experimentId,
        error: error.message,
      });
      // Conservative: assume max exposure on error
      return this.caps.maxTotalExposure;
    }

    if (!data || data.length === 0) return 0;

    // Aggregate net position per symbol, then sum absolute market values
    const positions = new Map<string, { netQty: number; lastPrice: number }>();

    for (const order of data) {
      const qty = Number(order.quantity);
      const price = Number(order.fill_price ?? 0);
      const pos = positions.get(order.symbol) ?? { netQty: 0, lastPrice: 0 };

      pos.netQty += order.side === 'buy' ? qty : -qty;
      if (price > 0) pos.lastPrice = price;

      positions.set(order.symbol, pos);
    }

    let totalExposure = 0;
    for (const pos of positions.values()) {
      totalExposure += Math.abs(pos.netQty) * pos.lastPrice;
    }

    return totalExposure;
  }
}
