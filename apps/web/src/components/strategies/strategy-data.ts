import type { StrategyEntry } from './strategy-card';

export interface StrategyFamily {
  family: string;
  strategies: StrategyEntry[];
}

export const strategyFamilies: StrategyFamily[] = [
  {
    family: 'trend_following',
    strategies: [
      {
        id: 'tf-sma-cross',
        name: 'SMA Crossover',
        description:
          'Generates signals when a fast simple moving average crosses above or below a slow simple moving average, indicating trend direction changes.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          fast_period: 20,
          slow_period: 50,
          signal_period: 9,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tf-ema-trend',
        name: 'EMA Trend Rider',
        description:
          'Uses exponential moving average slopes and price position relative to the EMA to identify and ride sustained trends.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          ema_period: 21,
          atr_multiplier: 2.0,
          min_slope: 0.001,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tf-breakout',
        name: 'Donchian Breakout',
        description:
          'Identifies breakouts from Donchian channel highs and lows, entering positions when price exceeds the channel range.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          channel_period: 20,
          exit_period: 10,
          volume_filter: true,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'momentum',
    strategies: [
      {
        id: 'mom-rsi',
        name: 'RSI Momentum',
        description:
          'Uses the Relative Strength Index to detect overbought and oversold conditions, entering positions on momentum extremes.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          rsi_period: 14,
          overbought: 70,
          oversold: 30,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mom-macd',
        name: 'MACD Divergence',
        description:
          'Detects divergences between MACD histogram and price action to identify potential momentum shifts before they occur.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          fast_period: 12,
          slow_period: 26,
          signal_period: 9,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'mean_reversion',
    strategies: [
      {
        id: 'mr-bollinger',
        name: 'Bollinger Band Reversion',
        description:
          'Enters positions when price touches or exceeds Bollinger Bands, expecting a reversion to the moving average center.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          period: 20,
          std_dev: 2.0,
          exit_at_mean: true,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mr-zscore',
        name: 'Z-Score Reversion',
        description:
          'Calculates the z-score of price relative to its historical distribution and enters positions at statistical extremes.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          lookback: 60,
          entry_threshold: 2.0,
          exit_threshold: 0.5,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'value',
    strategies: [
      {
        id: 'val-pe-rank',
        name: 'P/E Ratio Ranking',
        description:
          'Ranks stocks by price-to-earnings ratio within their sector, favoring undervalued securities with improving fundamentals.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          max_pe: 15,
          min_market_cap: 1000000000,
          sector_relative: true,
          rebalance_days: 30,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'pairs',
    strategies: [
      {
        id: 'pairs-cointegration',
        name: 'Cointegration Pairs',
        description:
          'Identifies cointegrated stock pairs and trades the spread when it deviates significantly from its historical equilibrium.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          lookback: 252,
          entry_zscore: 2.0,
          exit_zscore: 0.5,
          min_half_life: 5,
          max_half_life: 120,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];
