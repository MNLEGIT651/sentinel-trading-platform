---
name: sentinel-env-check
description: This skill should be used when the user asks to "check env", "validate environment variables", "missing config", "startup error", "can't connect to Supabase", "setup environment", "first time setup", "check my .env", or runs /sentinel-env-check. Also apply when troubleshooting connection errors at startup — missing env vars are the most common cause.
---

# Sentinel Environment Check

Run a pre-flight check before starting development to catch missing configuration before it causes confusing runtime errors. Three services (web, engine, agents) each need different subsets of the 14 environment variables.

## Run the Check

```bash
python .claude/skills/sentinel-env-check/scripts/check-env.py
```

Run from the project root (`Stock Trading App/`). The script reads `.env` in the current directory and reports pass/fail per service group with color-coded output.

## First-Time Setup

If `.env` doesn't exist yet:

```bash
cp .env.example .env
# Then fill in credentials (see "Getting Keys" below)
```

## Variable Groups

| Group         | Variables                                                                                | Required For                  |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| **Supabase**  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Web + Engine                  |
| **Polygon**   | `POLYGON_API_KEY`                                                                        | Engine data routes            |
| **Alpaca**    | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`                                                    | Engine portfolio/orders       |
| **Anthropic** | `ANTHROPIC_API_KEY`                                                                      | Agents app only               |
| **Internal**  | `NEXT_PUBLIC_ENGINE_URL`, `ENGINE_API_KEY`, `CORS_ORIGINS`, etc.                         | Optional — have safe defaults |

The script distinguishes required (missing = service won't start) from optional (missing = uses default).

## Getting Missing Keys

- **Supabase** — [supabase.com/dashboard](https://supabase.com/dashboard) → your project → Settings → API
- **Polygon** — [polygon.io/dashboard/api-keys](https://polygon.io/dashboard/api-keys) — free tier supports 5 req/min (sufficient for dev)
- **Alpaca** — [app.alpaca.markets](https://app.alpaca.markets) → Paper Trading → API Keys
- **Anthropic** — [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## Broker Mode

`BROKER_MODE=paper` (default) uses Alpaca's paper trading environment — safe for development, simulated fills, no real money. `BROKER_MODE=live` routes orders to real markets. **Always develop and test with `paper`.**

## Scripts

- **`scripts/check-env.py`** — Validates all 14 variables, grouped by service, with colored pass/fail output and a summary
