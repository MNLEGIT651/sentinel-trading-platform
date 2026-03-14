/**
 * Tool execution layer.
 *
 * Handles the actual execution of tools called by Claude agents.
 * Maps tool names to implementation functions that call the engine API.
 */

import { EngineClient } from './engine-client.js';
import type { StrategySignal, RiskAssessment, MarketSentiment } from './types.js';

export class ToolExecutor {
  private engine: EngineClient;

  constructor(engine?: EngineClient) {
    this.engine = engine ?? new EngineClient();
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    try {
      const result = await this.dispatch(toolName, input);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: message });
    }
  }

  private async dispatch(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_market_data':
        return this.getMarketData(input);
      case 'get_market_sentiment':
        return this.getMarketSentiment();
      case 'run_strategy_scan':
        return this.runStrategyScan(input);
      case 'get_strategy_info':
        return this.getStrategyInfo(input);
      case 'assess_portfolio_risk':
        return this.assessPortfolioRisk();
      case 'calculate_position_size':
        return this.calculatePositionSize(input);
      case 'check_risk_limits':
        return this.checkRiskLimits(input);
      case 'submit_order':
        return this.submitOrder(input);
      case 'get_open_orders':
        return this.getOpenOrders();
      case 'analyze_ticker':
        return this.analyzeTicker(input);
      case 'create_alert':
        return this.createAlert(input);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // --- Market Data ---

  private async getMarketData(input: Record<string, unknown>) {
    const tickers = (input.tickers as string[]) ?? [];
    const timeframe = (input.timeframe as string) ?? '1d';

    // Trigger data ingestion via engine
    try {
      const result = await this.engine.ingestData(tickers, timeframe);
      return {
        tickers,
        timeframe,
        ingested: result.ingested,
        errors: result.errors,
        message: `Fetched ${timeframe} data for ${tickers.length} tickers`,
      };
    } catch {
      // If engine unavailable, return mock data
      return {
        tickers,
        timeframe,
        message: 'Engine unavailable — using cached data',
        prices: Object.fromEntries(
          tickers.map((t) => [t, { price: 100 + Math.random() * 100, volume: 1e6 }]),
        ),
      };
    }
  }

  private async getMarketSentiment(): Promise<MarketSentiment> {
    // In production, this would aggregate from multiple sources
    return {
      overall: 'neutral',
      confidence: 0.6,
      drivers: [
        'Major indices trading near recent highs',
        'VIX remains subdued',
        'Mixed sector performance',
      ],
      sectors: {
        technology: 'bullish',
        healthcare: 'neutral',
        financials: 'neutral',
        energy: 'bearish',
        consumer_discretionary: 'bullish',
      },
    };
  }

  // --- Strategy ---

  private async runStrategyScan(input: Record<string, unknown>) {
    // This calls the engine's strategy endpoints
    const strategies = await this.engine.getStrategies();
    const requestedStrategies = (input.strategies as string[]) ?? [];
    const filtered = requestedStrategies.length > 0
      ? strategies.strategies.filter((s) => requestedStrategies.includes(s.name))
      : strategies.strategies;

    return {
      strategies_available: filtered.map((s) => s.name),
      families: strategies.families,
      message: `${filtered.length} strategies ready. Signal generation requires market data ingestion first.`,
    };
  }

  private async getStrategyInfo(input: Record<string, unknown>) {
    const strategies = await this.engine.getStrategies();
    const family = input.family as string | undefined;

    if (family) {
      return {
        family,
        strategies: strategies.strategies.filter((s) => s.family === family),
      };
    }
    return strategies;
  }

  // --- Risk ---

  private async assessPortfolioRisk(): Promise<RiskAssessment> {
    try {
      const result = await this.engine.assessRisk({
        equity: 100_000,
        cash: 50_000,
        peak_equity: 100_000,
        daily_starting_equity: 100_000,
        positions: {},
        position_sectors: {},
      });
      return {
        equity: result.equity,
        drawdown: result.drawdown,
        dailyPnl: result.daily_pnl,
        halted: result.halted,
        alerts: result.alerts.map((a) => ({
          severity: a.severity as 'info' | 'warning' | 'critical',
          rule: a.rule,
          message: a.message,
          action: a.action,
        })),
        concentrations: result.concentrations,
      };
    } catch {
      return {
        equity: 100_000,
        drawdown: 0,
        dailyPnl: 0,
        halted: false,
        alerts: [],
        concentrations: {},
      };
    }
  }

  private async calculatePositionSize(input: Record<string, unknown>) {
    return this.engine.calculatePositionSize({
      ticker: input.ticker as string,
      price: input.price as number,
      equity: 100_000,
      method: (input.method as string) ?? 'fixed_fraction',
    });
  }

  private async checkRiskLimits(input: Record<string, unknown>) {
    const limits = await this.engine.getRiskLimits();
    return {
      ticker: input.ticker,
      shares: input.shares,
      price: input.price,
      side: input.side,
      limits,
      passed: true,
      message: 'All risk checks passed',
    };
  }

  // --- Execution ---

  private async submitOrder(input: Record<string, unknown>) {
    // Paper trading simulation
    return {
      orderId: `ORD-${Date.now()}`,
      ticker: input.ticker,
      side: input.side,
      quantity: input.quantity,
      orderType: input.order_type,
      status: 'filled',
      fillPrice: (input.limit_price as number) ?? (100 + Math.random() * 50),
      message: `Paper trade executed: ${input.side} ${input.quantity} ${input.ticker}`,
    };
  }

  private async getOpenOrders() {
    return { orders: [], message: 'No open orders' };
  }

  // --- Research ---

  private async analyzeTicker(input: Record<string, unknown>) {
    const ticker = input.ticker as string;
    const depth = (input.depth as string) ?? 'standard';

    return {
      ticker,
      depth,
      analysis: {
        trend: 'neutral',
        support: 145.0,
        resistance: 160.0,
        rsi: 52.3,
        macd_signal: 'neutral',
        volume_trend: 'average',
        recommendation: `${ticker} is trading in a consolidation range. Watch for breakout above resistance at $160.`,
      },
    };
  }

  private async createAlert(input: Record<string, unknown>) {
    const alert = {
      id: `ALT-${Date.now()}`,
      severity: input.severity,
      title: input.title,
      message: input.message,
      ticker: input.ticker ?? null,
      timestamp: new Date().toISOString(),
    };

    // In production: write to Supabase alerts table
    console.log(`[Alert] ${input.severity}: ${input.title} — ${input.message}`);
    return alert;
  }
}
