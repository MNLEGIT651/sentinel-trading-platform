-- Indexes
CREATE INDEX idx_market_data_instrument_time ON market_data (instrument_id, timestamp DESC);
CREATE INDEX idx_market_data_timeframe ON market_data (timeframe, timestamp DESC);
CREATE INDEX idx_signals_instrument ON signals (instrument_id, generated_at DESC);
CREATE INDEX idx_signals_strategy ON signals (strategy_id, generated_at DESC);
CREATE INDEX idx_signals_active ON signals (is_active, generated_at DESC);
CREATE INDEX idx_orders_status ON orders (status, created_at DESC);
CREATE INDEX idx_orders_instrument ON orders (instrument_id, created_at DESC);
CREATE INDEX idx_alerts_unack ON alerts (acknowledged, created_at DESC) WHERE NOT acknowledged;
CREATE INDEX idx_portfolio_snapshots_time ON portfolio_snapshots (timestamp DESC);
CREATE INDEX idx_risk_metrics_time ON risk_metrics (timestamp DESC);
CREATE INDEX idx_agent_logs_agent ON agent_logs (agent_name, created_at DESC);
CREATE INDEX idx_trades_account ON trades (account_id, closed_at DESC);
CREATE INDEX idx_trades_strategy ON trades (strategy_id, closed_at DESC);
CREATE INDEX idx_watchlist_items_instrument ON watchlist_items (instrument_id);

-- RLS: User-scoped tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_accounts" ON accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_signals" ON signals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_orders" ON orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_positions" ON portfolio_positions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE risk_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_risk_metrics" ON risk_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_alerts" ON alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_watchlists" ON watchlists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trades" ON trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: Shared reference tables (read-only for authenticated)
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments_read" ON instruments FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_data_read" ON market_data FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies_read" ON strategies FOR SELECT USING (auth.role() = 'authenticated');

-- Live P&L view
CREATE OR REPLACE VIEW portfolio_positions_live AS
SELECT pp.*,
  md.close AS current_price,
  (md.close - pp.avg_entry_price) * pp.quantity * CASE pp.side WHEN 'long' THEN 1 ELSE -1 END AS unrealized_pnl,
  CASE WHEN pp.avg_entry_price > 0 THEN ((md.close - pp.avg_entry_price) / pp.avg_entry_price) * 100 * CASE pp.side WHEN 'long' THEN 1 ELSE -1 END ELSE 0 END AS unrealized_pnl_pct
FROM portfolio_positions pp
LEFT JOIN LATERAL (SELECT close FROM market_data WHERE instrument_id = pp.instrument_id AND timeframe = '1d' ORDER BY timestamp DESC LIMIT 1) md ON true;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE signals, orders, alerts, portfolio_positions, market_data;
