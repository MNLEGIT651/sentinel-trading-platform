# Credential Sources

Where to get every API key required for local development.

---

## Supabase

**Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

1. Open [supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb/settings/api](https://supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb/settings/api)
2. **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (**never expose this client-side**)

All three values are available immediately — no generation step needed.

---

## Polygon.io

**Variable:** `POLYGON_API_KEY`

1. Log in at [polygon.io/dashboard](https://polygon.io/dashboard)
2. Go to **API Keys** in the left sidebar
3. Copy the default key, or create a new one

Free tier supports delayed data. Paid tiers required for real-time. The Starter plan (~$29/mo) covers most dev needs.

---

## Alpaca Markets

**Variables:** `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_BASE_URL`, `BROKER_MODE`

1. Log in at [alpaca.markets](https://app.alpaca.markets)
2. Navigate to **Paper Trading** (recommended for dev) or **Live Trading**
3. Go to **API Keys** → **Generate New Key**
4. Copy both the key ID and secret (secret only shown once)

**`ALPACA_BASE_URL` values:**

- Paper trading: `https://paper-api.alpaca.markets`
- Live trading: `https://api.alpaca.markets`

**`BROKER_MODE` values:**

- `paper` — simulated trades, no real money
- `live` — real money, requires funded account (**use with extreme caution**)

Always start with `BROKER_MODE=paper` during development.

---

## Anthropic

**Variable:** `ANTHROPIC_API_KEY`

1. Log in at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys** in the sidebar
3. Click **Create Key** and copy the value (only shown once)

Used by `apps/agents` for Claude API calls. Not needed to run the engine or web app.

---

## Engine Internal

**Variables:** `ENGINE_API_KEY`, `CORS_ORIGINS`

These are not third-party credentials — generate your own values:

```bash
# Generate a random API key
python -c "import secrets; print(secrets.token_hex(32))"
```

`CORS_ORIGINS` for local dev: `http://localhost:3000,http://localhost:3001`

---

## Scheduling Intervals

**Variables:** `DATA_INGESTION_INTERVAL_MINUTES`, `SIGNAL_GENERATION_INTERVAL_MINUTES`, `RISK_UPDATE_INTERVAL_MINUTES`

Recommended starting values (copy to `.env`):

```
DATA_INGESTION_INTERVAL_MINUTES=5
SIGNAL_GENERATION_INTERVAL_MINUTES=15
RISK_UPDATE_INTERVAL_MINUTES=1
```

Adjust based on Polygon API tier limits and desired responsiveness.

---

## Summary Table

| Variable                        | Source                | Cost                | Notes                           |
| ------------------------------- | --------------------- | ------------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard    | Free                | Static project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard    | Free                | Public — safe for client-side   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase dashboard    | Free                | **Secret** — server-side only   |
| `POLYGON_API_KEY`               | polygon.io dashboard  | Free tier available | Delayed data on free            |
| `ALPACA_API_KEY`                | alpaca.markets        | Free                | Paper trading available         |
| `ALPACA_SECRET_KEY`             | alpaca.markets        | Free                | Shown once at creation          |
| `ALPACA_BASE_URL`               | N/A                   | —                   | Choose paper vs live URL        |
| `BROKER_MODE`                   | N/A                   | —                   | `paper` or `live`               |
| `ANTHROPIC_API_KEY`             | console.anthropic.com | Pay per token       | Only needed for agents          |
| `ENGINE_API_KEY`                | Self-generated        | —                   | `secrets.token_hex(32)`         |
| `CORS_ORIGINS`                  | Self-defined          | —                   | Comma-separated origins         |
| `NEXT_PUBLIC_ENGINE_URL`        | Self-defined          | —                   | `http://localhost:8000` locally |
| `NEXT_PUBLIC_AGENTS_URL`        | Self-defined          | —                   | `http://localhost:3001` locally |
| `AGENTS_PORT`                   | Self-defined          | —                   | Default `3001`                  |
