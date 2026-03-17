# Sentinel Deployment Guide

## Overview

| Component     | Target                         | Method                         |
| ------------- | ------------------------------ | ------------------------------ |
| `apps/web`    | Vercel                         | Git push to main (auto-deploy) |
| `apps/engine` | Docker (VPS / Cloud Run / ECS) | docker build + docker run      |
| `apps/agents` | Docker (same host as engine)   | docker build + docker run      |
| Database      | Supabase Cloud                 | supabase db push               |

---

## 1. Database (Supabase)

### First-time setup

1. Create a new Supabase project at https://supabase.com
2. Note your project URL and keys (Settings → API)
3. Link and apply migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

4. Seed default data:

```bash
psql "$DATABASE_URL" < supabase/seed.sql
```

### Subsequent schema changes

```bash
supabase db push  # applies any new migrations
```

---

## 2. Web App (Vercel)

### First-time setup

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ENGINE_URL          # URL of your deployed engine
vercel env add AGENTS_URL          # URL of your deployed agents
vercel env add ENGINE_API_KEY
```

### Deploy

```bash
vercel --prod
```

Auto-deploy on push to `main` is configured via the Vercel Git integration + CI workflow.

---

## 3. Engine (Docker)

### Build

```bash
cd apps/engine
docker build -t sentinel-engine:latest .
```

### Run

```bash
docker run -d \
  --name sentinel-engine \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env.production \
  -e ENGINE_ENVIRONMENT=production \
  sentinel-engine:latest
```

### Health check

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "timestamp": "..."}
```

---

## 4. Agents (Docker)

### Build

```bash
cd apps/agents
docker build -t sentinel-agents:latest .
```

### Run

```bash
docker run -d \
  --name sentinel-agents \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file .env.production \
  sentinel-agents:latest
```

### Health check

```bash
curl http://localhost:3001/health
```

---

## 5. Environment Variables

All required variables are documented in `.env.example`. For production:

| Platform       | Where to set                                          |
| -------------- | ----------------------------------------------------- |
| Vercel         | Project Settings → Environment Variables              |
| Docker         | `--env-file .env.production` (never commit this file) |
| GitHub Actions | Repository Settings → Secrets and Variables → Actions |

---

## 6. Pre-Deployment Checklist

- [ ] All secrets rotated and stored in secrets manager (not committed to git)
- [ ] `ENGINE_ENVIRONMENT=production` set (disables Swagger UI)
- [ ] `BROKER_MODE=paper` unless explicitly going live
- [ ] `CORS_ORIGINS` set to production web domain (not `*`)
- [ ] Database migrations applied: `supabase db push`
- [ ] Seed data applied if new Supabase project
- [ ] All CI checks passing on the deploy branch
- [ ] Engine health check passes: `curl http://<engine-host>:8000/health`
- [ ] Agents health check passes: `curl http://<agents-host>:3001/health`

---

## 7. Rollback

### Web (Vercel)

```bash
vercel rollback  # reverts to previous deployment
```

### Engine / Agents (Docker)

```bash
docker stop sentinel-engine
docker run ... sentinel-engine:<previous-tag>
```

### Database

Supabase provides Point-in-Time Recovery (PITR) on Pro plan.
Manual backups: Supabase Dashboard → Database → Backups.

---

## 8. Docker CD (Future Work)

Automating Docker image build/push to a container registry (GHCR/ECR) and triggering remote restarts requires a provisioned container host. This is intentionally deferred — see CI pipeline for the current automated scope (web only via Vercel).
