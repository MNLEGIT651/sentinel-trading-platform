# Schema Patterns Reference

Exact SQL patterns extracted from Sentinel's migration files. Copy and adapt these — don't invent new conventions.

---

## Standard Table Template

```sql
CREATE TABLE my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- include for user-owned tables
  -- your columns here
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()              -- only if app code updates this
);
```

**Column type conventions:**

- Primary key: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Identity/serial (snapshots, metrics): `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- Foreign keys: `UUID NOT NULL REFERENCES other_table(id)`
- Optional FK: `UUID REFERENCES other_table(id)` (no NOT NULL)
- Cascading delete: `UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE`
- Money/prices: `NUMERIC(18,6)` for prices, `NUMERIC(18,2)` for dollar amounts
- Percentages/ratios: `NUMERIC(10,6)` for returns, `NUMERIC(8,4)` for ratios, `NUMERIC(5,4)` for 0–1 values
- Enumerations: `TEXT NOT NULL CHECK (col IN ('a', 'b', 'c'))` — no PostgreSQL enum types
- JSON data: `JSONB DEFAULT '{}'`
- Timestamps: `TIMESTAMPTZ DEFAULT now()`
- Counts: `INTEGER DEFAULT 0`
- Flags: `BOOLEAN DEFAULT false`
- Free text: `TEXT NOT NULL` or `TEXT` (nullable)

---

## RLS: User-Owned Table

For tables with a `user_id` column that should be private to each user:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_my_table" ON my_table
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Examples in production: `accounts`, `signals`, `orders`, `portfolio_positions`, `portfolio_snapshots`, `risk_metrics`, `alerts`, `watchlists`, `trades`.

---

## RLS: Shared Reference Table (Read-Only)

For tables that are global reference data — all authenticated users can read, only service role can write:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "my_table_read" ON my_table
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

Examples in production: `instruments`, `market_data`, `strategies`.

---

## RLS: No User Scoping (Internal/Log Tables)

For tables populated only by the service role (engine, agents), with no user column:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can access (RLS blocks anon + authenticated)
```

Example in production: `agent_logs` — no RLS policies, only service role writes.

---

## Indexes

Always index: foreign key columns, timestamp columns used for ordering, and status columns used in WHERE clauses.

```sql
-- FK + timestamp (most common pattern)
CREATE INDEX idx_my_table_user ON my_table (user_id, created_at DESC);

-- For ORDER BY timestamp DESC queries
CREATE INDEX idx_my_table_time ON my_table (timestamp DESC);

-- Partial index for filtered queries (e.g., only unacknowledged alerts)
CREATE INDEX idx_my_table_active ON my_table (status, created_at DESC) WHERE status = 'pending';

-- Composite for multi-column lookups
CREATE INDEX idx_my_table_instrument ON my_table (instrument_id, created_at DESC);
```

Naming convention: `idx_<table>_<field_or_purpose>`

---

## Realtime Subscription

Add new tables to the existing publication (do not create a new one):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE my_table;
```

Current Realtime tables: `signals`, `orders`, `alerts`, `portfolio_positions`, `market_data`.

---

## Views

The `portfolio_positions_live` view joins positions with latest market data to compute unrealized P&L. Follow this pattern for computed views:

```sql
CREATE OR REPLACE VIEW my_view AS
SELECT base.*,
  computed.value AS computed_column
FROM base_table base
LEFT JOIN LATERAL (
  SELECT value FROM source_table
  WHERE instrument_id = base.instrument_id
  ORDER BY timestamp DESC LIMIT 1
) computed ON true;
```

---

## Junction Tables (Many-to-Many)

```sql
CREATE TABLE table_a_table_b (
  table_a_id UUID NOT NULL REFERENCES table_a(id) ON DELETE CASCADE,
  table_b_id UUID NOT NULL REFERENCES table_b(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (table_a_id, table_b_id)
);

CREATE INDEX idx_table_a_table_b_b ON table_a_table_b (table_b_id);
```

Example in production: `watchlist_items`.

---

## Complete Example: Adding a New User-Owned Table

```sql
-- New table for user price alerts
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  trigger_price NUMERIC(18,6) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  message TEXT,
  is_triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_price_alerts_user ON price_alerts (user_id, created_at DESC);
CREATE INDEX idx_price_alerts_instrument ON price_alerts (instrument_id);
CREATE INDEX idx_price_alerts_active ON price_alerts (is_triggered, trigger_price) WHERE NOT is_triggered;

-- RLS
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_price_alerts" ON price_alerts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime (if web needs live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE price_alerts;
```
