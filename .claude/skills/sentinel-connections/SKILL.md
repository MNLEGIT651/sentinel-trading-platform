---
name: sentinel-connections
description: This skill should be used when managing environment variables across multiple environments, asking "where does this env var go", "Vercel env vars", "what goes in production", "env var matrix", "works locally but not in production", "missing env var in Vercel", "which secrets go where", "connect the services", "production environment setup", or any time the cross-service configuration needs to be understood or updated. This is the single source of truth for where every variable lives.
---

# Sentinel Cross-Service Connection Map

The single source of truth for where every environment variable lives across all deployment targets. "Works locally but not in production" is almost always caused by a variable present in `.env` but missing from Vercel.

---

## Environment Variable Matrix

| Variable                             | Local `.env` | Vercel Preview | Vercel Production | GitHub Secrets | Used By                   |
| ------------------------------------ | :----------: | :------------: | :---------------: | :------------: | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           |      ✓       |       ✓        |         ✓         |       —        | Web, Engine               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      |      ✓       |       ✓        |         ✓         |       —        | Web                       |
| `SUPABASE_SERVICE_ROLE_KEY`          |      ✓       |       ✓        |         ✓         |       —        | Engine, Web (server-side) |
| `POLYGON_API_KEY`                    |      ✓       |       —        |         —         |       —        | Engine only               |
| `ALPACA_API_KEY`                     |      ✓       |       —        |         —         |       —        | Engine only               |
| `ALPACA_SECRET_KEY`                  |      ✓       |       —        |         —         |       —        | Engine only               |
| `ALPACA_BASE_URL`                    |      ✓       |       —        |         —         |       —        | Engine only               |
| `BROKER_MODE`                        |      ✓       |       —        |         —         |       —        | Engine only               |
| `ANTHROPIC_API_KEY`                  |      ✓       |       —        |         —         |       —        | Agents only               |
| `NEXT_PUBLIC_ENGINE_URL`             |      ✓       |      ✓ ⚠️      |       ✓ ⚠️        |       —        | Web → Engine              |
| `ENGINE_API_KEY`                     |      ✓       |       —        |         —         |       —        | Engine internal           |
| `CORS_ORIGINS`                       |      ✓       |       —        |         —         |       —        | Engine internal           |
| `NEXT_PUBLIC_AGENTS_URL`             |      ✓       |      ✓ ⚠️      |       ✓ ⚠️        |       —        | Web → Agents              |
| `AGENTS_PORT`                        |      ✓       |       —        |         —         |       —        | Agents internal           |
| `DATA_INGESTION_INTERVAL_MINUTES`    |      ✓       |       —        |         —         |       —        | Engine scheduler          |
| `SIGNAL_GENERATION_INTERVAL_MINUTES` |      ✓       |       —        |         —         |       —        | Engine scheduler          |
| `RISK_UPDATE_INTERVAL_MINUTES`       |      ✓       |       —        |         —         |       —        | Engine scheduler          |

**⚠️ = Must NOT be `localhost`** — these must point to deployed service URLs in Vercel.

---

## The Most Common Production Break

`NEXT_PUBLIC_ENGINE_URL=http://localhost:8000` in Vercel.

The web app calls this URL from the browser — `localhost` in Vercel's environment points to nothing. Set it to the actual deployed engine URL.

Same applies to `NEXT_PUBLIC_AGENTS_URL`.

---

## What Each Environment Needs

### Local Development (`.env`)

Everything. All 17 variables. Run `sentinel-env-check` to verify.

### Vercel Preview & Production

Only what the **web app** needs server-side and client-side:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_ENGINE_URL          ← deployed engine URL
NEXT_PUBLIC_AGENTS_URL          ← deployed agents URL (if agents are deployed)
```

Polygon, Alpaca, Anthropic, and scheduling vars are only consumed by the engine and agents processes — they do not belong in Vercel unless the engine/agents are deployed there too.

### GitHub Actions CI

Currently **zero secrets required**. CI uses placeholder Supabase vars for the build. If integration tests against live services are added in the future, add secrets then.

---

## Service Communication Map

```
Browser
  └─→ apps/web (Vercel)
        ├─→ Supabase (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)    [client-side]
        ├─→ Supabase (SUPABASE_SERVICE_ROLE_KEY)              [server-side/API routes]
        ├─→ Engine   (NEXT_PUBLIC_ENGINE_URL)                  [REST API calls]
        └─→ Agents   (NEXT_PUBLIC_AGENTS_URL)                  [REST API calls]

apps/engine (local or deployed)
  ├─→ Supabase       (SUPABASE_SERVICE_ROLE_KEY)
  ├─→ Polygon.io     (POLYGON_API_KEY)
  └─→ Alpaca         (ALPACA_API_KEY + ALPACA_SECRET_KEY)

apps/agents (local or deployed)
  ├─→ Engine         (ENGINE_URL + ENGINE_API_KEY)
  ├─→ Supabase       (SUPABASE_SERVICE_ROLE_KEY — for recommendations store)
  └─→ Anthropic API  (ANTHROPIC_API_KEY)
```

---

## Setting Vercel Environment Variables

**Via dashboard:**

1. Open [Vercel project settings](https://vercel.com/steven-schlingmans-projects/sentinel-trading-platform-agents/settings/environment-variables)
2. Add each variable — choose Preview, Production, or both
3. Redeploy to pick up changes (env var changes don't auto-redeploy)

**Via CLI:**

```bash
# Add to both preview and production
vercel env add NEXT_PUBLIC_ENGINE_URL production
vercel env add NEXT_PUBLIC_ENGINE_URL preview

# Pull all Vercel env vars to local file
vercel env pull apps/web/.env.local
```

**Via MCP (inspect current vars):**

```
Tool: get_project
projectId: prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG
teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL
```

---

## When Adding a New Environment Variable

1. Add it to `.env.example` with a comment explaining purpose and where to get the value
2. Add it to `.env` locally with the real value
3. If the web app needs it: add it in Vercel dashboard for both Preview and Production
4. If it's required at startup: add validation to `apps/engine/src/config.py` (`Settings` class) or the web env check
5. Update `sentinel-env-check/scripts/check-env.py` with the new variable
6. Update this skill's matrix table

---

## Rotating a Secret

When an API key is compromised or needs rotation:

1. Generate new key in the provider's dashboard
2. Update `.env` locally
3. Update in Vercel dashboard (Settings → Environment Variables)
4. Redeploy the affected service
5. Revoke the old key in the provider's dashboard
6. If stored in GitHub Secrets: `gh secret set <NAME>` to update

**Priority order for rotation:** Supabase service role > Alpaca (live mode only) > Polygon > Anthropic

---

## Additional Resources

- **`references/env-rotation-checklist.md`** — Step-by-step for rotating each service's credentials
- Use `sentinel-env-check` for local validation
- Use `sentinel-vercel-ops` for Vercel-specific env var management
- Use `sentinel-setup` for first-time environment configuration
