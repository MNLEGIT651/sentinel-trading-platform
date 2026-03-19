---
name: sentinel-supabase-ops
description: This skill should be used for any Supabase operation on the Sentinel trading platform — including "check Supabase", "query the database", "run SQL", "view database logs", "Supabase branch", "check RLS", "security advisor", "performance advisor", "slow queries", "inspect tables", "generate types", "Supabase MCP", or any time direct database access, inspection, or maintenance is needed. Always apply when using Supabase MCP tools for this project.
---

# Sentinel Supabase Operations

**Project:** Sentinel Trading Platform
**Project ID:** `luwyjfwauljwsfsnwiqb`
**Region:** us-east-1
**Status:** ACTIVE_HEALTHY
**PostgreSQL:** 17.6
**Dashboard:** [supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb](https://supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb)

All operations below use the Supabase MCP with `project_id: luwyjfwauljwsfsnwiqb`.

---

## MCP Quick Reference

| Task              | MCP Tool                    | Key Parameters            |
| ----------------- | --------------------------- | ------------------------- |
| Run SQL           | `execute_sql`               | `query`                   |
| List tables       | `list_tables`               | `schema: "public"`        |
| Apply migration   | `apply_migration`           | `name`, `query`           |
| Generate TS types | `generate_typescript_types` | —                         |
| Security check    | `get_advisors`              | `type: "security"`        |
| Performance check | `get_advisors`              | `type: "performance"`     |
| View logs         | `get_logs`                  | `service: "postgres"`     |
| List migrations   | `list_migrations`           | —                         |
| Create branch     | `create_branch`             | `name`, `confirm_cost_id` |
| List branches     | `list_branches`             | —                         |
| Merge branch      | `merge_branch`              | `branch_id`               |

---

## Common SQL Queries

**Check recent signals:**

```sql
SELECT ticker, direction, strength, strategy_name, reason, generated_at
FROM signals
ORDER BY generated_at DESC
LIMIT 20;
```

**Check open orders:**

```sql
SELECT id, side, order_type, quantity, status, created_at
FROM orders
WHERE status NOT IN ('filled', 'cancelled', 'rejected')
ORDER BY created_at DESC;
```

**Portfolio positions with P&L:**

```sql
SELECT * FROM portfolio_positions_live
ORDER BY unrealized_pnl DESC;
```

**Recent agent activity:**

```sql
SELECT agent_name, action, status, duration_ms, created_at
FROM agent_logs
ORDER BY created_at DESC
LIMIT 50;
```

**Unacknowledged alerts:**

```sql
SELECT type, severity, title, message, created_at
FROM alerts
WHERE NOT acknowledged
ORDER BY created_at DESC;
```

**Market data freshness check:**

```sql
SELECT i.ticker, MAX(md.timestamp) as last_update
FROM market_data md
JOIN instruments i ON i.id = md.instrument_id
WHERE md.timeframe = '1d'
GROUP BY i.ticker
ORDER BY last_update DESC;
```

---

## Health & Advisor Checks

Run these regularly, especially after schema changes:

**Security advisor** — checks for missing RLS, exposed tables, auth issues:
→ Use `get_advisors` with `type: "security"`. Currently clean (0 issues).

**Performance advisor** — checks for unused indexes, missing indexes, slow patterns:
→ Use `get_advisors` with `type: "performance"`. Currently reports unused indexes on all tables — expected for a new project with low traffic. Review again after 30+ days of real usage before dropping any indexes.

**Database logs** — inspect slow queries and errors:
→ Use `get_logs` with `service: "postgres"`. Look for queries over 1000ms.

---

## Migrations

Apply a migration via MCP:

```
Tool: apply_migration
project_id: luwyjfwauljwsfsnwiqb
name: add_price_alerts
query: <contents of the SQL file>
```

List applied migrations to check what's in sync:

```
Tool: list_migrations
project_id: luwyjfwauljwsfsnwiqb
```

After applying a migration, always regenerate TypeScript types:

```
Tool: generate_typescript_types
project_id: luwyjfwauljwsfsnwiqb
```

Then save the output to `packages/shared/src/types/database.types.ts`.

For the full migration workflow see `sentinel-migration`.

---

## Supabase Branches (Feature Development)

Branches create isolated copies of the database schema for feature development — changes don't affect production until merged.

**Workflow:**

1. Create a branch: `create_branch` with `name: "feature/my-feature"` — note the cost confirmation step
2. Develop against the branch (apply migrations, test)
3. Merge to production: `merge_branch` with the branch ID
4. Delete the branch: `delete_branch`

**When to use branches:**

- Large schema changes (multiple new tables, breaking changes)
- Features that need schema changes to be tested end-to-end before merging to main

**When to skip branches:**

- Small additive changes (new column with default, new index)
- Hotfixes that need to be applied immediately

**Important:** Branches cost money. Check `get_cost` and `confirm_cost` before creating. Delete branches promptly after merging.

---

## Type Generation

After any schema change, regenerate TypeScript types:

1. Use MCP `generate_typescript_types` (project: `luwyjfwauljwsfsnwiqb`)
2. Save output to `packages/shared/src/types/database.types.ts`
3. Check if any new row types need exporting from `packages/shared/src/types/index.ts`
4. Run `pnpm --filter web build` to catch type errors

---

## Additional Resources

- **`references/supabase-mcp-guide.md`** — Full MCP tool reference with examples for each tool
- See `sentinel-migration` for the complete migration creation and application workflow
