---
name: sentinel-setup
description: This skill should be used when setting up the Sentinel trading platform for the first time, onboarding a new developer, cloning the repo, or when someone asks "how do I get started", "first time setup", "clone and run", "set up the project", "connect to Supabase", "link Vercel", or "get everything running". Also apply when the full dev environment needs to be rebuilt from scratch.
---

# Sentinel Developer Setup

Complete onboarding from a fresh clone to all three services running locally, connected to Supabase and Vercel. Takes approximately 15–20 minutes.

**Prerequisites:** Node 22+, pnpm, Python 3.12+, uv, git, Vercel CLI (`npm i -g vercel`)

---

## Step 1 — Clone & Install

```bash
git clone https://github.com/stevenschling13/sentinel-trading-platform
cd sentinel-trading-platform
pnpm install
```

---

## Step 2 — Configure Environment

```bash
cp .env.example .env
```

Fill in credentials for each service. Run the pre-flight check at any point:

```bash
python .claude/skills/sentinel-env-check/scripts/check-env.py
```

**Where to get each key** — see `references/credential-sources.md`.

Required before anything works:

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `POLYGON_API_KEY`
- `ALPACA_API_KEY` + `ALPACA_SECRET_KEY`
- `ANTHROPIC_API_KEY`

---

## Step 3 — Connect Supabase

The project connects to **Sentinel Trading Platform** (`luwyjfwauljwsfsnwiqb`, us-east-1).

If starting from a fresh Supabase project (rare — the production project already has all migrations applied):

```bash
# Via Supabase MCP — apply each migration in order:
# Use apply_migration tool with project_id: luwyjfwauljwsfsnwiqb
# Files: supabase/migrations/00001_*.sql → 00002_*.sql → 00003_*.sql

# Or via CLI (requires supabase CLI installed):
npx supabase db push --project-id luwyjfwauljwsfsnwiqb
```

Verify the schema is applied — use Supabase MCP `list_tables` or check the dashboard at [supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb](https://supabase.com/dashboard/project/luwyjfwauljwsfsnwiqb).

---

## Step 4 — Link Vercel (Web)

```bash
vercel link
# Select: Steven Schlingman's projects → sentinel-trading-platform-agents
```

This writes `.vercel/project.json` which links the repo to project `prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG`. The file is already committed — this step is only needed if you're setting up from scratch without that file.

Pull production env vars into local `.env.local` for the web app:

```bash
vercel env pull apps/web/.env.local
```

---

## Step 5 — Set Up Python Engine

```bash
cd apps/engine
uv venv .venv
uv pip install -e ".[dev]"
```

---

## Step 6 — Start All Services

Open three terminals:

**Terminal 1 — Engine (port 8000):**

```bash
cd apps/engine
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000
# Verify: curl http://localhost:8000/health
```

**Terminal 2 — Web (port 3000):**

```bash
pnpm --filter web dev
# Open: http://localhost:3000
```

**Terminal 3 — Agents (port 3001, optional):**

```bash
pnpm --filter agents dev
# Verify: curl http://localhost:3001/health
```

Or start all at once via Turborepo (note: engine won't start this way):

```bash
pnpm dev   # starts web + agents only
```

---

## Step 7 — Verify End-to-End

```bash
# Engine health
curl http://localhost:8000/health
# → {"status":"ok","engine":"sentinel","version":"..."}

# Engine → Supabase (data routes need DB connection)
curl http://localhost:8000/api/v1/strategies/
# → {"strategies":[...],"total":11}

# Web → Engine (check browser console for engine errors)
open http://localhost:3000

# Agents
curl http://localhost:3001/health
curl http://localhost:3001/agents
```

---

## Common Setup Failures

| Symptom                                          | Cause                                        | Fix                                   |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------- |
| `Settings.validate()` fails on engine start      | Missing required env var                     | Run env check script                  |
| Web shows "Supabase not configured"              | Missing `NEXT_PUBLIC_SUPABASE_URL` in `.env` | Fill in `.env`, restart web           |
| Engine starts but `/data/quote/AAPL` returns 500 | Missing `POLYGON_API_KEY`                    | Add to `.env`                         |
| Agents won't start                               | Missing `ANTHROPIC_API_KEY`                  | Add to `.env`                         |
| `uv: command not found`                          | uv not installed                             | `pip install uv`                      |
| Port 8000 in use                                 | Previous engine still running                | Kill the process or use `--port 8001` |

---

## Additional Resources

- **`references/credential-sources.md`** — Where to find each API key with direct links
- **`scripts/verify-stack.sh`** — Quick health check for all 3 services
- Use `sentinel-env-check` for credential validation
- Use `sentinel-connections` for the full env var matrix across all environments
