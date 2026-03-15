/**
 * Tool definitions for Claude agent function calling.
 * Each agent has access to specific tools based on its role.
 */

import Anthropic from '@anthropic-ai/sdk';

// Tool parameter schemas using Anthropic's format
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // Market Data Tools
  {
    name: 'get_market_data',
    description:
      'Fetch current market data (prices, volume, indicators) for given tickers. Returns OHLCV data and basic technical indicators.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of ticker symbols (e.g., ["AAPL", "MSFT"])',
        },
        timeframe: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1h', '1d', '1w'],
          description: 'Data timeframe (default: 1d)',
        },
      },
      required: ['tickers'],
    },
  },
  {
    name: 'get_market_sentiment',
    description:
      'Analyze overall market sentiment based on breadth, volatility indices, and sector performance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_sectors: {
          type: 'boolean',
          description: 'Include per-sector analysis (default: true)',
        },
      },
      required: [],
    },
  },

  // Strategy Tools
  {
    name: 'run_strategy_scan',
    description: 'Run trading strategies against current market data and return generated signals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        strategies: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Strategy names to run (e.g., ["sma_crossover", "rsi_momentum"]). Empty = run all.',
        },
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tickers to scan. Empty = scan watchlist.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_strategy_info',
    description:
      'Get details about available trading strategies including parameters and families.',
    input_schema: {
      type: 'object' as const,
      properties: {
        family: {
          type: 'string',
          description: 'Filter by strategy family (e.g., "trend_following")',
        },
      },
      required: [],
    },
  },

  // Risk Tools
  {
    name: 'assess_portfolio_risk',
    description:
      'Run comprehensive risk assessment on current portfolio. Returns drawdown, concentration, and limit status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate_position_size',
    description: 'Calculate optimal position size for a proposed trade using risk-adjusted sizing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol' },
        price: { type: 'number', description: 'Current price' },
        method: {
          type: 'string',
          enum: ['fixed_fraction', 'volatility_target', 'kelly_criterion'],
          description: 'Sizing method',
        },
      },
      required: ['ticker', 'price'],
    },
  },
  {
    name: 'check_risk_limits',
    description: 'Check if a proposed trade passes all risk limits (position, sector, drawdown).',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        shares: { type: 'number' },
        price: { type: 'number' },
        side: { type: 'string', enum: ['buy', 'sell'] },
      },
      required: ['ticker', 'shares', 'price', 'side'],
    },
  },

  // Execution Tools
  {
    name: 'submit_order',
    description: 'Submit a trade order (paper or live based on broker mode).',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        side: { type: 'string', enum: ['buy', 'sell'] },
        quantity: { type: 'number' },
        order_type: { type: 'string', enum: ['market', 'limit'] },
        limit_price: { type: 'number', description: 'Required for limit orders' },
      },
      required: ['ticker', 'side', 'quantity', 'order_type'],
    },
  },
  {
    name: 'get_open_orders',
    description: 'Get all currently open/pending orders.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  // Research Tools
  {
    name: 'analyze_ticker',
    description:
      'Perform deep analysis on a specific ticker: technical setup, trend, support/resistance, volume profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol to analyze' },
        depth: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          description: 'Analysis depth level',
        },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'create_alert',
    description: 'Create a trading alert that will be shown on the dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        title: { type: 'string' },
        message: { type: 'string' },
        ticker: { type: 'string', description: 'Related ticker (optional)' },
      },
      required: ['severity', 'title', 'message'],
    },
  },
];

// Map agent roles to their available tools
export const AGENT_TOOLS: Record<string, string[]> = {
  market_sentinel: ['get_market_data', 'get_market_sentiment', 'create_alert'],
  strategy_analyst: [
    'run_strategy_scan',
    'get_strategy_info',
    'get_market_data',
    'analyze_ticker',
    'create_alert',
  ],
  risk_monitor: [
    'assess_portfolio_risk',
    'check_risk_limits',
    'calculate_position_size',
    'create_alert',
  ],
  research: ['analyze_ticker', 'get_market_data', 'get_market_sentiment', 'create_alert'],
  execution_monitor: [
    'submit_order',
    'get_open_orders',
    'check_risk_limits',
    'calculate_position_size',
    'create_alert',
  ],
};

export function getToolsForAgent(role: string): Anthropic.Tool[] {
  const allowed = AGENT_TOOLS[role] ?? [];
  return TOOL_DEFINITIONS.filter((t) => allowed.includes(t.name));
}
