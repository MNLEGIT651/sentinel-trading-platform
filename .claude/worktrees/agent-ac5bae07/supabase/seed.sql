-- Default instruments (major US equities + ETFs)
INSERT INTO instruments (ticker, name, asset_class, exchange, sector) VALUES
  ('AAPL', 'Apple Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('MSFT', 'Microsoft Corporation', 'equity', 'NASDAQ', 'Technology'),
  ('GOOGL', 'Alphabet Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('AMZN', 'Amazon.com Inc.', 'equity', 'NASDAQ', 'Consumer Discretionary'),
  ('NVDA', 'NVIDIA Corporation', 'equity', 'NASDAQ', 'Technology'),
  ('META', 'Meta Platforms Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('TSLA', 'Tesla Inc.', 'equity', 'NASDAQ', 'Consumer Discretionary'),
  ('JPM', 'JPMorgan Chase & Co.', 'equity', 'NYSE', 'Financials'),
  ('V', 'Visa Inc.', 'equity', 'NYSE', 'Financials'),
  ('JNJ', 'Johnson & Johnson', 'equity', 'NYSE', 'Healthcare'),
  ('SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'NYSE', NULL),
  ('QQQ', 'Invesco QQQ Trust', 'etf', 'NASDAQ', NULL),
  ('IWM', 'iShares Russell 2000 ETF', 'etf', 'NYSE', NULL),
  ('TLT', 'iShares 20+ Year Treasury Bond ETF', 'etf', 'NASDAQ', NULL),
  ('GLD', 'SPDR Gold Shares', 'etf', 'NYSE', NULL),
  ('VIX', 'CBOE Volatility Index', 'etf', 'CBOE', NULL)
ON CONFLICT (ticker) DO NOTHING;

-- Default strategies
INSERT INTO strategies (name, family, description, parameters) VALUES
  ('Trend Following (Multi-Horizon)', 'trend', 'Time-series momentum with 1/3/12-month lookbacks and volatility scaling', '{"lookbacks": [21, 63, 252], "vol_window": 20, "vol_target": 0.15}'),
  ('Cross-Sectional Momentum', 'momentum', 'Rank by 3-12 month returns, buy winners / sell losers, skip recent month', '{"formation_months": 12, "skip_months": 1, "holding_months": 1, "top_pct": 0.2, "bottom_pct": 0.2}'),
  ('Value (Fundamental)', 'value', 'Buy cheap vs sell expensive based on valuation ratios', '{"metrics": ["pe_ratio", "pb_ratio", "ev_ebitda"], "rebalance_months": 3}'),
  ('Mean Reversion (RSI)', 'mean_reversion', 'Short-horizon reversal using RSI oversold/overbought', '{"rsi_period": 14, "oversold": 30, "overbought": 70, "holding_days": 5}'),
  ('Pairs Trading', 'pairs', 'Cointegration-based pairs with spread z-score entry/exit', '{"formation_days": 126, "entry_zscore": 2.0, "exit_zscore": 0.5, "stop_zscore": 4.0}'),
  ('Composite Signal', 'composite', 'Weighted combination of all active strategy signals', '{"weights": "inverse_volatility", "min_strategies": 2}')
ON CONFLICT (name) DO NOTHING;
