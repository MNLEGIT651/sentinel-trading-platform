---
name: sentinel-migration
description: This skill should be used when the user asks to "add a table", "create a migration", "database migration", "new column", "update the schema", "Supabase migration", "add a foreign key", "alter a table", or any time a database schema change is needed for the Sentinel trading platform. Always apply this skill when touching supabase/migrations/ or when a feature requires persisting new data.
---

# Sentinel Migration Workflow

Sentinel uses Supabase (PostgreSQL) with a 21-table schema covering accounts, instruments, market data, signals, orders, positions, trades, backtests, risk metrics, agent logs, alerts, and watchlists. Every schema change goes through a versioned migration file. Skipping any step in the workflow (RLS, indexes, TS types) causes silent failures or security holes.

## Migration File Naming

Files live in `supabase/migrations/` with 5-digit zero-padded sequence numbers:

```
00001_initial_schema.sql
00002_indexes_rls_realtime.sql
00003_agent_tables.sql
00004_your_change.sql   ← next
```

Use the scaffold script to get the next number automatically:

```bash
python .claude/skills/sentinel-migration/scripts/new-migration.py add_watchlist_alerts
# → creates supabase/migrations/00004_add_watchlist_alerts.sql
```

## Core Workflow

Work through these steps in order — each depends on the previous:

1. **Scaffold** — Run `new-migration.py <description>` to create the numbered file
2. **Write SQL** — Fill in the migration (see `references/schema-patterns.md` for patterns)
3. **Apply** — Push to Supabase:
   - Local dev: `npx supabase db push`
   - Via Supabase MCP: use `apply_migration` tool with the SQL content
4. **Generate TypeScript types**:
   ```bash
   npx supabase gen types typescript --local > packages/shared/src/types/database.types.ts
   ```
5. **Export new types** — If new domain types were added, export them from `packages/shared/src/types/index.ts`
6. **Verify** — Run engine tests: `.venv/Scripts/python -m pytest apps/engine/tests -x`

## SQL Checklist for New Tables

Every new table requires all four of these — none are optional:

- [ ] **RLS enabled** — `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- [ ] **RLS policy** — at minimum one policy; user-owned tables use the `users_own_x` pattern
- [ ] **Index on FK + timestamp** — query performance degrades without these
- [ ] **Realtime** — add to publication if the web dashboard needs live updates

See `references/schema-patterns.md` for the exact SQL patterns used in this codebase.

## When to Add Realtime

Add a table to the Realtime publication when the web dashboard displays live-updating data from it. Currently subscribed: `signals`, `orders`, `alerts`, `portfolio_positions`, `market_data`.

Add new tables when:

- Users need to see changes without refreshing (trades, notifications)
- The web dashboard polls this table frequently (replace polling with subscription)

Do NOT add to Realtime: `instruments`, `strategies`, `backtest_results`, `risk_metrics` (these are reference data or batch-updated).

## RLS Rules

Two patterns exist in this codebase:

**User-owned tables** (accounts, signals, orders, positions, trades, snapshots, alerts, watchlists):

- Policy name: `"users_own_<table>"`
- Scope: `FOR ALL` with both `USING` and `WITH CHECK` clauses
- Condition: `auth.uid() = user_id`

**Shared reference tables** (instruments, market_data, strategies):

- Policy name: `"<table>_read"`
- Scope: `FOR SELECT` only
- Condition: `auth.role() = 'authenticated'`
- No write access from client — service role only

## Common Mistakes

**Forgetting to regenerate TypeScript types** — the Pydantic models and TypeScript interfaces go stale. Always run `supabase gen types` after applying any migration.

**Not exporting new types** — After regenerating `database.types.ts`, check if any new row types need to be re-exported from `packages/shared/src/types/index.ts` for web/agents consumption.

**Missing indexes on FKs** — PostgreSQL does not auto-index foreign keys. Every `REFERENCES` column that appears in a `WHERE` clause or `JOIN` needs an index. Follow the `idx_<table>_<field>` naming convention.

**Adding `updated_at` without a trigger** — This schema does not use automatic `updated_at` triggers. Either update it manually in application code or omit it if not needed.

**Redefining enums** — The CHECK constraint pattern (`CHECK (x IN ('a', 'b'))`) is used throughout instead of enum types. Do not create PostgreSQL enum types — use CHECK constraints to stay consistent.

## Additional Resources

- **`references/schema-patterns.md`** — Exact SQL templates for tables, RLS, indexes, Realtime based on actual migration files
- **`scripts/new-migration.py`** — Scaffold the next numbered migration file with a pre-filled template
