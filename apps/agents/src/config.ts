/**
 * Centralized runtime configuration for the agents service.
 *
 * All tuneable values live here so they can be changed without hunting
 * through orchestrator logic. Values are read at module load time and
 * can be overridden via environment variables where noted.
 */

// ─── Trading Universe ────────────────────────────────────────────────────────

/**
 * Default watchlist scanned by the Market Sentinel and Strategy Analyst on
 * every cycle. Override at runtime by passing custom prompts to the agent.
 */
export const WATCHLIST_TICKERS: readonly string[] = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'TSLA',
  'META',
  'SPY',
];

// ─── Cycle Timing ────────────────────────────────────────────────────────────

/**
 * Default interval between automated trading cycles in milliseconds.
 * Matches the Strategy Analyst cooldown so the fastest strategy repeating
 * agent does not fire more frequently than cycles occur.
 * Default: 15 minutes.
 */
export const DEFAULT_CYCLE_INTERVAL_MS = 15 * 60 * 1_000;

// ─── Agent Cooldowns ─────────────────────────────────────────────────────────

/** How often the Market Sentinel may run (5 minutes). */
export const MARKET_SENTINEL_COOLDOWN_MS = 5 * 60 * 1_000;

/** How often the Strategy Analyst may run (15 minutes). */
export const STRATEGY_ANALYST_COOLDOWN_MS = 15 * 60 * 1_000;

/** How often the Risk Monitor may run (1 minute). */
export const RISK_MONITOR_COOLDOWN_MS = 60 * 1_000;

/** How often the Research Analyst may run (30 minutes). */
export const RESEARCH_COOLDOWN_MS = 30 * 60 * 1_000;

/** How often the Execution Monitor may run (10 seconds). */
export const EXECUTION_MONITOR_COOLDOWN_MS = 10 * 1_000;

// ─── Agent Prompts ───────────────────────────────────────────────────────────

/**
 * Default system-level prompts injected into each agent at cycle start.
 * Defined here (not inside the orchestrator) so they can be audited,
 * versioned, and replaced without touching orchestration logic.
 */
export const DEFAULT_AGENT_PROMPTS: Readonly<Record<string, string>> = {
  market_sentinel: `Scan the current market conditions. Check prices for the watchlist tickers: ${WATCHLIST_TICKERS.join(', ')}. Report any significant movements, unusual volume, or market regime changes. Create alerts for anything noteworthy.`,

  strategy_analyst:
    'Run all available trading strategies against the watchlist tickers. Identify the top signals by conviction. For each signal, explain the setup and expected risk-reward. Only recommend trades with clear edge.',

  risk_monitor:
    'Assess the current portfolio risk. Check drawdown levels, position concentrations, and sector exposure. For any proposed trades from the strategy analyst, verify they pass all risk limits. Calculate appropriate position sizes.',

  execution_monitor:
    'Check for any open orders. If there are approved trades from this cycle that pass risk checks, prepare them for execution. Report on execution quality for any fills.',
};

// ─── GitHub Ops Commander ────────────────────────────────────────────────────

/**
 * GitHub repository slug used by the ops commander script and skill.
 * Can be overridden via GITHUB_REPO env var.
 */
export const GITHUB_REPO =
  process.env.GITHUB_REPO ?? 'MNLEGIT651/sentinel-trading-platform';

/**
 * Alert thresholds used by github-ops.ts. Centralised here so the skill
 * documentation and the script stay in sync.
 */
export const OPS_THRESHOLDS = {
  /** Days an open PR can go without review before triggering a WARN */
  PR_WARN_AGE_DAYS: 5,
  /** Days an open PR can go without review before triggering a FAIL */
  PR_FAIL_AGE_DAYS: 10,
  /** Days without issue activity before WARN */
  ISSUE_WARN_AGE_DAYS: 14,
  /** Days without issue activity before FAIL */
  ISSUE_FAIL_AGE_DAYS: 30,
  /** Fraction of recent CI runs failing to trigger WARN */
  CI_FAIL_RATE_WARN: 0.15,
  /** Fraction of recent CI runs failing to trigger FAIL */
  CI_FAIL_RATE_FAIL: 0.30,
} as const;
