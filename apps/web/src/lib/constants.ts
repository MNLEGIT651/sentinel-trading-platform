// ─── Ticker / Watchlist Data ────────────────────────────────────────────

export const TICKER_SYMBOLS: string[] = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'TSLA',
  'META',
  'SPY',
];

export const WATCHLIST_TICKERS = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'V', name: 'Visa Inc.' },
  { ticker: 'SPY', name: 'SPDR S&P 500' },
] as const;

// ─── Signal Defaults ────────────────────────────────────────────────────

export const MAX_LIVE_SCAN_TICKERS = 5;
export const DEFAULT_SIGNAL_TICKERS = 'AAPL,MSFT,GOOGL,AMZN,NVDA';

// ─── Timing Constants ───────────────────────────────────────────────────

/** Duration to show toast / success messages (ms) */
export const TOAST_DURATION = 2000;

/** Default polling interval for live data (ms) */
export const POLL_INTERVAL = 30_000;

// ─── Pagination ─────────────────────────────────────────────────────────

export const PAGE_SIZE_JOURNAL = 25;
export const PAGE_SIZE_AUDIT = 20;
export const PAGE_SIZE_ORDERS = 30;

// ─── Setup / Onboarding ─────────────────────────────────────────────────

export const SETUP_STEPS = [
  { id: 'connect-api', label: 'Connect API', alwaysComplete: true },
  { id: 'view-dashboard', label: 'View Dashboard', alwaysComplete: true },
  { id: 'run-scan', label: 'Run Signal Scan', storageKey: 'sentinel_visited_signals' },
  { id: 'review-portfolio', label: 'Review Portfolio', storageKey: 'sentinel_visited_portfolio' },
  {
    id: 'configure-strategy',
    label: 'Configure Strategy',
    storageKey: 'sentinel_visited_strategies',
  },
  { id: 'setup-alerts', label: 'Set Up Alerts', storageKey: 'sentinel_visited_alerts' },
  {
    id: 'customize-settings',
    label: 'Customize Settings',
    storageKey: 'sentinel_visited_settings',
  },
] as const;

export const TOTAL_SETUP_STEPS = SETUP_STEPS.length;

// ─── Order Constants ────────────────────────────────────────────────────

export const ORDER_TERMINAL_STATUSES = new Set(['filled', 'rejected', 'cancelled', 'expired']);

export const ORDER_STATUS_STEPS = ['pending', 'submitted', 'partial', 'filled'] as const;
