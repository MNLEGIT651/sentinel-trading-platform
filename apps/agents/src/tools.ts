/**
 * Tool definitions for Claude agent function calling.
 * Each agent has access to specific tools based on its role.
 */

import Anthropic from '@anthropic-ai/sdk';

// Tool parameter schemas using Anthropic's format
const TRADING_TOOL_DEFINITIONS: Anthropic.Tool[] = [
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

// GitHub Ops Tools — used by pr_manager and workflow_manager agents
const GITHUB_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'list_open_prs',
    description:
      'List all open pull requests in the repository. Returns number, title, author, age, review status, and draft flag for each PR.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pr_details',
    description:
      'Get detailed information about a specific pull request including body, review status, mergeable state, check results, and diff stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pr_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['pr_number'],
    },
  },
  {
    name: 'get_pr_checks',
    description:
      'Get the CI/CD check status for a specific pull request. Returns name, state, and description of each check.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pr_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['pr_number'],
    },
  },
  {
    name: 'audit_prs',
    description:
      'Run a full PR health audit. Identifies stale PRs (no review after threshold days), critical-age PRs, and produces a PASS/WARN/FAIL rating.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_workflows',
    description:
      'List all GitHub Actions workflows defined in the repository. Returns workflow id, name, file path, and active/disabled state.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_workflow_runs',
    description:
      'List recent GitHub Actions workflow runs. Returns run id, workflow name, status, conclusion, branch, and age.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of runs to return (default: 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_workflow_run_logs',
    description:
      'Get the failed-job logs for a specific workflow run. Useful for diagnosing CI failures.',
    input_schema: {
      type: 'object' as const,
      properties: {
        run_id: { type: 'number', description: 'Workflow run ID' },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'audit_ci',
    description:
      'Run a full CI health audit. Checks recent workflow run failure rates, main-branch failures, and produces a PASS/WARN/FAIL rating.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Combine all tool definitions
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  ...TRADING_TOOL_DEFINITIONS,
  ...GITHUB_TOOL_DEFINITIONS,
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
  pr_manager: ['list_open_prs', 'get_pr_details', 'get_pr_checks', 'audit_prs', 'create_alert'],
  workflow_manager: [
    'list_workflows',
    'list_workflow_runs',
    'get_workflow_run_logs',
    'audit_ci',
    'create_alert',
  ],
};

export function getToolsForAgent(role: string): Anthropic.Tool[] {
  const allowed = AGENT_TOOLS[role] ?? [];
  return TOOL_DEFINITIONS.filter((t) => allowed.includes(t.name));
}
