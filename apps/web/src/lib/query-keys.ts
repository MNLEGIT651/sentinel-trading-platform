/**
 * Centralized query key factory.
 *
 * Each namespace exposes `.all` (for bulk invalidation) and specific
 * sub-keys for granular cache control.
 */
export const queryKeys = {
  // ── Portfolio ────────────────────────────────────────────────────────
  portfolio: {
    all: ['portfolio'] as const,
    account: () => ['portfolio', 'account'] as const,
    positions: () => ['portfolio', 'positions'] as const,
    orders: {
      all: () => ['portfolio', 'orders'] as const,
      history: (limit?: number) => ['portfolio', 'orders', 'history', limit] as const,
      single: (id: string) => ['portfolio', 'orders', id] as const,
    },
  },

  // ── Market Data ──────────────────────────────────────────────────────
  data: {
    all: ['data'] as const,
    quotes: (tickers: string[]) => ['data', 'quotes', ...tickers.sort()] as const,
    bars: (ticker: string, timeframe: string, days?: number) =>
      ['data', 'bars', ticker, timeframe, days] as const,
  },

  // ── Agents ───────────────────────────────────────────────────────────
  agents: {
    all: ['agents'] as const,
    status: () => ['agents', 'status'] as const,
    recommendations: (status?: string) => ['agents', 'recommendations', status] as const,
    alerts: () => ['agents', 'alerts'] as const,
    riskPreview: (id: string) => ['agents', 'risk-preview', id] as const,
  },

  // ── Strategies ───────────────────────────────────────────────────────
  strategies: {
    all: ['strategies'] as const,
    list: () => ['strategies', 'list'] as const,
    scan: (tickers: string[], days: number) => ['strategies', 'scan', tickers, days] as const,
    health: {
      all: () => ['strategies', 'health'] as const,
      byName: (name: string) => ['strategies', 'health', name] as const,
    },
  },

  // ── Settings / Health ────────────────────────────────────────────────
  settings: {
    policy: () => ['settings', 'policy'] as const,
    serviceStatus: () => ['settings', 'service-status'] as const,
  },

  // ── Journal ──────────────────────────────────────────────────────────
  journal: {
    all: ['journal'] as const,
    entries: (filters?: object) => ['journal', 'entries', filters] as const,
    entry: (id: string) => ['journal', 'entry', id] as const,
    stats: () => ['journal', 'stats'] as const,
  },

  health: {
    all: ['health'] as const,
    engine: () => ['health', 'engine'] as const,
    agents: () => ['health', 'agents'] as const,
  },

  // ── Counterfactuals ─────────────────────────────────────────────────
  counterfactuals: {
    all: ['counterfactuals'] as const,
    list: (limit?: number, offset?: number) => ['counterfactuals', 'list', limit, offset] as const,
  },

  // ── Shadow Portfolios ─────────────────────────────────────────────
  shadowPortfolios: {
    all: ['shadow-portfolios'] as const,
    list: () => ['shadow-portfolios', 'list'] as const,
    detail: (id: string) => ['shadow-portfolios', 'detail', id] as const,
  },

  // ── Regime ──────────────────────────────────────────────────────────
  regime: {
    all: ['regime'] as const,
    state: () => ['regime', 'state'] as const,
    playbooks: () => ['regime', 'playbooks'] as const,
    playbook: (id: string) => ['regime', 'playbooks', id] as const,
  },

  // ── Data Quality ────────────────────────────────────────────────────
  dataQuality: {
    all: ['data-quality'] as const,
    list: (filters?: object) => ['data-quality', 'list', filters] as const,
  },

  // ── Replay / Incident Mode ────────────────────────────────────────
  replay: {
    all: ['replay'] as const,
    snapshot: (timestamp: string, window: number) =>
      ['replay', 'snapshot', timestamp, window] as const,
  },

  // ── Catalyst Overlay ─────────────────────────────────────────────
  catalysts: {
    all: ['catalysts'] as const,
    list: (filters?: object) => ['catalysts', 'list', filters] as const,
  },
} as const;
