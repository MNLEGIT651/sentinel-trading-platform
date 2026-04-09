# Staging Environment Setup

Guide for creating a Railway staging environment that mirrors production for safe pre-release testing.

## Architecture

```
Production                          Staging
┌─────────────────┐                ┌─────────────────┐
│ Vercel (prod)    │                │ Vercel (preview) │
│ sentinel-trading │                │ PR deploy URLs   │
│ -platform.vercel │                │                  │
│ .app             │                │                  │
└────────┬────────┘                └────────┬────────┘
         │                                  │
┌────────┴────────┐                ┌────────┴────────┐
│ Railway (prod)   │                │ Railway (staging)│
│ sentinel-engine  │                │ engine-staging   │
│ sentinel-agents  │                │ agents-staging   │
└────────┬────────┘                └────────┬────────┘
         │                                  │
┌────────┴────────┐                ┌────────┴────────┐
│ Supabase (prod)  │                │ Supabase branch  │
│ luwyjfwauljwsfs… │                │ or separate proj │
└─────────────────┘                └─────────────────┘
```

## Step 1: Railway Staging Services

### Option A: Separate Railway Project (Recommended)

1. Create a new Railway project named `sentinel-staging`
2. Add two services mirroring production:
   - `engine-staging` → same Dockerfile, different env vars
   - `agents-staging` → same Dockerfile, different env vars
3. Connect to the same GitHub repo but deploy from a `staging` branch

```bash
# Create staging branch
git checkout main
git checkout -b staging
git push origin staging
```

### Option B: Same Project, Different Services

Add staging services to the existing `captivating-abundance` project. This shares the private network, which simplifies inter-service communication but risks config drift.

## Step 2: Supabase Staging Database

### Option A: Supabase Branching (Recommended)

Supabase branching creates an isolated database with the same schema:

```bash
# Via Supabase Dashboard or MCP
# Creates a branch with all migrations applied, no production data
```

### Option B: Separate Supabase Project

For full isolation, create a second Supabase project. You'll need to apply all migrations manually:

```bash
# Apply migrations to the staging project
supabase db push --db-url <staging-database-url>
```

## Step 3: Environment Variables

Each staging service needs its own env vars pointing to staging resources:

### Engine Staging

```env
# Supabase — point to staging database
SUPABASE_URL=https://<staging-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>

# Market data — use paper trading keys
ALPACA_API_KEY=<paper-trading-key>
ALPACA_SECRET_KEY=<paper-trading-secret>
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Polygon — same key works for staging
POLYGON_API_KEY=<same-or-separate-key>

# Railway
PORT=8000
ENVIRONMENT=staging
```

### Agents Staging

```env
# Point to staging engine via private network
ENGINE_URL=http://engine-staging.railway.internal

# Supabase staging
SUPABASE_URL=https://<staging-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>

# Anthropic — same key, lower rate limits if needed
ANTHROPIC_API_KEY=<same-key>

# Railway
PORT=3001
ENVIRONMENT=staging
```

### Vercel Preview

Vercel preview deployments automatically deploy on PRs. Configure staging backend URLs in Vercel project settings:

1. Go to **Vercel Dashboard → Project Settings → Environment Variables**
2. Add variables scoped to **Preview** environment:
   - `ENGINE_URL` → staging Railway engine public URL (e.g. `https://engine-staging.up.railway.app`)
   - `ENGINE_API_KEY` → staging engine API key
   - `AGENTS_URL` → staging Railway agents public URL (e.g. `https://agents-staging.up.railway.app`)
   - `NEXT_PUBLIC_SUPABASE_URL` → staging Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging anon key

> **Note:** Do NOT set the deprecated `NEXT_PUBLIC_ENGINE_URL` or `NEXT_PUBLIC_AGENTS_URL`. All engine/agents calls now use the server-side same-origin proxy.

## Step 4: Deployment Flow

```
Feature branch → PR created
  ├─ Vercel: auto-deploys preview (uses staging env vars)
  ├─ CI: runs tests
  └─ Manual: deploy to Railway staging if backend changes

Staging validated → Merge to main
  ├─ Vercel: auto-deploys production
  ├─ Railway: auto-deploys production (via railway-deploy.yml)
  └─ Run smoke tests (scripts/smoke-test.sh)
```

### Deploy to Staging Manually

```bash
# Deploy engine to staging
cd apps/engine
railway up --service engine-staging

# Deploy agents to staging
cd apps/agents
railway up --service agents-staging
```

### Run Smoke Tests Against Staging

```bash
VERCEL_URL=https://your-pr-preview.vercel.app \
  bash scripts/smoke-test.sh --verbose
```

## Step 5: Data Seeding

Staging needs realistic test data without using production data:

```bash
# Create a seed script
cat > scripts/seed-staging.sql << 'EOF'
-- Insert test user portfolio
-- Insert sample watchlist
-- Insert mock order history
EOF

# Apply to staging database
psql <staging-database-url> -f scripts/seed-staging.sql
```

## Cost Considerations

| Service          | Staging Cost | Notes                                      |
| ---------------- | ------------ | ------------------------------------------ |
| Railway          | ~$5-10/mo    | Two services, low traffic, sleep when idle |
| Supabase Branch  | Free         | Included with Pro plan                     |
| Supabase Project | Free tier    | Separate project on free tier              |
| Vercel Preview   | Free         | Included with all plans                    |

## Checklist

- [ ] Create Railway staging project/services
- [ ] Set up Supabase staging database (branch or separate project)
- [ ] Configure staging environment variables on Railway
- [ ] Configure Vercel preview environment variables
- [ ] Verify staging private networking between engine and agents
- [ ] Run smoke tests against staging
- [ ] Document staging URLs in team wiki/README
