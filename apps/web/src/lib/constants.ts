import type { BrokerAccount } from '@/lib/engine-client';

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

export const FALLBACK_TICKER_DATA = [
  { ticker: 'AAPL', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', price: 141.8, change: -0.56 },
  { ticker: 'AMZN', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', price: 248.48, change: -2.15 },
  { ticker: 'META', price: 355.64, change: 0.45 },
  { ticker: 'SPY', price: 456.38, change: 0.62 },
] as const;

export const FALLBACK_PRICES = [
  178.72, 378.91, 141.8, 178.25, 495.22, 248.48, 355.64, 172.96, 261.53, 456.38,
] as const;

export const FALLBACK_CHANGES = [
  1.24, 0.82, -0.56, 1.89, 3.12, -2.15, 0.45, 0.33, 0.78, 0.62,
] as const;

// ─── Fallback Account ───────────────────────────────────────────────────

export const FALLBACK_ACCOUNT: BrokerAccount = {
  cash: 100_000,
  positions_value: 0,
  equity: 100_000,
  initial_capital: 100_000,
};

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
