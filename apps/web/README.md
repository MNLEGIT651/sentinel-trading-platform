# @sentinel/web — Trading Dashboard

Next.js 16 dashboard for the Sentinel Trading Platform. Provides real-time market monitoring, portfolio management, signal analysis, and AI agent oversight.

## Pages

| Route         | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `/`           | Dashboard — portfolio summary, market overview, recent alerts |
| `/markets`    | Market data — watchlists, charts, quote explorer              |
| `/signals`    | Strategy signals — scan results, signal history               |
| `/portfolio`  | Portfolio — positions, orders, account overview               |
| `/strategies` | Strategies — strategy configuration and performance           |
| `/agents`     | Agent control — cycle status, recommendations, approvals      |
| `/settings`   | Configuration — risk policy, notifications, connections       |
| `/backtest`   | Backtesting — strategy simulation, equity curves              |
| `/journal`    | Decision journal (planned)                                    |

## Architecture

- **Proxy routes** (`/api/engine/[...path]`, `/api/agents/[...path]`) — browser never talks directly to engine or agents
- **Supabase Realtime** — live updates for signals, orders, alerts, positions
- **Zustand** — global state for service health, selected ticker, sidebar
- **Auth** — Supabase Auth with RLS-enforced data isolation

## Development

```bash
# From repo root
pnpm dev          # starts all services
pnpm --filter @sentinel/web dev  # web only on port 3000

# Requires .env with:
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# ENGINE_URL, ENGINE_API_KEY
# AGENTS_URL
```

## Testing

```bash
pnpm --filter @sentinel/web test        # Vitest unit tests
pnpm --filter @sentinel/web test:e2e    # Playwright E2E tests
```

## Key Directories

| Path                   | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `src/app/(dashboard)/` | Dashboard pages (authenticated)                        |
| `src/app/api/`         | API proxy routes (engine, agents, health, settings)    |
| `src/components/`      | Reusable UI components                                 |
| `src/hooks/`           | Custom hooks (service health, realtime, order polling) |
| `src/stores/`          | Zustand state stores                                   |
| `src/lib/`             | Utilities (engine-fetch, Supabase client, formatters)  |
